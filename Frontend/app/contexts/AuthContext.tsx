"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  getDisposableEmailError,
  normalizeEmail,
  validateEmailBeforeSignup,
} from "../lib/emailValidation";
import { setTokenSupplier, loadUserData, clearUserCache, flushNow } from "../lib/userCache";
import { clearHistory, flushHistoryNow, setHistoryTokenSupplier, loadHistoryData } from "../lib/readingHistory";
import { clearAllApiCache } from "../lib/apiCache";
import { reloadPage, redirectToHome } from "../lib/browserActions";
import { getHardwareId } from "../lib/fingerprint";
import { resolveAvatarUrl } from "../lib/avatarUpload";
import { ROLE, type UserRole } from "../lib/types/user";
import { isTrustedOAuthCallbackMessage } from "../lib/oauthCallback";
import { useToast } from "./ToastContext";
import {
  isExpectedNativeAuthMessage,
  OAuthProvider,
  parseNativeToWebMessage,
  WebToNativeMessage,
} from "@mangadock/mobile-bridge";

const API_BASE = "/api/proxy";
const DEFAULT_PUBLIC_SITE_URL = "http://localhost:4000";
const NATIVE_AUTH_TIMEOUT_MS = 120_000;

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

// ─── AppUser — Unified user interface for UI components ───────────────
export interface AppUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  role?: UserRole | null;
  providerData: Array<{
    providerId: string;
    photoURL?: string | null;
    email?: string | null;
  }>;
}

/** Map Supabase provider name → standard providerId used throughout the UI. */
function mapProviderId(provider: string): string {
  if (provider === "google") return "google.com";
  if (provider === "facebook") return "facebook.com";
  if (provider === "email") return "password";
  return provider;
}

/** Coerce a role value (numeric, or numeric string from a JWT/metadata claim)
 *  to a known numeric UserRole, or null. Roles are numeric end-to-end (#606);
 *  anything not matching a known ROLE value is treated as unknown. */
const VALID_ROLES = new Set<number>(Object.values(ROLE));
function coerceRole(v: unknown): UserRole | null {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : NaN;
  return VALID_ROLES.has(n) ? (n as UserRole) : null;
}

/** Adapt a Supabase User to the AppUser interface used by UI components. */
function adaptUser(u: SupabaseUser): AppUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (meta.display_name as string | null | undefined) ??
    (meta.full_name as string | null | undefined) ??
    (meta.name as string | null | undefined) ??
    null;
  const photoURL =
    (meta.avatar_url as string | null | undefined) ??
    (meta.picture as string | null | undefined) ??
    null;
  const role = coerceRole(meta.role);

  const providerData = (u.identities ?? []).map((identity) => {
    const idata = (identity.identity_data ?? {}) as Record<string, string | null | undefined>;
    return {
      providerId: mapProviderId(identity.provider),
      photoURL: idata.avatar_url ?? idata.picture ?? null,
      email: idata.email ?? null,
    };
  });

  return {
    uid: u.id,
    id: u.id,
    email: u.email ?? null,
    displayName,
    photoURL,
    emailVerified: !!u.email_confirmed_at,
    role,
    providerData,
  };
}

type BackendProfile = {
  displayName: string | null;
  photoURL: string | null;
  role: UserRole | null;
};

function extractBackendProfile(payload: unknown): BackendProfile | null {
  const read = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v : null;

  const candidates: unknown[] = [payload];
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    candidates.push(root.user, root.data);
  }

  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const displayName = read(obj.displayName) ?? read(obj.name);
    const photoURL =
      read(obj.photoURL) ??
      read(obj.photoUrl) ??
      read(obj.avatarUrl) ??
      read(obj.avatar_url);
    const role = coerceRole(obj.role);
    if (displayName || photoURL || role !== null)
      return { displayName, photoURL, role };
  }
  return null;
}

type AuthContextType = {
  user: AppUser | null;
  userRole: UserRole | null;
  isTranslator: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  /** Show the auth-required toast (and optionally open the login modal). */
  showLoginPrompt: () => void;
  /** Directly open the login modal. */
  openLoginModal: () => void;
  /** Update user display name */
  updateUserProfile: (displayName: string) => Promise<void>;
  /** Update user password (requires current password for re-authentication) */
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Link Google account to current user */
  linkGoogleAccount: () => Promise<void>;
  /** Unlink provider from current user */
  unlinkAccount: (providerId: string) => Promise<void>;
  /** Sign in with Facebook */
  signInWithFacebook: () => Promise<void>;
  /** Link Facebook account to current user */
  linkFacebookAccount: () => Promise<void>;
  /** Add email/password login to a social-only account */
  addEmailPassword: (password: string) => Promise<void>;
  /** Upload a profile photo and return download URL */
  uploadProfilePhoto: (file: File) => Promise<string>;
  /** Update user photoURL */
  updateUserPhotoURL: (photoURL: string) => Promise<void>;
  /** Fetch photo history (shared across all devices) */
  getPhotoHistory: () => Promise<string[]>;
  /** Persist photo history */
  savePhotoHistory: (photos: string[]) => Promise<void>;
  /** No-op in Supabase model — kept for API compatibility */
  switchToConflictingAccount: (credential: unknown) => Promise<void>;
  /** Reauthenticate user for sensitive operations */
  reauthenticateUser: (method: "password" | "google" | "facebook", password?: string) => Promise<void>;
  /** Delete the current account */
  deleteAccount: () => Promise<void>;
  /** Re-send the email verification link */
  resendVerificationEmail: () => Promise<void>;
  /** Refresh the current session to update JWT claims (e.g. roles) */
  refreshSession: () => Promise<void>;
  /** Enroll a new TOTP factor — returns QR code, secret, and factorId */
  enrollTotp: () => Promise<{ qr_code: string; secret: string; factorId: string }>;
  /** Verify a TOTP code to complete enrollment */
  verifyTotpEnrollment: (factorId: string, code: string) => Promise<void>;
  /** Unenroll (remove) an existing TOTP factor */
  unenrollTotp: (factorId: string) => Promise<void>;
  /** Return the first verified TOTP factor, or null */
  getActiveTotpFactor: () => Promise<{ id: string; friendly_name: string } | null>;
  /** Verify TOTP code after password login (AAL2 upgrade) */
  verifyTotpForLogin: (factorId: string, code: string) => Promise<void>;
  /** True when password login succeeded but AAL2 is still required */
  mfaRequired: boolean;
  /** The factor ID waiting for TOTP verification during login */
  pendingMfaFactorId: string | null;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  isTranslator: false,
  loading: true,
  signInWithGoogle: async () => {},
  signUpWithEmail: async () => {},
  signInWithEmail: async () => {},
  sendPasswordReset: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
  showLoginPrompt: () => {},
  openLoginModal: () => {},
  updateUserProfile: async () => {},
  updateUserPassword: async () => {},
  linkGoogleAccount: async () => {},
  unlinkAccount: async () => {},
  signInWithFacebook: async () => {},
  linkFacebookAccount: async () => {},
  addEmailPassword: async () => {},
  uploadProfilePhoto: async () => "",
  updateUserPhotoURL: async () => {},
  getPhotoHistory: async () => [],
  savePhotoHistory: async () => {},
  switchToConflictingAccount: async () => {},
  reauthenticateUser: async () => {},
  deleteAccount: async () => {},
  resendVerificationEmail: async () => {},
  refreshSession: async () => {},
  enrollTotp: async () => ({ qr_code: "", secret: "", factorId: "" }),
  verifyTotpEnrollment: async () => {},
  unenrollTotp: async () => {},
  getActiveTotpFactor: async () => null,
  verifyTotpForLogin: async () => {},
  mfaRequired: false,
  pendingMfaFactorId: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [pendingMfaFactorId, setPendingMfaFactorId] = useState<string | null>(null);
  const { showToast, dismissToast } = useToast();
  const sessionRef = useRef<Session | null>(null);
  const supabaseUserRef = useRef<SupabaseUser | null>(null);
  const lastUidRef = useRef<string | null>(null);
  const pendingNativeAuthRef = useRef<{
    requestId: string;
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const showLoginPrompt = useCallback(() => {
    showToast({
      type: "info",
      message: "กรุณาเข้าสู่ระบบเพื่อใช้ฟีเจอร์นี้",
      duration: 4000,
      action: {
        label: "เข้าสู่ระบบ",
        variant: "white" as const,
        onClick: () => {
          dismissToast();
          setLoginOpen(true);
        },
      },
    });
  }, [showToast, dismissToast]);

  const openLoginModal = useCallback(() => {
    setLoginOpen(true);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    sessionRef.current = data.session;
    return data.session?.access_token ?? null;
  }, []);

  // Sync user profile to backend on sign-in
  const syncToBackend = async (token: string) => {
    try {
      await fetch(`${API_BASE}/users/me`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    } catch {
      // non-critical
    }
  };

  const fetchBackendProfile = async (token: string): Promise<BackendProfile | null> => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const payload: unknown = await res.json();
      return extractBackendProfile(payload);
    } catch {
      return null;
    }
  };

  const isNativeWebView = () =>
    typeof window !== "undefined" && !!window.ReactNativeWebView;

  const startNativeOAuth = (provider: OAuthProvider): Promise<void> => {
    if (!isNativeWebView()) {
      return Promise.reject(new Error("Native auth bridge is not available"));
    }

    const previous = pendingNativeAuthRef.current;
    if (previous) {
      clearTimeout(previous.timer);
      pendingNativeAuthRef.current = null;
      previous.reject(new Error("Native auth request was replaced"));
    }

    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        if (pendingNativeAuthRef.current?.requestId === requestId) {
          pendingNativeAuthRef.current = null;
        }
        reject(Object.assign(new Error("Native login timed out"), { code: "auth/native-timeout" }));
      }, NATIVE_AUTH_TIMEOUT_MS);

      pendingNativeAuthRef.current = { requestId, resolve, reject, timer };
      const message: WebToNativeMessage = {
        type: "mangadock:oauth:start",
        provider,
        requestId,
      };
      window.ReactNativeWebView?.postMessage(JSON.stringify(message));
    });
  };

  useEffect(() => {
    // Wire token suppliers for userCache and readingHistory
    setTokenSupplier(getIdToken);
    setHistoryTokenSupplier(getIdToken);

    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      sessionRef.current = session;
      const suUser = session?.user ?? null;
      supabaseUserRef.current = suUser;
      const appUser = suUser ? adaptUser(suUser) : null;
      setUser(appUser);
      setLoading(false);

      if (suUser && session) {
        // User switched: clear local-first caches to prevent cross-account bleed
        if (lastUidRef.current && lastUidRef.current !== suUser.id) {
          clearUserCache();
          clearHistory();
          clearAllApiCache();
        }
        lastUidRef.current = suUser.id;

        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          // Security invariant #7: on page-refresh session restore, enforce AAL2
          // if the user has a verified TOTP factor but hasn't reached it yet.
          // (signInWithEmail already performs this check for fresh password logins.)
          if (event === "INITIAL_SESSION") {
            const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
              const { data: factors } = await supabase.auth.mfa.listFactors();
              const factor = factors?.totp.find((f) => f.status === "verified");
              if (factor) {
                setPendingMfaFactorId(factor.id);
                setMfaRequired(true);
                return; // halt — MfaVerifyScreen will complete
              }
            }
          }
          const token = session.access_token;
          await syncToBackend(token);
          // Fire-and-forget: record this device so /settings/security shows it immediately
          const hwid = getHardwareId();
          if (hwid) {
            fetch(`${API_BASE}/users/me/record-device`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "X-Hardware-Id": hwid },
            }).catch(() => {});
          }
          const profile = await fetchBackendProfile(token);
          if (profile) {
            setUser((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                displayName: profile.displayName ?? prev.displayName,
                photoURL: profile.photoURL ?? prev.photoURL,
                role: profile.role ?? prev.role,
              };
            });
          }
          await Promise.all([
            loadUserData(token),
            loadHistoryData(token),
          ]);
        }
      } else if (event === "SIGNED_OUT") {
        lastUidRef.current = null;
        clearUserCache();
        clearHistory();
        clearAllApiCache();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [getIdToken]);

  useEffect(() => {
    const onNativeAuthMessage = async (event: MessageEvent) => {
      const payload = parseNativeToWebMessage(event.data);

      const pending = pendingNativeAuthRef.current;
      if (!pending || !isExpectedNativeAuthMessage(payload, pending.requestId)) return;

      pendingNativeAuthRef.current = null;
      clearTimeout(pending.timer);

      if ("error" in payload) {
        pending.reject(Object.assign(new Error(payload.error), { code: "auth/native-oauth-failed" }));
        return;
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });

      if (setSessionError) {
        pending.reject(setSessionError);
        return;
      }

      pending.resolve();
    };

    window.addEventListener("message", onNativeAuthMessage);
    return () => {
      window.removeEventListener("message", onNativeAuthMessage);
      const pending = pendingNativeAuthRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pendingNativeAuthRef.current = null;
        pending.reject(new Error("Native auth bridge was closed"));
      }
    };
  }, []);

  /**
   * Resolve the callback URL at the moment OAuth starts so it always matches
   * the exact host/IP the user is currently visiting.
   */
  const getOAuthCallbackUrl = () =>
    (typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_URL)) +
    "/auth/callback";

  /** Open an OAuth URL in a centred popup and resolve when the callback postMessages the session back. */
  const openOAuthPopup = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const w = 500, h = 650;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 2);
      const popup = window.open(
        url,
        "oauth-popup",
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup || popup.closed) {
        reject(Object.assign(new Error("เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup แล้วลองอีกครั้ง"), { code: "auth/popup-blocked" }));
        return;
      }

      // The callback page postMessages the session tokens (or error) back to us.
      // This works even if the popup callback and opener are on different origins.
      const onMessage = async (event: MessageEvent) => {
        if (!isTrustedOAuthCallbackMessage(event, window.location.origin)) return;
        window.removeEventListener("message", onMessage);
        clearInterval(closedPoll);
        try { popup.close(); } catch { /* ignore */ }

        const { error_code, error, access_token, refresh_token } = event.data as {
          error_code?: string; error?: string;
          access_token?: string; refresh_token?: string;
        };

        if (error_code || error) {
          // Map Supabase error codes → Firebase-style codes used by the UI
          if (error_code === "identity_already_exists") {
            reject(Object.assign(
              new Error("บัญชีนี้เชื่อมต่อกับ MangaDock อีกบัญชีอยู่แล้ว"),
              { code: "auth/credential-already-in-use" }
            ));
          } else if (error_code === "email_exists") {
            reject(Object.assign(
              new Error("อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยอีเมล/รหัสผ่านแทน"),
              { code: "auth/email-already-in-use" }
            ));
          } else {
            reject(new Error(error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่"));
          }
          return;
        }

        // The popup is same-origin and has already written the session to shared
        // localStorage. Only call setSession() if the main window missed the
        // storage event (e.g. browsers with per-window localStorage isolation).
        if (access_token && refresh_token) {
          const { data: { session: existing } } = await supabase.auth.getSession();
          if (!existing) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
        resolve();
      };

      window.addEventListener("message", onMessage);

      const closedPoll = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(closedPoll);
            window.removeEventListener("message", onMessage);
            reject(Object.assign(new Error(""), { code: "auth/popup-closed-by-user" }));
          }
        } catch {
          clearInterval(closedPoll);
          window.removeEventListener("message", onMessage);
          reject(Object.assign(new Error(""), { code: "auth/popup-closed-by-user" }));
        }
      }, 500);
    });
  };

  const signInWithGoogle = async () => {
    if (isNativeWebView()) {
      await startNativeOAuth("google");
      reloadPage();
      return;
    }

    const redirectTo = getOAuthCallbackUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
    await openOAuthPopup(data.url);
    reloadPage();
  };

  const signInWithFacebook = async () => {
    if (isNativeWebView()) {
      await startNativeOAuth("facebook");
      reloadPage();
      return;
    }

    const redirectTo = getOAuthCallbackUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
    await openOAuthPopup(data.url);
    reloadPage();
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const normalizedEmail = normalizeEmail(email);
    const disposableEmailError = getDisposableEmailError(normalizedEmail);
    if (disposableEmailError) throw new Error(disposableEmailError);

    const validation = await validateEmailBeforeSignup(normalizedEmail);
    if (!validation.ok) throw new Error(validation.message ?? "อีเมลนี้ไม่สามารถใช้งานได้ กรุณาลองใหม่");

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { display_name: displayName, full_name: displayName },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already in use") || msg.includes("user already")) {
        const e = new Error("อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทนการสมัครใหม่") as Error & { code: string };
        e.code = "auth/email-already-in-use";
        throw e;
      }
      throw error;
    }

    showToast({
      type: "success",
      message: `สมัครสมาชิกสำเร็จ! กรุณายืนยัน email ที่ ${normalizedEmail} เพื่อเปิดใช้งานได้เต็มรูปแบบ`,
      duration: 8000,
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const e = new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง") as Error & { code: string };
      e.code = "auth/invalid-credential";
      throw e;
    }

    // Security invariant #1: check AAL after successful password login.
    // If the user has a verified TOTP factor and hasn't reached AAL2 yet,
    // pause login and require TOTP verification before completing sign-in.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === "verified");
      if (factor) {
        setPendingMfaFactorId(factor.id);
        setMfaRequired(true);
        return; // halt — MfaVerifyScreen will complete the login
      }
    }

    if (!data.user?.email_confirmed_at) {
      showToast({
        type: "warning",
        message: "ยังไม่ได้ยืนยัน email — กรุณาตรวจสอบ inbox",
        duration: 0,
        action: {
          label: "ส่งอีกครั้ง",
          variant: "white" as const,
          onClick: async () => {
            dismissToast();
            try {
              await supabase.auth.resend({ type: "signup", email });
              showToast({ type: "success", message: "ส่ง verification email แล้ว กรุณาตรวจสอบ inbox", duration: 4000 });
            } catch {
              showToast({ type: "error", message: "ส่ง email ไม่สำเร็จ ลองใหม่ภายหลัง", duration: 4000 });
            }
          },
        },
      });
    } else {
      const name = data.user.user_metadata?.display_name ?? data.user.user_metadata?.full_name ?? data.user.email ?? "คุณ";
      showToast({ type: "success", message: `ยินดีต้อนรับกลับมา, ${name}!`, duration: 3000 });
      reloadPage();
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error("กรุณากรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน");

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) throw error;

    showToast({
      type: "success",
      message: "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบ inbox ของคุณ",
      duration: 5000,
    });
  };

  const signOut = async () => {
    await Promise.all([flushNow(), flushHistoryNow()]);
    clearUserCache();
    clearHistory();
    clearAllApiCache();
    await supabase.auth.signOut();
    setUser(null);
    showToast({ type: "success", message: "ออกจากระบบแล้ว", duration: 3000 });
  };

  const updateUserProfile = async (displayName: string) => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName, full_name: displayName },
    });
    if (error) throw error;
    // Update backend profile
    const token = await getIdToken();
    if (token) {
      await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
    }
    // Refresh local user state
    const { data: { user: updated } } = await supabase.auth.getUser();
    if (updated) {
      supabaseUserRef.current = updated;
      setUser(adaptUser(updated));
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) throw new Error("ไม่พบผู้ใช้");
    // Verify current password
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (authError) {
      const e = new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง") as Error & { code: string };
      e.code = "auth/wrong-password";
      throw e;
    }
    // Update password
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const linkGoogleAccount = async () => {
    const redirectTo = getOAuthCallbackUrl();
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
    await openOAuthPopup(data.url);
  };

  const linkFacebookAccount = async () => {
    const redirectTo = getOAuthCallbackUrl();
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "facebook",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
    await openOAuthPopup(data.url);
  };

  const unlinkAccount = async (providerId: string) => {
    if (!supabaseUserRef.current) throw new Error("ไม่พบผู้ใช้");
    const identities = supabaseUserRef.current.identities ?? [];
    if (identities.length <= 1) throw new Error("ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี");

    // Map Firebase-style providerId back to Supabase provider name
    const supabaseProvider =
      providerId === "google.com" ? "google" :
      providerId === "facebook.com" ? "facebook" :
      providerId === "password" ? "email" : providerId;

    const identity = identities.find((i) => i.provider === supabaseProvider);
    if (!identity) throw new Error("ไม่พบการเชื่อมต่อนี้");

    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) throw error;

    // Refresh user state
    const { data: { user: updated } } = await supabase.auth.getUser();
    if (updated) {
      supabaseUserRef.current = updated;
      setUser(adaptUser(updated));
    }
  };

  const addEmailPassword = async (password: string) => {
    if (!user?.email) throw new Error("ไม่พบผู้ใช้");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    // Refresh user state
    const { data: { user: updated } } = await supabase.auth.getUser();
    if (updated) {
      supabaseUserRef.current = updated;
      setUser(adaptUser(updated));
    }
  };

  const uploadProfilePhoto = async (file: File): Promise<string> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    const token = await getIdToken();
    if (!token) throw new Error("ไม่พบ token");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/users/me/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return resolveAvatarUrl(res);
  };

  const updateUserPhotoURL = async (photoURL: string): Promise<void> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: photoURL },
    });
    if (error) throw error;
    // Update backend profile
    const token = await getIdToken();
    if (token) {
      await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ photoURL }),
      });
    }
    // Refresh local user state
    const { data: { user: updated } } = await supabase.auth.getUser();
    if (updated) {
      supabaseUserRef.current = updated;
      setUser(adaptUser(updated));
    }
  };

  const reauthenticateUser = async (method: "password" | "google" | "facebook", password?: string): Promise<void> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    if (method === "password") {
      if (!user.email || !password) throw new Error("กรุณาระบุรหัสผ่าน");
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        const e = new Error("รหัสผ่านไม่ถูกต้อง") as Error & { code: string };
        e.code = "auth/wrong-password";
        throw e;
      }
    } else {
      // Social reauth via popup
      const redirectTo = getOAuthCallbackUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: method,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
      await openOAuthPopup(data.url);
    }
  };

  const deleteAccount = async (): Promise<void> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    const token = await getIdToken();
    if (!token) throw new Error("ไม่พบ token");
    // Backend handles deleting all data + auth user via Admin SDK
    const res = await fetch(`${API_BASE}/users/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`ลบข้อมูลไม่สำเร็จ (${res.status})`);
    await Promise.all([flushNow(), flushHistoryNow()]);
    clearUserCache();
    clearHistory();
    clearAllApiCache();
    await supabase.auth.signOut();
    setUser(null);
    redirectToHome();
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (!user?.email || user.emailVerified) return;
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    if (error) throw error;
    showToast({ type: "success", message: "ส่ง verification email ใหม่แล้ว กรุณาตรวจสอบ inbox", duration: 4000 });
  };

  const refreshSession = async (): Promise<void> => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    if (session?.user) {
      const appUser = adaptUser(session.user);
      const token = session.access_token;
      const profile = await fetchBackendProfile(token);
      setUser({
        ...appUser,
        role: profile?.role ?? appUser.role,
      });
    }
  };

  // ─── TOTP / MFA ───────────────────────────────────────────────────────────

  const enrollTotp = async (): Promise<{ qr_code: string; secret: string; factorId: string }> => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "MangaDock Authenticator",
    });
    if (error) throw error;
    return {
      qr_code: data.totp.qr_code,
      secret: data.totp.secret,
      factorId: data.id,
    };
  };

  // Security invariant #6: challenge then verify to complete enrollment.
  const verifyTotpEnrollment = async (factorId: string, code: string): Promise<void> => {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) throw Object.assign(error, { code: "auth/invalid-totp-code" });
  };

  // Security invariant #3: unenroll — UI in Task 5 enforces prior re-auth.
  const unenrollTotp = async (factorId: string): Promise<void> => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  };

  const getActiveTotpFactor = async (): Promise<{ id: string; friendly_name: string } | null> => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return null;
    const verified = data.totp.find((f) => f.status === "verified");
    return verified
      ? { id: verified.id, friendly_name: verified.friendly_name ?? "Authenticator" }
      : null;
  };

  // Security invariant #2: challenge then verify to upgrade to AAL2.
  // On success: clear mfaRequired + pendingMfaFactorId so the overlay dismisses.
  const verifyTotpForLogin = async (factorId: string, code: string): Promise<void> => {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) throw Object.assign(new Error("รหัส OTP ไม่ถูกต้อง กรุณาลองอีกครั้ง"), { code: "auth/invalid-totp-code" });
    setMfaRequired(false);
    setPendingMfaFactorId(null);
    reloadPage();
  };

  // ──────────────────────────────────────────────────────────────────────────

  const getPhotoHistory = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    try {
      const token = await getIdToken();
      if (!token) return [];
      const res = await fetch("/api/proxy/users/me/photo-history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }, [user, getIdToken]);

  const savePhotoHistory = async (photos: string[]): Promise<void> => {
    if (!user) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      await fetch("/api/proxy/users/me/photo-history", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      });
    } catch {
      // Non-critical
    }
  };

  const switchToConflictingAccount = async (_credential: unknown): Promise<void> => {
    void _credential;
    // Not needed in Supabase model — kept for API compatibility
    showToast({ type: "info", message: "กรุณาลงชื่อเข้าใช้ด้วยบัญชีอื่น", duration: 3000 });
  };

  const userRole = user?.role ?? null;
  const isTranslator =
    userRole === ROLE.TRANSLATOR ||
    userRole === ROLE.CREATOR ||
    userRole === ROLE.ADMIN;

  // Memoized provider value (#152): without this, any provider state change
  // (including loginOpen open/close) re-rendered every useAuth() consumer.
  // Deps rule: every state an exposed function reads via closure must be a
  // dep, or the memoized closure goes stale. Audited 2026-06-06: the
  // functions read ONLY `user` (loading/loginOpen are never read, only set;
  // setters and the supabase client are stable). userRole/isTranslator
  // derive from user.
  const value = useMemo(() => ({
    user,
    userRole,
    isTranslator,
    loading,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    signOut,
    getIdToken,
    showLoginPrompt,
    openLoginModal,
    updateUserProfile,
    updateUserPassword,
    linkGoogleAccount,
    unlinkAccount,
    signInWithFacebook,
    linkFacebookAccount,
    addEmailPassword,
    uploadProfilePhoto,
    updateUserPhotoURL,
    getPhotoHistory,
    savePhotoHistory,
    switchToConflictingAccount,
    reauthenticateUser,
    deleteAccount,
    resendVerificationEmail,
    refreshSession,
    enrollTotp,
    verifyTotpEnrollment,
    unenrollTotp,
    getActiveTotpFactor,
    verifyTotpForLogin,
    mfaRequired,
    pendingMfaFactorId,
    // mfaRequired + pendingMfaFactorId are exposed state values — must be deps.
    // Functions are recreated every render; capturing them once per
    // [user, loading, mfaRequired, pendingMfaFactorId] is the point of the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, loading, mfaRequired, pendingMfaFactorId]);

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Login modal triggered by showLoginPrompt */}
      {loginOpen && <LoginModalLazy isOpen={loginOpen} onClose={() => setLoginOpen(false)} />}

      {/* MFA verify overlay — shown when password login requires AAL2 upgrade */}
      {mfaRequired && pendingMfaFactorId && (
        <MfaVerifyScreenLazy
          factorId={pendingMfaFactorId}
          onClose={async () => {
            await supabase.auth.signOut();
            setMfaRequired(false);
            setPendingMfaFactorId(null);
          }}
        />
      )}
    </AuthContext.Provider>
  );
}

// Lazy-loaded to avoid circular import issues at module evaluation time
function LoginModalLazy({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LoginModal = require("../components/LoginModal").default as (props: { isOpen: boolean; onClose: () => void }) => React.ReactElement;
  return <LoginModal isOpen={isOpen} onClose={onClose} />;
}

function MfaVerifyScreenLazy({ factorId, onClose }: { factorId: string; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MfaVerifyScreen = require("../components/MfaVerifyScreen").default as (props: { factorId: string; onClose: () => void }) => React.ReactElement;
  return <MfaVerifyScreen factorId={factorId} onClose={onClose} />;
}

export const useAuth = () => useContext(AuthContext);
