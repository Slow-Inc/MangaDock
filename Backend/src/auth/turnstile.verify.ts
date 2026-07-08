/** Cloudflare Turnstile server-side verification endpoint. */
const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Typed result of a completed `siteverify` round-trip. */
export interface TurnstileOutcome {
  /** True only when Cloudflare confirmed the token. */
  success: boolean;
  /** Cloudflare's `error-codes` array when the token was rejected. */
  errorCodes?: string[];
}

/**
 * Perform the Cloudflare Turnstile `siteverify` round-trip and return a typed
 * outcome. Dependency-light (only global `fetch`) so it is unit-testable in
 * isolation, mirroring {@link resolveTurnstileConfig}.
 *
 * Resolves with `{ success, errorCodes? }` for any completed HTTP round-trip
 * (both accept and reject). REJECTS (throws) if the network request or JSON
 * parse fails — the caller distinguishes "captcha rejected" (logged as a
 * verification failure) from "verification unavailable" (logged as a request
 * failure), preserving the controller's existing two-branch logging.
 *
 * `remoteip` is optional and only appended when provided (the current caller
 * does not send it).
 */
export async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteip?: string,
): Promise<TurnstileOutcome> {
  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);
  if (remoteip) formData.append('remoteip', remoteip);

  const result = await fetch(SITEVERIFY_URL, {
    method: 'POST',
    body: formData,
  });
  const outcome = (await result.json()) as {
    success?: boolean;
    'error-codes'?: string[];
  };

  return {
    success: outcome.success === true,
    errorCodes: outcome['error-codes'],
  };
}
