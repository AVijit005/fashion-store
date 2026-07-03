import { ExecutionContext } from '@nestjs/common';
import { AppThrottlerGuard } from './throttler.guard';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;

  beforeEach(() => {
    guard = new AppThrottlerGuard({ throttlers: [] } as any, {} as any, {} as any);
  });

  it('should return req.user.id when the user is present', async () => {
    const req = {
      user: { id: 'user-123' },
      ip: '1.2.3.4',
    } as any;

    await expect((guard as any).getTracker(req)).resolves.toBe('user-123');
  });

  it('should return req.ip when the user is not present', async () => {
    const req = {
      ip: '1.2.3.4',
    } as any;

    await expect((guard as any).getTracker(req)).resolves.toBe('1.2.3.4');
  });
});
