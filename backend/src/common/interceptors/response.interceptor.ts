import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface Response<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, T | Response<T>> {
  private readonly skipPaths = [
    /^\/health$/,
    /^\/orders\/webhook$/,
    /^\/assets\/[^/]+$/,
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<T | Response<T>> {
    if (this.shouldSkip(context)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          ('data' in data || 'errorCode' in data)
        ) {
          return data as Response<T>;
        }
        return {
          success: true,
          timestamp: new Date().toISOString(),
          data: data === undefined ? null : data,
        };
      }),
    );
  }

  private shouldSkip(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Decorator-based skip
    const skipFromMetadata = Reflect.getMetadata(SKIP_TRANSFORM_KEY, handler);
    if (skipFromMetadata === true) {
      return true;
    }

    // Handler attached flag on the response object
    if (response && response.skipTransform === true) {
      return true;
    }

    // Path-based skip for webhooks, health, and file download URL endpoints
    const path = request?.route?.path || request?.path || '';
    if (this.skipPaths.some((pattern) => pattern.test(path))) {
      return true;
    }

    return false;
  }
}
