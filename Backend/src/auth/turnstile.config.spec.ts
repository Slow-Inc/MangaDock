import {
  resolveTurnstileConfig,
  TURNSTILE_TEST_SECRET,
} from './turnstile.config';

const REAL = 'real-prod-secret';

// Capturing logger so we can assert the prod-ignore error is surfaced.
const capturingLogger = () => {
  const errors: string[] = [];
  return { logger: { error: (msg: string) => errors.push(msg) }, errors };
};

describe('resolveTurnstileConfig', () => {
  describe('production — fails closed', () => {
    it('missing secret throws (refuses to boot)', () => {
      expect(() => resolveTurnstileConfig({ NODE_ENV: 'production' })).toThrow(
        /TURNSTILE_SECRET_KEY/,
      );
    });

    it('public test key throws (treated as no secret)', () => {
      expect(() =>
        resolveTurnstileConfig({
          NODE_ENV: 'production',
          TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
        }),
      ).toThrow(/TURNSTILE_SECRET_KEY/);
    });

    it('real secret resolves enabled with that secret', () => {
      expect(
        resolveTurnstileConfig({
          NODE_ENV: 'production',
          TURNSTILE_SECRET_KEY: REAL,
        }),
      ).toEqual({
        enabled: true,
        secret: REAL,
      });
    });

    it('TURNSTILE_ENABLED=false is ignored and error-logged', () => {
      const { logger, errors } = capturingLogger();
      const cfg = resolveTurnstileConfig(
        {
          NODE_ENV: 'production',
          TURNSTILE_SECRET_KEY: REAL,
          TURNSTILE_ENABLED: 'false',
        },
        logger,
      );
      expect(cfg).toEqual({ enabled: true, secret: REAL });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/ignored in production/i);
    });

    it('trims whitespace around the secret', () => {
      expect(
        resolveTurnstileConfig({
          NODE_ENV: 'production',
          TURNSTILE_SECRET_KEY: `  ${REAL}  `,
        }),
      ).toEqual({
        enabled: true,
        secret: REAL,
      });
    });
  });

  describe('non-production — local dev not blocked', () => {
    it('missing secret falls back to the test key (enabled)', () => {
      expect(resolveTurnstileConfig({})).toEqual({
        enabled: true,
        secret: TURNSTILE_TEST_SECRET,
      });
    });

    it('public test key is allowed', () => {
      expect(
        resolveTurnstileConfig({ TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET }),
      ).toEqual({
        enabled: true,
        secret: TURNSTILE_TEST_SECRET,
      });
    });

    it('real secret resolves with that secret', () => {
      expect(
        resolveTurnstileConfig({
          NODE_ENV: 'development',
          TURNSTILE_SECRET_KEY: REAL,
        }),
      ).toEqual({
        enabled: true,
        secret: REAL,
      });
    });

    it('TURNSTILE_ENABLED=false bypasses (enabled:false)', () => {
      expect(resolveTurnstileConfig({ TURNSTILE_ENABLED: 'false' })).toEqual({
        enabled: false,
        secret: TURNSTILE_TEST_SECRET,
      });
    });
  });
});
