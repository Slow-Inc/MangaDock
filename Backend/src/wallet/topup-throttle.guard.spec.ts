import { TopupThrottleGuard } from './topup-throttle.guard';
import { USER_KEY } from '../auth/auth.guard';
import { HttpException } from '@nestjs/common';

const ctx = (uid: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ [USER_KEY]: { uid } }) }) }) as any;

describe('TopupThrottleGuard', () => {
  it('allows requests under the limit', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(undefined) };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
    expect(redis.expire).toHaveBeenCalled(); // TTL set on the first hit
  });

  it('blocks with 429 once the limit is exceeded', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(6), expire: jest.fn() };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow(HttpException);
  });

  it('fails open when Redis is unavailable (incr returns 0)', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(0), expire: jest.fn() };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
  });

  it('does not reset the TTL on subsequent hits', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(2), expire: jest.fn() };
    const guard = new TopupThrottleGuard(redis as any);
    await guard.canActivate(ctx('u1'));
    expect(redis.expire).not.toHaveBeenCalled();
  });
});
