/**
 * Zero-Trust device headers for backend API requests.
 *
 * The Hardware ID identifies the device. The captcha clearance token (#227) is a
 * short-lived, HWID-bound token the reader obtains from `/books/verify-captcha`
 * and stores in localStorage (`cf_clearance_token`). Attaching it to every API
 * request lets each captcha-guarded endpoint — page serving and the expensive
 * MIT translation endpoints — reuse the same token, while open endpoints (e.g.
 * the cheap description translation on catalog cards) simply ignore it.
 *
 * Extracted as pure functions so the injection rules are unit-testable without a
 * DOM (SupabaseGuard wires them into the global `fetch` interceptor).
 */

/**
 * Requests that should carry the device headers.
 *
 * Exact-origin allow-listing (not substring matching): the clearance token is a
 * 1-hour HWID-bound captcha-bypass credential, so it must never leak to a
 * lookalike origin (`supabase.co.evil.com`, `//evil.com`, `?ref=supabase.co`).
 * `allowedOrigins` are the caller's trusted absolute origins (own origin +
 * Supabase project origin); relative same-origin paths always qualify.
 */
export function isApiRequest(url: string, allowedOrigins: string[]): boolean {
  // Relative same-origin path: a single leading "/" not followed by another
  // (reject "//evil.com" protocol-relative URLs).
  if (url.startsWith("/")) {
    return !url.startsWith("//");
  }
  // Absolute URL: trust only when the parsed origin exactly matches an allowed one.
  try {
    return allowedOrigins.includes(new URL(url).origin);
  } catch {
    return false; // malformed URL → not an API request
  }
}

/**
 * Return a copy of `init` with the zero-trust headers injected, without
 * clobbering any value the caller already set explicitly. The clearance header
 * is attached only when a token is present.
 */
export function withZeroTrustHeaders(
  init: RequestInit | undefined,
  hwid: string,
  clearance: string | null,
): RequestInit {
  const options: RequestInit = init ? { ...init } : {};
  const headers = new Headers(options.headers || {});
  if (hwid && !headers.has("x-hardware-id")) {
    headers.set("x-hardware-id", hwid);
  }
  if (clearance && !headers.has("x-captcha-clearance")) {
    headers.set("x-captcha-clearance", clearance);
  }
  options.headers = headers;
  return options;
}
