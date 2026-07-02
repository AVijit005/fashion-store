import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password.utils';
import { welcomeTemplate } from '../email/templates/welcome';
import { verifyEmailTemplate } from '../email/templates/verify-email';
import { passwordResetTemplate } from '../email/templates/password-reset';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

// Dummy Argon2id hash used to keep login response time constant when the
// requested email does not exist. Without this, an attacker can distinguish
// "no such user" from "wrong password" by timing the response.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0Zm9yYXVuaXQ$' +
  'ZHVtbXloYXNoZHVtbXloYXNoZHVtbXloYXNoZHVtbXloYQ';

// Token lifetimes
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const email = signUpDto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await hashPassword(signUpDto.password);
    let user;
    try {
      user = await this.usersService.create(email, hashedPassword);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Email already registered');
      }
      throw error;
    }

    this.logger.log(`Audit: User registered successfully. userId=${user.id}`);

    if (signUpDto.guestToken) {
      await this.prisma.order.updateMany({
        where: { guestToken: signUpDto.guestToken, userId: null },
        data: { userId: user.id },
      });
      this.logger.log(`Audit: Linked guest orders to userId=${user.id}`);
    }

    // Generate a single-use verification token and send the welcome email.
    // We store only the SHA-256 hash so a database leak does not let an
    // attacker verify arbitrary emails.
    const rawToken = this.generateRandomToken();
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: tokenHash },
    });

    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
      const template = welcomeTemplate({ name: user.name ?? null, verifyUrl });
      await this.emailService.sendTemplate(user.email, template);
    } catch (err) {
      // Don't fail signup if the email can't be sent — the user can
      // request a re-send. Log loudly so ops can investigate.
      this.logger.error(
        `Failed to send welcome email to userId=${user.id}: ${(err as Error).message}`,
      );
    }

    return {
      userId: user.id,
      email: user.email,
    };
  }

  /**
   * Mark an email as verified, consuming the single-use token. The
   * caller (the verify-email endpoint) is responsible for hashing the
   * raw token before calling this — we never accept a raw token here.
   */
  async verifyEmail(tokenHash: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: tokenHash },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    this.auditService.create({
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      details: { event: 'email_verified' },
    });
  }

  /**
   * Resend a verification email to a user. Rate-limited (1/hr) at the
   * controller layer. Returns silently whether or not the user exists
   * to avoid leaking account presence.
   */
  async resendVerificationEmail(emailRaw: string): Promise<void> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user || user.isVerified || !user.email) {
      // Silent no-op: do not leak account presence.
      return;
    }

    const rawToken = this.generateRandomToken();
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: tokenHash },
    });

    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
      const template = verifyEmailTemplate({ name: user.name ?? null, verifyUrl });
      await this.emailService.sendTemplate(user.email, template);
    } catch (err) {
      this.logger.error(
        `Failed to resend verification to userId=${user.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Password reset: step 1 — accept an email, always return success,
   * send a reset link if the account exists. The response is identical
   * for existing and non-existing emails so attackers cannot enumerate.
   */
  async requestPasswordReset(emailRaw: string): Promise<void> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.email) {
      // Silent no-op — do not leak account presence.
      return;
    }

    const rawToken = this.generateRandomToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: expiresAt,
      },
    });

    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const expiresInMinutes = Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 60_000);
      const template = passwordResetTemplate({
        name: user.name ?? null,
        resetUrl,
        expiresInMinutes,
      });
      await this.emailService.sendTemplate(user.email, template);
    } catch (err) {
      this.logger.error(
        `Failed to send password reset to userId=${user.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Password reset: step 2 — accept the token + new password, validate,
   * hash, update, and revoke every active session for the user. Token
   * is single-use: after a successful reset, the row's token is cleared.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { passwordResetToken: tokenHash },
      });

      if (!user) {
        throw new BadRequestException('Invalid or expired reset token');
      }
      if (
        user.passwordResetExpires &&
        user.passwordResetExpires.getTime() < Date.now()
      ) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const hashedPassword = await hashPassword(newPassword);
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      // Revoke all sessions — the password reset implies the user may
      // no longer trust previously-issued devices.
      await tx.session.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      });

      this.auditService.create({
        userId: user.id,
        action: AUDIT_ACTIONS.USER_LOGIN,
        details: { event: 'password_reset_completed' },
      });
    });
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    // H-S1: normalize email the same way signUp does. Without this,
    // users who registered as "User@Example.com" and then sign in with
    // " user@example.com " (or any other case / whitespace variant) get
    // a 401 even though it's the same account.
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Constant-time dummy verification — prevents timing-based user
      // enumeration. The attacker cannot distinguish "no such user" from
      // "wrong password" by measuring response time.
      await verifyPassword(loginDto.password, DUMMY_PASSWORD_HASH).catch(() => undefined);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await verifyPassword(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = this.generateRandomToken();
    const tokenHash = this.hashToken(refreshToken);

    const expiryDays = this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create session first so we can embed its ID in the access token.
    // The AuthGuard uses this sessionId to check session.isRevoked on each request.
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    const accessToken = this.generateAccessToken(user.id, user.role, session.id);

    this.auditService.create({
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      details: { email: user.email, sessionId: session.id },
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.hashToken(refreshToken);

    const newRefreshToken = this.generateRandomToken();
    const newTokenHash = this.hashToken(newRefreshToken);

    const expiryDays = this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const { session, newSession } = await this.prisma.$transaction(async (tx) => {
      // C-C9 fix: lock the session row first with SELECT ... FOR UPDATE so a
      // concurrent refresh on the same tokenHash cannot pass the isRevoked
      // check before we mark it revoked. Without the row lock, two requests
      // arriving at the same instant both read isRevoked=false and both
      // succeed in minting fresh tokens — the original token-reuse window.
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          token_hash: string;
          user_agent: string | null;
          ip_address: string | null;
          is_revoked: boolean;
          expires_at: Date;
          created_at: Date;
          updated_at: Date;
          user_role: string;
          user_is_deleted: boolean;
        }>
      >`SELECT s.id, s.user_id, s.token_hash, s.user_agent, s.ip_address,
                 s.is_revoked, s.expires_at, s.created_at, s.updated_at,
                 u.role AS user_role, u.is_deleted AS user_is_deleted
            FROM sessions s
            JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ${tokenHash}
             FOR UPDATE OF s`;

      const current = rows[0];
      if (!current || current.user_is_deleted) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (current.expires_at < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      if (current.is_revoked) {
        // Token reuse detected — revoke every session this user has.
        await tx.session.updateMany({
          where: { userId: current.user_id, isRevoked: false },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException('Security breach detected. All sessions revoked.');
      }

      // Mark this session as revoked. Because we hold the FOR UPDATE lock,
      // no concurrent refresh can be inside this block on the same row.
      await tx.session.update({
        where: { id: current.id },
        data: { isRevoked: true },
      });

      const created = await tx.session.create({
        data: {
          userId: current.user_id,
          tokenHash: newTokenHash,
          ipAddress,
          userAgent,
          expiresAt,
        },
      });

      return { session: current, newSession: created };
    });

    const accessToken = this.generateAccessToken(session.user_id, session.user_role, newSession.id);

    this.logger.log(`Audit: Refresh token rotated. userId=${session.user_id}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string, ipAddress?: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });

    if (session) {
      await this.prisma.session.update({ where: { id: session.id }, data: { isRevoked: true } });
      this.auditService.create({
        userId: session.userId,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        details: { sessionId: session.id },
        ipAddress,
      });
    }
  }

  async invalidateAllUserSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    this.logger.log(`Audit: All sessions invalidated for userId=${userId}`);
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    };
  }

  /**
   * Public helper: hash a token for comparison. Used by the verify-email
   * and resend-verification endpoints to convert the raw token from the
   * request body into the hash we store on the user row.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAccessToken(userId: string, role: string, sessionId: string): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';

    return this.jwtService.sign(
      { sub: userId, role, sessionId },
      { secret, expiresIn: expiresIn as any },
    );
  }

  private generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
