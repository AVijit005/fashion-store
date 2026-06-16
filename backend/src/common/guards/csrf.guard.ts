import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Only enforce on state-changing methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Webhooks don't send X-Requested-With, so we bypass CSRF for them.
    // They are protected by Razorpay signature validation.
    if (request.path === '/api/v1/orders/webhook') {
      return true;
    }

    // Natively trigger CORS preflight by requiring a custom header
    // Modern SPAs should send this. Standard cross-site <form> cannot send custom headers.
    const requestedWith = request.headers['x-requested-with'];
    if (!requestedWith || requestedWith !== 'XMLHttpRequest') {
      throw new ForbiddenException('CSRF Protection: Missing or invalid X-Requested-With header');
    }

    return true;
  }
}
