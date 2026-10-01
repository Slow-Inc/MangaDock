/** The CLI shell starts OAuth in the browser and returns a bound PKCE code. */
declare global {
  interface Window {
    __MANGA_DOCK_CLIENT__?: string;
    __MANGA_DOCK_NATIVE_AUTH__?: {
      startOAuth: (provider: "google" | "facebook", url: string, requestId?: string) => void;
    };
  }
}

const CALLBACK_URL = "mangadock://auth/callback";
const CALLBACK_EVENT = "mangadock:native-oauth-callback";
const TIMEOUT_MS = 120_000;
let cancelPending: (() => void) | null = null;
let committing = false;

export function isCliNativeShell() {
  return typeof window !== "undefined" &&
    !!window.ReactNativeWebView &&
    window.__MANGA_DOCK_CLIENT__ === "android-mobile-shell" &&
    typeof window.__MANGA_DOCK_NATIVE_AUTH__?.startOAuth === "function";
}

export function getCliOAuthCallbackUrl() {
  return `${CALLBACK_URL}?request_id=${crypto.randomUUID()}`;
}

export function cancelCliNativeOAuth() {
  cancelPending?.();
}

export function openCliNativeOAuth(
  url: string,
  provider: "google" | "facebook",
  callbackUrl: string,
  exchangeCode: (code: string, signal: AbortSignal) => Promise<{access_token: string; refresh_token: string}>,
  commitSession: (session: {access_token: string; refresh_token: string}) => Promise<{error: unknown}>,
): Promise<void> {
  if (!isCliNativeShell()) return Promise.reject(new Error("Native auth bridge is not available"));
  if (committing) return Promise.reject(new Error("การเข้าสู่ระบบกำลังเสร็จสิ้น กรุณารอสักครู่"));
  const authorize = new URL(url);
  const redirect = new URL(callbackUrl);
  const requestId = redirect.searchParams.get("request_id");
  if (authorize.protocol !== "https:" ||
      redirect.protocol !== "mangadock:" || redirect.hostname !== "auth" ||
      redirect.pathname !== "/callback" || !requestId ||
      (provider !== "google" && provider !== "facebook")) {
    return Promise.reject(new Error("Native auth request is invalid"));
  }

  cancelPending?.();
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    let exchanging = false;
    let acknowledged = false;
    const acknowledge = () => {
      if (acknowledged) return;
      acknowledged = true;
      try {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          source: "mangadock-web", type: "oauth_callback_consumed", request_id: requestId,
        }));
      } catch { /* Closing the bridge must still settle the pending promise. */ }
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      committing = false;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener(CALLBACK_EVENT, onCallback);
      if (cancelPending === cancel) cancelPending = null;
      acknowledge();
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => {
      if (!committing) finish(Object.assign(new Error(""), {code: "auth/cancelled-popup-request"}));
    };
    const onCallback = async (event: Event) => {
      const detail = (event as CustomEvent<{
        request_id?: string; code?: string; error?: string; error_code?: string;
      }>).detail;
      if (settled || exchanging || !detail || detail.request_id !== requestId) return;
      if (detail.error || detail.error_code) {
        finish(Object.assign(new Error(detail.error ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง"), {
          code: detail.error_code === "identity_already_exists"
            ? "auth/credential-already-in-use"
            : detail.error_code ?? "auth/native-oauth-failed",
        }));
        return;
      }
      if (typeof detail.code !== "string" || !detail.code) {
        finish(Object.assign(new Error("ไม่สามารถยืนยันผลการเข้าสู่ระบบได้ กรุณาลองอีกครั้ง"), {
          code: "auth/native-invalid-callback",
        }));
        return;
      }
      exchanging = true;
      acknowledge();
      try {
        const session = await exchangeCode(detail.code, controller.signal);
        if (settled) return;
        // Session mutation begins only after the bound exchange is still active.
        // Do not admit replacement flows while the SDK is committing this session.
        committing = true;
        clearTimeout(timer);
        const {error} = await commitSession(session);
        finish(error ?? undefined);
      } catch (error) {
        finish(error);
      }
    };
    // Keep the deadline running during exchange so a stalled network cannot hang the UI.
    const timer = setTimeout(() => finish(Object.assign(
      new Error("การเข้าสู่ระบบหมดเวลา กรุณาลองอีกครั้ง"), {code: "auth/native-timeout"},
    )), TIMEOUT_MS);
    cancelPending = cancel;
    window.addEventListener(CALLBACK_EVENT, onCallback);
    try {
      window.__MANGA_DOCK_NATIVE_AUTH__!.startOAuth(provider, url, requestId);
    } catch (error) {
      finish(error);
    }
  });
}
