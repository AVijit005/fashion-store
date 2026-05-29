import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { UsersService } from '../users/users.service';
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

    this.logger.log(`Audit: User logged in. userId=${user.id} ip=${ipAddress}`);

    return {
      accessToken,
      refreshToken,
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
      const current = await tx.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!current) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (current.isRevoked) {
        await tx.session.updateMany({
          where: { userId: current.userId, isRevoked: false },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException('Security breach detected. All sessions revoked.');
      }

      if (current.expiresAt < new Date()) {
        await tx.session.update({
          where: { id: current.id },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException('Refresh token expired');
      }

      const revoked = await tx.session.updateMany({
        where: { id: current.id, isRevoked: false },
        data: { isRevoked: true },
      });
      if (revoked.count !== 1) {
        await tx.session.updateMany({
          where: { userId: current.userId, isRevoked: false },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException('Refresh token was already used');
      }

      const created = await tx.session.create({
        data: {
          userId: current.userId,
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

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });

    if (session) {
      await this.prisma.session.update({ where: { id: session.id }, data: { isRevoked: true } });
      this.logger.log(`Audit: User logged out. userId=${session.userId}`);
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
