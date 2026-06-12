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

/** Requests that should carry the device headers (relative API + localhost + Supabase). */
export function isApiRequest(url: string): boolean {
  return (
    url.startsWith("/") || url.includes("localhost") || url.includes("supabase.co")
  );
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
