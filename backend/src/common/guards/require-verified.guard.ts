import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../config/prisma.service';

export const REQUIRE_VERIFIED_KEY = 'requireVerified';

/**
 * @RequireVerified() — applied to controllers / handlers that require a
 * verified email. The AuthGuard runs first and populates `req.user.id`,
 * then this guard loads the user's `isVerified` flag from the database
 * and rejects the request if it's false.
 *
 * Use cases:
 *   - placing an order (POST /orders/checkout)
 *   - accessing admin endpoints (POST /admin/*)
 *   - any other write path that should be locked behind a verified email
 *
 * For pre-existing users (created before isVerified was added), the
 * schema default of false means they're "unverified" too — which is
 * intentional, since we can't prove they own the address. They can
 * verify by re-requesting from /auth/resend-verification.
 */
@Injectable()
export class RequireVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.id;
    if (!userId) {
      // AuthGuard should have populated this; if not, the auth chain
      // is misconfigured. Fail closed.
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, isDeleted: true },
    });

    if (!user || user.isDeleted) {
      throw new ForbiddenException('Account not found');
    }
    if (!user.isVerified) {
      throw new ForbiddenException(
        'Please verify your email address before performing this action. ' +
          'POST /auth/resend-verification to receive a new link.',
      );
    }

    return true;
  }
}
