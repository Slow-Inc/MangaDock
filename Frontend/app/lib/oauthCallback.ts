export const OAUTH_CALLBACK_TYPE = "supabase:oauth:callback";

export interface OAuthCallbackPayload {
  access_token?: string;
  refresh_token?: string;
  error_code?: string;
  error?: string;
}

/**
 * Post the OAuth popup result back to the opener.
 *
 * SECURITY: `targetOrigin` MUST be the app's own origin (`selfOrigin`), never
 * `"*"`. The popup and its opener are same-origin in the intended flow; a
 * wildcard would deliver the session tokens to a malicious opener that merely
 * launched the popup (account takeover). See plan 2026-07-11 Vuln 1.
 */
export function postOAuthCallbackMessage(
  opener: Pick<Window, "postMessage">,
  payload: OAuthCallbackPayload,
  selfOrigin: string,
): void {
  opener.postMessage({ type: OAUTH_CALLBACK_TYPE, ...payload }, selfOrigin);
}

/**
 * Trust guard for the OAuth popup `message` listener.
 *
 * SECURITY: the receiver must verify `event.origin` before consuming any
 * tokens — the callback page is same-origin as the opener, so a message from
 * any other origin is forged (login CSRF / session fixation). See Vuln 4.
 */
export function isTrustedOAuthCallbackMessage(
  event: Pick<MessageEvent, "origin" | "data">,
  selfOrigin: string,
): boolean {
  return event.origin === selfOrigin && event.data?.type === OAUTH_CALLBACK_TYPE;
}
