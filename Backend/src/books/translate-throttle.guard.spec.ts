import { HttpException } from '@nestjs/common';
import { TranslateThrottleGuard } from './translate-throttle.guard';

/**
 * GET /books/translate is public and can spend a paid provider key (#801). Limit each client, plus a
 * global ceiling so a client that rotates its forwarded address still cannot exceed the budget.
 */
const ctx = (headers: Record<string, string>, ip = '10.0.0.1') =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers, ip }) }) }) as any;

describe('TranslateThrottleGuard', () => {
  it('allows a client under both limits', async () => {
    const redis = { incrWithTtl: jest.fn().mockResolvedValue(1) };
    await expect(
      new TranslateThrottleGuard(redis as any).canActivate(ctx({})),
    ).resolves.toBe(true);
  });

  it('keys the client on the first forwarded address (the browser behind the Next proxy)', async () => {
    const incrWithTtl = jest.fn().mockResolvedValue(1);
    await new TranslateThrottleGuard({ incrWithTtl } as any).canActivate(
      ctx({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }),
    );
    expect(incrWithTtl).toHaveBeenCalledWith(
      'translate:desc:rl:203.0.113.7',
      60,
    );
  });

  it('answers 429 once one client is over its limit', async () => {
    const incrWithTtl = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(key.endsWith(':all') ? 1 : 31),
      );
    await expect(
      new TranslateThrottleGuard({ incrWithTtl } as any).canActivate(ctx({})),
    ).rejects.toThrow(HttpException);
  });

  it('answers 429 once the global ceiling is reached, whatever the client address', async () => {
    const incrWithTtl = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(key.endsWith(':all') ? 601 : 1),
      );
    await expect(
      new TranslateThrottleGuard({ incrWithTtl } as any).canActivate(
        ctx({ 'x-forwarded-for': '198.51.100.9' }),
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
