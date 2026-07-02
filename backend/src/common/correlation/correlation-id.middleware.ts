import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { correlationIdStore } from './correlation-id.store';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Express middleware that generates or propagates a request correlation ID.
 *
 * Priority:
 * 1. x-correlation-id request header
 * 2. x-request-id request header
 * 3. freshly generated UUID v4
 *
 * The correlation ID is stored in AsyncLocalStorage for downstream code and
 * echoed back in the response headers.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id =
    (req.headers[CORRELATION_ID_HEADER] as string | undefined) ||
    (req.headers[REQUEST_ID_HEADER] as string | undefined) ||
    randomUUID();

  res.setHeader(CORRELATION_ID_HEADER, id);

  correlationIdStore.run(id, () => {
    next();
  });
}
