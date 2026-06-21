import { createHash, timingSafeEqual } from 'crypto';

export interface XenditWebhookConfig {
  /** Static `x-callback-token` expected on every webhook. */
  token: string;
  /** HMAC-SHA256 secret; undefined only outside production. */
  secret: string | undefined;
  /** Whether the HMAC signature check is enforced. */
  requireHmac: boolean;
}

/**
 * Resolve Xendit webhook auth config from the environment — pure and
 * dependency-light so the fail-closed matrix is unit-testable in isolation
 * (mirrors {@link resolveTurnstileConfig}).
 *
 * Fail-closed in production: a missing static token or HMAC secret throws so a
 * misconfigured deploy crashes loudly at boot instead of silently accepting
 * forged `payment.succeeded` webhooks that mint coins for free.
 */
export function resolveXenditWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
  logger?: { error: (message: string) => void },
): XenditWebhookConfig {
  const isProd = env.NODE_ENV === 'production';
  const token = env.XENDIT_WEBHOOK_TOKEN?.trim();
  const secret = env.XENDIT_WEBHOOK_SECRET?.trim();

  if (isProd) {
    if (!token) {
      throw new Error(
        'XENDIT_WEBHOOK_TOKEN must be set in production. Refusing to start without webhook authentication.',
      );
    }
    if (!secret) {
      throw new Error(
        'XENDIT_WEBHOOK_SECRET must be set in production. Refusing to start without HMAC verification.',
      );
    }
    return { token, secret, requireHmac: true };
  }

  if (!token) {
    logger?.error('XENDIT_WEBHOOK_TOKEN is not set — webhook auth is disabled (non-production only).');
  }
  return { token: token ?? '', secret, requireHmac: !!secret };
}

/**
 * Constant-time string comparison. Hashes both inputs to a fixed 32-byte
 * digest first so `timingSafeEqual` never throws on length mismatch and the
 * length itself is not leaked via timing.
 */
export function safeTokenEqual(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
