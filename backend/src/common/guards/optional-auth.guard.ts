import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
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
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (token) {
      try {
        const secret = this.configService.get<string>('JWT_SECRET');
        const payload = await this.jwtService.verifyAsync(token, { secret });

        const sessionId = payload.sessionId;

        if (sessionId) {
          const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            select: { isRevoked: true },
          });

          if (session && !session.isRevoked) {
            request.user = {
              id: payload.sub,
              role: payload.role,
              sessionId,
            };
          }
        } else {
          request.user = {
            id: payload.sub,
            role: payload.role,
          };
        }
      } catch {
        // Silently ignore invalid tokens, request proceeds as guest
      }
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
