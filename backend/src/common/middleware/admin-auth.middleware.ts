import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AdminAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] || req.cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException('Admin access requires authentication');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
      const payload = await this.jwtService.verifyAsync(token, { secret });

      if (payload.role !== 'ADMIN') {
        throw new ForbiddenException('Admin role required');
      }

      if (payload.sessionId) {
        const session = await this.prisma.session.findUnique({
          where: { id: payload.sessionId },
          select: { isRevoked: true }
        });
        if (!session || session.isRevoked) {
          throw new UnauthorizedException('Session revoked');
        }
      }

      // Attach user payload to request
      (req as any).user = payload;
      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
