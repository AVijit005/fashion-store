import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { CsrfService } from './csrf.service';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Safe methods do not mutate state and are exempt from CSRF checks.
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Webhooks are protected by Razorpay signature validation, not CSRF tokens.
    if (request.path === '/api/v1/orders/webhook') {
      return true;
    }

    // Double-submit cookie pattern: the value in the non-httpOnly XSRF-TOKEN
    // cookie must match the value sent in the X-XSRF-TOKEN header.
    const cookieToken = request.cookies?.['XSRF-TOKEN'];
    const headerToken = request.headers['x-xsrf-token'];

    if (!this.csrfService.verify(cookieToken, headerToken as string | undefined)) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }
}
