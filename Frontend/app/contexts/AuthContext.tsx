"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { useToast } from "./ToastContext";

const API_BASE = "/api/proxy";

// ─── AppUser — Firebase-compatible interface for UI components ───────────────
export interface AppUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerData: Array<{
    providerId: string;
    photoURL?: string | null;
    email?: string | null;
  }>;
}

/** Map Supabase provider name → Firebase-style providerId used throughout the UI. */
function mapProviderId(provider: string): string {
  if (provider === "google") return "google.com";
  if (provider === "facebook") return "facebook.com";
  if (provider === "email") return "password";
  return provider;
}

/** Adapt a Supabase User to the AppUser interface used by UI components. */
function adaptUser(u: SupabaseUser): AppUser {
  const meta = (u.user_metadata ?? {}) as Record<string, string | null | undefined>;
  const displayName = meta.display_name ?? meta.full_name ?? meta.name ?? null;
  const photoURL = meta.avatar_url ?? meta.picture ?? null;

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
    providerData,
  };
}

type BackendProfile = {
  displayName: string | null;
  photoURL: string | null;
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
    if (displayName || photoURL) return { displayName, photoURL };
  }
  return null;
}

type AuthContextType = {
  user: AppUser | null;
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
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
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
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const { showToast, dismissToast } = useToast();
  const sessionRef = useRef<Session | null>(null);
  const supabaseUserRef = useRef<SupabaseUser | null>(null);
  const lastUidRef = useRef<string | null>(null);

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

  const getIdToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    sessionRef.current = data.session;
    return data.session?.access_token ?? null;
  };

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
        }
        lastUidRef.current = suUser.id;

        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          const token = session.access_token;
          await syncToBackend(token);
          const profile = await fetchBackendProfile(token);
          if (profile) {
            setUser((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                displayName: profile.displayName ?? prev.displayName,
                photoURL: profile.photoURL ?? prev.photoURL,
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
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The canonical frontend URL configured as Supabase's Site URL.
   * OAuth popups always redirect here, so the callback page is always reachable
   * even when the user is on a different IP/origin.
   */
  const OAUTH_CALLBACK_URL =
    (process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "")) +
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
      // This works cross-origin (e.g. user on 192.168.x.x, popup lands on 26.17.141.205).
      const onMessage = async (event: MessageEvent) => {
        if (event.data?.type !== "supabase:oauth:callback") return;
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

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: OAUTH_CALLBACK_URL, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
    await openOAuthPopup(data.url);
  };

  const signInWithFacebook = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: OAUTH_CALLBACK_URL, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
    await openOAuthPopup(data.url);
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
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: OAUTH_CALLBACK_URL, skipBrowserRedirect: true },
    });
    if (error || !data?.url) throw error ?? new Error("ไม่สามารถเปิด popup ได้");
    await openOAuthPopup(data.url);
  };

  const linkFacebookAccount = async () => {
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "facebook",
      options: { redirectTo: OAUTH_CALLBACK_URL, skipBrowserRedirect: true },
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `อัพโหลดไม่สำเร็จ (${res.status})`);
    }
    const data = await res.json();
    const url = data.url as string;
    return url.startsWith("/") ? `/api/proxy${url}` : url;
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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: method,
        options: { redirectTo: OAUTH_CALLBACK_URL, skipBrowserRedirect: true },
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
    await supabase.auth.signOut();
    setUser(null);
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (!user?.email || user.emailVerified) return;
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    if (error) throw error;
    showToast({ type: "success", message: "ส่ง verification email ใหม่แล้ว กรุณาตรวจสอบ inbox", duration: 4000 });
  };

  const getPhotoHistory = async (): Promise<string[]> => {
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
  };

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
    // Not needed in Supabase model — kept for API compatibility
    showToast({ type: "info", message: "กรุณาลงชื่อเข้าใช้ด้วยบัญชีอื่น", duration: 3000 });
  };

  return (
    <AuthContext.Provider value={{
      user,
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
    }}>
      {children}

      {/* Login modal triggered by showLoginPrompt */}
      {loginOpen && <LoginModalLazy isOpen={loginOpen} onClose={() => setLoginOpen(false)} />}
    </AuthContext.Provider>
  );
}

// Lazy-loaded to avoid circular import issues at module evaluation time
function LoginModalLazy({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LoginModal = require("../components/LoginModal").default as (props: { isOpen: boolean; onClose: () => void }) => React.ReactElement;
  return <LoginModal isOpen={isOpen} onClose={onClose} />;
}

export const useAuth = () => useContext(AuthContext);
