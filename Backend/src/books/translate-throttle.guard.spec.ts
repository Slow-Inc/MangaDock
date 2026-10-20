import { ExecutionContext, HttpException } from '@nestjs/common';
import { TranslateThrottleGuard } from './translate-throttle.guard';

/**
 * GET /books/translate is public and can spend a paid provider key (#801). Limit each client — keyed on a
 * value the client cannot forge — and keep a global ceiling that rejected requests do not consume.
 */
const ctx = (headers: Record<string, string>, ip = '10.0.0.1') =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers, ip }) }),
  }) as unknown as ExecutionContext;

describe('TranslateThrottleGuard', () => {
  it('allows a client under both limits', async () => {
    const redis = { incrWithTtl: jest.fn().mockResolvedValue(1) };
    await expect(
      new TranslateThrottleGuard(redis as any).canActivate(ctx({})),
    ).resolves.toBe(true);
  });

  it('keys the client on cf-connecting-ip (set by Cloudflare) and ignores a client-sent X-Forwarded-For', async () => {
    const incrWithTtl = jest.fn().mockResolvedValue(1);
    const guard = new TranslateThrottleGuard({ incrWithTtl } as any);
    await guard.canActivate(
      ctx({
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.1',
      }),
    );
    expect(incrWithTtl).toHaveBeenCalledWith(
      'translate:desc:rl:203.0.113.7',
      60,
    );
    incrWithTtl.mockClear();
    await guard.canActivate(
      ctx({ 'x-forwarded-for': '198.51.100.1' }, '10.0.0.9'),
    );
    expect(incrWithTtl).toHaveBeenCalledWith('translate:desc:rl:10.0.0.9', 60);
  });

  it('answers 429 once one client is over its limit, without spending the global budget', async () => {
    const incrWithTtl = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(key.endsWith(':all') ? 1 : 31),
      );
    await expect(
      new TranslateThrottleGuard({ incrWithTtl } as any).canActivate(ctx({})),
    ).rejects.toThrow(HttpException);
    expect(incrWithTtl).not.toHaveBeenCalledWith('translate:desc:rl:all', 60);
  });

  it('answers 429 once the global ceiling is reached', async () => {
    const incrWithTtl = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(key.endsWith(':all') ? 601 : 1),
      );
    await expect(
      new TranslateThrottleGuard({ incrWithTtl } as any).canActivate(
        ctx({ 'cf-connecting-ip': '198.51.100.9' }),
      ),
    ).rejects.toThrow(HttpException);
  });

  it('fails open when Redis is unavailable', async () => {
    const redis = { incrWithTtl: jest.fn().mockResolvedValue(0) };
    await expect(
      new TranslateThrottleGuard(redis as any).canActivate(ctx({})),
    ).resolves.toBe(true);
  });
});
