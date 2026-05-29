import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password.utils';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const existingUser = await this.usersService.findByEmail(signUpDto.email);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await hashPassword(signUpDto.password);
    const user = await this.usersService.create(signUpDto.email, hashedPassword);

    this.logger.log(`Audit: User registered successfully. email=${user.email} userId=${user.id}`);

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

    const accessToken = this.generateAccessToken(user.id, user.role);
    const refreshToken = this.generateRandomToken();
    const tokenHash = this.hashToken(refreshToken);

    const expiryDays = this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    this.logger.log(`Audit: User logged in. userId=${user.id} ip=${ipAddress}`);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token Reuse Detection (Security Breach Alert)
    if (session.isRevoked) {
      this.logger.warn(
        `Audit WARNING: Refresh token reuse detected! Revoking all sessions for userId=${session.userId}. ip=${ipAddress}`,
      );
      await this.invalidateAllUserSessions(session.userId);
      throw new UnauthorizedException('Security breach detected. All sessions revoked.');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke current session
    await this.prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    // Generate new token pair
    const accessToken = this.generateAccessToken(session.userId, session.user.role);
    const newRefreshToken = this.generateRandomToken();
    const newTokenHash = this.hashToken(newRefreshToken);

    const expiryDays = this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create new session record
    await this.prisma.session.create({
      data: {
        userId: session.userId,
        tokenHash: newTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    this.logger.log(`Audit: Refresh token rotated. userId=${session.userId}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });

    if (session) {
      await this.prisma.session.delete({ where: { id: session.id } });
      this.logger.log(`Audit: User logged out. userId=${session.userId}`);
    }
  }

  async invalidateAllUserSessions(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
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

  private generateAccessToken(userId: string, role: string): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';

    return this.jwtService.sign(
      { sub: userId, role },

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
