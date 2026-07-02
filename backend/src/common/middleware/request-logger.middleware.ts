import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * RequestLoggerMiddleware emits a single structured log line per HTTP
 * request once the response has finished. The winston instance
 * configured in main.ts handles the formatting (JSON in production,
 * colorized in dev), so we just need to pass a typed payload.
 *
 * Why a middleware and not an interceptor? An interceptor only fires
 * for routes that match the controller's path. A middleware fires for
 * every request \u2014 including 404s and CSRF rejections \u2014 which is what you
 * want for HTTP-level observability.
 *
 * Phase 8 replaces the previous behavior (no request logging at all,
 * every request was a black hole).
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startNs = process.hrtime.bigint();

    // Strip the query string for the log \u2014 it often carries tokens
    // (password-reset links, share tokens) that should never end up in
    // a log aggregator. The Sentry PII filter also handles this but
    // defense in depth.
    const pathOnly = req.originalUrl.split('?')[0];

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startNs) / 1_000_000;

      // The HTTP status class (2xx, 4xx, 5xx) is more useful than the
      // raw code for alerting \u2014 a single 4xx vs a single 5xx matters
      // less than a spike of either class.
      const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

      this.logger.log(
        {
          method: req.method,
          path: pathOnly,
          status: res.statusCode,
          statusClass,
          durationMs: Math.round(durationMs * 10) / 10,
          ip:
            (req.headers['x-forwarded-for'] as string | undefined)
              ?.split(',')[0]
              ?.trim() ?? req.ip,
          userAgent: req.headers['user-agent'],
          // Carry the correlation id (set by CorrelationIdMiddleware) so
          // the HTTP log line can be joined to application logs.
          correlationId: req.headers['x-correlation-id'],
          // userId is set by JwtAuthGuard on protected routes \u2014 we
          // emit it as opaque data, never email or name.
          userId: (req as Request & { user?: { id?: string } }).user?.id,
          contentLength: Number(res.getHeader('content-length')) || undefined,
        },
        `${req.method} ${pathOnly} ${res.statusCode} ${Math.round(durationMs)}ms`,
      );
    });

    next();
  }
}
