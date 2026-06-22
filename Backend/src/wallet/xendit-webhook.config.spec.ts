import {
  resolveXenditWebhookConfig,
  safeTokenEqual,
} from './xendit-webhook.config';

describe('resolveXenditWebhookConfig', () => {
  const base = (over: Record<string, string | undefined>) =>
    ({ NODE_ENV: 'test', ...over }) as NodeJS.ProcessEnv;

  it('production: throws when XENDIT_WEBHOOK_TOKEN missing', () => {
    expect(() =>
      resolveXenditWebhookConfig(
        base({ NODE_ENV: 'production', XENDIT_WEBHOOK_SECRET: 's' }),
      ),
    ).toThrow(/XENDIT_WEBHOOK_TOKEN/);
  });

  it('production: throws when XENDIT_WEBHOOK_SECRET missing', () => {
    expect(() =>
      resolveXenditWebhookConfig(
        base({ NODE_ENV: 'production', XENDIT_WEBHOOK_TOKEN: 't' }),
      ),
    ).toThrow(/XENDIT_WEBHOOK_SECRET/);
  });

  it('production: requireHmac=true when both set', () => {
    const cfg = resolveXenditWebhookConfig(
      base({
        NODE_ENV: 'production',
        XENDIT_WEBHOOK_TOKEN: 't',
        XENDIT_WEBHOOK_SECRET: 's',
      }),
    );
    expect(cfg).toEqual({ token: 't', secret: 's', requireHmac: true });
  });

  it('non-production: requireHmac follows secret presence', () => {
    expect(
      resolveXenditWebhookConfig(base({ XENDIT_WEBHOOK_TOKEN: 't' }))
        .requireHmac,
    ).toBe(false);
    expect(
      resolveXenditWebhookConfig(
        base({ XENDIT_WEBHOOK_TOKEN: 't', XENDIT_WEBHOOK_SECRET: 's' }),
      ).requireHmac,
    ).toBe(true);
  });

  it('non-production: missing token resolves to empty string (dev allowed)', () => {
    expect(resolveXenditWebhookConfig(base({})).token).toBe('');
  });
});

describe('safeTokenEqual', () => {
  it('true for identical non-empty strings', () => {
    expect(safeTokenEqual('abc123', 'abc123')).toBe(true);
  });
  it('false for different strings (incl. different lengths)', () => {
    expect(safeTokenEqual('abc', 'abcd')).toBe(false);
    expect(safeTokenEqual('abc', 'xyz')).toBe(false);
  });
  it('false when either side is empty/undefined', () => {
    expect(safeTokenEqual(undefined, 'x')).toBe(false);
    expect(safeTokenEqual('x', undefined)).toBe(false);
    expect(safeTokenEqual('', '')).toBe(false);
  });
});
