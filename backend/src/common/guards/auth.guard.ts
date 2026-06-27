import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../config/prisma.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    sessionId?: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      const sessionId = payload.sessionId;

      if (!sessionId) {
        throw new UnauthorizedException('Invalid token format: missing sessionId');
      }

      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        select: { isRevoked: true, expiresAt: true, user: { select: { id: true, role: true, isDeleted: true } } },
      });

      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session has been revoked');
      }
      if (!session.user) {
        throw new UnauthorizedException('User no longer exists');
      }
      if (session.user.isDeleted) {
        throw new UnauthorizedException('User account is deactivated');
      }

      request.user = {
        id: session.user.id,
        role: session.user.role,
        sessionId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer') return token;
    return request.cookies?.access_token;
  }
}
