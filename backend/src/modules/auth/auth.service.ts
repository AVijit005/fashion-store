import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password.utils';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
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

    return {
      userId: user.id,
      email: user.email,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
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

    const accessToken = this.generateAccessToken(session.userId, session.user.role, newSession.id);

    this.logger.log(`Audit: Refresh token rotated. userId=${session.userId}`);

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
    };
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
