import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { ResponseTransformInterceptor, Response } from './response.interceptor';
import { SkipTransform, SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

const createMockContext = (options: {
  path?: string;
  handlerMetadata?: boolean;
  responseSkip?: boolean;
}): ExecutionContext => {
  const request = {
    path: options.path ?? '/api/test',
    route: { path: options.path ?? '/api/test' },
  } as any;

  const handler = jest.fn();
  if (options.handlerMetadata === true) {
    Reflect.defineMetadata(SKIP_TRANSFORM_KEY, true, handler);
  }

  const response: any = {};
  if (options.responseSkip === true) {
    response.skipTransform = true;
  }

  return {
    getHandler: () => handler,
    getClass: () => ({}) as any,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
};

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();
  });

  const createCallHandler = (data: any): CallHandler => ({
    handle: () => of(data),
  });

  it('wraps a plain object response in the standard envelope', async () => {
    const context = createMockContext({});
    const handler = createCallHandler({ id: '123' });

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toMatchObject({
      success: true,
      data: { id: '123' },
    });
    expect((result as Response<any>).timestamp).toMatch(/^\d{4}-/);
  });

  it('wraps undefined data as null', async () => {
    const context = createMockContext({});
    const handler = createCallHandler(undefined);

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toMatchObject({
      success: true,
      data: null,
    });
  });

  it('does not double-wrap an already wrapped response', async () => {
    const wrapped = { success: true, data: { id: '123' }, timestamp: '2024-01-01T00:00:00.000Z' };
    const context = createMockContext({});
    const handler = createCallHandler(wrapped);

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual(wrapped);
  });

  it('skips wrapping when @SkipTransform metadata is present', async () => {
    const context = createMockContext({ handlerMetadata: true });
    const handler = createCallHandler({ status: 'ok' });

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ status: 'ok' });
  });

  it('skips wrapping when response.skipTransform is true', async () => {
    const context = createMockContext({ responseSkip: true });
    const handler = createCallHandler({ status: 'ok' });

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ status: 'ok' });
  });

  it('skips wrapping for /health', async () => {
    const context = createMockContext({ path: '/health' });
    const handler = createCallHandler({ status: 'OK' });

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ status: 'OK' });
  });

  it('skips wrapping for /orders/webhook', async () => {
    const context = createMockContext({ path: '/orders/webhook' });
    const handler = createCallHandler({ received: true });

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ received: true });
  });

  it('skips wrapping for /assets/:id', async () => {
    const context = createMockContext({ path: '/assets/abc-123' });
    const handler = createCallHandler({ downloadUrl: 'https://example.com/file' });

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ downloadUrl: 'https://example.com/file' });
  });

  it('does not skip wrapping for unrelated paths', async () => {
    const context = createMockContext({ path: '/orders' });
    const handler = createCallHandler([{ id: '1' }]);

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toMatchObject({
      success: true,
      data: [{ id: '1' }],
    });
  });

  describe('SkipTransform decorator', () => {
    it('sets skipTransform metadata to true', () => {
      class TestController {
        @SkipTransform()
        handler() {
          return {};
        }
      }

      const instance = new TestController();
      const metadata = Reflect.getMetadata(SKIP_TRANSFORM_KEY, instance.handler);
      expect(metadata).toBe(true);
    });
  });
});
