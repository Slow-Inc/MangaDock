/**
 * Cloudflare's public Turnstile **test** secret. With this key the `siteverify`
 * call always succeeds and the HMAC clearance token is signed with a publicly
 * known value — so it must be treated as "no secret at all" in production.
 */
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

export interface TurnstileConfig {
  /** Whether the captcha clearance check is enforced. */
  enabled: boolean;
  /** Secret used to verify `siteverify` and sign/verify clearance tokens. */
  secret: string;
}

/**
 * Resolve the Turnstile configuration from the environment — pure and
 * dependency-light so the fail-closed matrix is unit-testable in isolation
 * (mirrors {@link createStorageProvider}).
 *
 * Fail-closed in production: a missing secret, or the public Cloudflare test
 * key, throws so a misconfigured deploy crashes loudly at boot instead of
 * silently serving an always-pass captcha with a forgeable clearance token.
 * `TURNSTILE_ENABLED=false` is honored only outside production; in production it
 * is ignored (and error-logged via the optional logger) so the protection
 * cannot be switched off by env alone.
 *
 * Outside production the public test key and the disable bypass are allowed so
 * local development is not blocked.
 */
export function resolveTurnstileConfig(
  env: NodeJS.ProcessEnv = process.env,
  logger?: { error: (message: string) => void },
): TurnstileConfig {
  const isProd = env.NODE_ENV === 'production';
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const disabled = env.TURNSTILE_ENABLED === 'false';

  if (isProd) {
    if (!secret || secret === TURNSTILE_TEST_SECRET) {
      throw new Error(
        'TURNSTILE_SECRET_KEY must be set to a real secret in production ' +
          '(the public Cloudflare test key is rejected). Refusing to start with an always-pass captcha.',
      );
    }
    if (disabled) {
      logger?.error(
        'TURNSTILE_ENABLED=false is ignored in production — captcha clearance stays enforced.',
      );
    }
    return { enabled: true, secret };
  }

  // Non-production: allow the test key and the explicit disable bypass.
  return { enabled: !disabled, secret: secret || TURNSTILE_TEST_SECRET };
}
