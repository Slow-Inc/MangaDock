import { TopupThrottleGuard } from './topup-throttle.guard';
import { USER_KEY } from '../auth/auth.guard';
import { HttpException } from '@nestjs/common';

const ctx = (uid: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ [USER_KEY]: { uid } }) }),
  }) as any;

describe('TopupThrottleGuard', () => {
  it('allows requests under the limit', async () => {
    const redis = { incrWithTtl: jest.fn().mockResolvedValue(1) };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
  });

  it('blocks with 429 once the limit is exceeded', async () => {
    const redis = { incrWithTtl: jest.fn().mockResolvedValue(6) };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow(HttpException);
  });

  it('fails open when Redis is unavailable (incrWithTtl returns 0)', async () => {
    const redis = { incrWithTtl: jest.fn().mockResolvedValue(0) };
    const guard = new TopupThrottleGuard(redis as any);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
  });

  it('sets the window TTL atomically with the increment (one round-trip, never a separate incr+expire)', async () => {
    const incrWithTtl = jest.fn().mockResolvedValue(1);
    const redis = { incrWithTtl, incr: jest.fn(), expire: jest.fn() };
    const guard = new TopupThrottleGuard(redis as any);

    await guard.canActivate(ctx('u1'));

    // Atomicity: the counter is incremented and its TTL supplied in the SAME call —
    // no window where the key exists without an expiry (the incr-then-expire race).
    expect(incrWithTtl).toHaveBeenCalledTimes(1);
    expect(incrWithTtl).toHaveBeenCalledWith('topup:create:rl:u1', 60);
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.expire).not.toHaveBeenCalled();
  });
});
