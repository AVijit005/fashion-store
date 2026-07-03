import { Request, Response, NextFunction } from 'express';
import {
  correlationIdMiddleware,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from './correlation-id.middleware';
import { getCorrelationId } from './correlation-id.store';

describe('correlationIdMiddleware', () => {
  const createReq = (headers: Record<string, string> = {}): Partial<Request> => ({
    headers,
  });

  const createRes = (): Partial<Response> => {
    const headers: Record<string, string> = {};
    return {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
        return createRes() as Response;
      }),
      getHeader: jest.fn((key: string) => headers[key]),
    };
  };

  it('propagates x-correlation-id from request headers', (done) => {
    const req = createReq({ [CORRELATION_ID_HEADER]: 'existing-correlation-id' }) as Request;
    const res = createRes() as Response;

    correlationIdMiddleware(req, res, () => {
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'existing-correlation-id');
      expect(getCorrelationId()).toBe('existing-correlation-id');
      done();
    });
  });

  it('falls back to x-request-id when x-correlation-id is absent', (done) => {
    const req = createReq({ [REQUEST_ID_HEADER]: 'request-id-value' }) as Request;
    const res = createRes() as Response;

    correlationIdMiddleware(req, res, () => {
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'request-id-value');
      expect(getCorrelationId()).toBe('request-id-value');
      done();
    });
  });

  it('generates a UUID when no correlation headers are present', (done) => {
    const req = createReq() as Request;
    const res = createRes() as Response;

    correlationIdMiddleware(req, res, () => {
      const headerValue = (res.setHeader as jest.Mock).mock.calls[0][1];
      expect(headerValue).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(getCorrelationId()).toBe(headerValue);
      done();
    });
  });

  it('isolates correlation IDs between concurrent requests', (done) => {
    const req1 = createReq({ [CORRELATION_ID_HEADER]: 'id-1' }) as Request;
    const req2 = createReq({ [CORRELATION_ID_HEADER]: 'id-2' }) as Request;
    const res1 = createRes() as Response;
    const res2 = createRes() as Response;

    let completed = 0;
    const check = () => {
      completed++;
      if (completed === 2) done();
    };

    correlationIdMiddleware(req1, res1, () => {
      setTimeout(() => {
        expect(getCorrelationId()).toBe('id-1');
        check();
      }, 10);
    });

    correlationIdMiddleware(req2, res2, () => {
      setTimeout(() => {
        expect(getCorrelationId()).toBe('id-2');
        check();
      }, 10);
    });
  });
});
