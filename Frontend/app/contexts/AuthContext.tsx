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
import {
  onAuthStateChanged,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  signOut as firebaseSignOut,
  updateProfile,
  updatePassword,
  updateEmail,
  updateCurrentUser,
  linkWithPopup,
  linkWithCredential,
  signInWithCredential,
  unlink,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  EmailAuthProvider,
  FacebookAuthProvider,
  GoogleAuthProvider,
  AuthCredential,
  User,
  AuthError,
} from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "../lib/firebase";
import {
  getDisposableEmailError,
  normalizeEmail,
  validateEmailBeforeSignup,
} from "../lib/emailValidation";
import { setTokenSupplier, loadFromFirebase, clearUserCache, flushNow } from "../lib/userCache";
import { clearHistory, flushHistoryNow, setHistoryTokenSupplier, loadHistoryFromFirebase } from "../lib/readingHistory";
import { useToast } from "./ToastContext";

const API_BASE = "/api/proxy";

type AuthContextType = {
  user: User | null;
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
  /** Add email/password login to a Google-only account */
  addEmailPassword: (password: string) => Promise<void>;
  /** Upload an image file to Firebase Storage and return download URL */
  uploadProfilePhoto: (file: File) => Promise<string>;
  /** Update user photoURL in Firebase Auth */
  updateUserPhotoURL: (photoURL: string) => Promise<void>;
  /** Fetch photo history from Firestore (shared across all devices) */
  getPhotoHistory: () => Promise<string[]>;
  /** Persist photo history to Firestore */
  savePhotoHistory: (photos: string[]) => Promise<void>;
  /** Sign out the current user then sign in with a conflicting credential (auth/credential-already-in-use flow) */
  switchToConflictingAccount: (credential: AuthCredential) => Promise<void>;
  /** Reauthenticate user with password or social provider for sensitive operations */
  reauthenticateUser: (method: "password" | "google" | "facebook", password?: string) => Promise<void>;
  /** Delete the current account — clears all Firestore data, avatar files, and Firebase Auth user */
  deleteAccount: () => Promise<void>;
  /** Re-send the Firebase email verification link to the currently signed-in user */
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

/** BroadcastChannel used to notify other open tabs that providerData changed. */
const AUTH_SYNC_CHANNEL = "mb_auth_provider_sync";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const { showToast, dismissToast } = useToast();
  const [pendingLinkCredential, setPendingLinkCredential] = useState<AuthCredential | null>(null);
  const [linkAccountOpen, setLinkAccountOpen] = useState(false);
  const [linkAccountEmail, setLinkAccountEmail] = useState<string | null>(null);
  const [linkAccountProvider, setLinkAccountProvider] = useState<"google" | "facebook" | null>(null);
  const [linkAccountExistingProvider, setLinkAccountExistingProvider] = useState<"password" | "google" | "facebook">("password");
  const linkAccountConfirmFnRef = useRef<(() => Promise<void>) | null>(null);
  /** Saved Facebook OAuth access token from a conflict error — used by completePendingLink
   *  to resolve the FB CDN photo URL after auto-linking. */
  const pendingFbAccessTokenRef = useRef<string | null>(null);
  const lastUidRef = useRef<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Session snapshot: save provider list before sign-out so we can detect
  // if Firebase silently drops providers on next sign-in (Google verified-email
  // override bug).
  // ─────────────────────────────────────────────────────────────────────────
  const SESSION_SNAPSHOT_KEY = "mb:last-session";

  const saveSessionSnapshot = useCallback((u: User) => {
    if (typeof window === "undefined") return;
    const snapshot = {
      uid: u.uid,
      email: u.email,
      providers: u.providerData.map((p) => p.providerId),
    };
    window.localStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }, []);

  const checkProviderLoss = useCallback(
    (signedInUser: User): void => {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(SESSION_SNAPSHOT_KEY);
      if (!raw) return;
      let snapshot: { uid: string; email: string | null; providers: string[] };
      try {
        snapshot = JSON.parse(raw) as typeof snapshot;
      } catch {
        return;
      }
      window.localStorage.removeItem(SESSION_SNAPSHOT_KEY);

      // Only relevant when returning to the SAME account
      if (snapshot.uid !== signedInUser.uid) return;

      const currentProviders = signedInUser.providerData.map((p) => p.providerId);
      const missing = snapshot.providers.filter((p) => !currentProviders.includes(p));
      if (missing.length === 0) return;

      const providerName = (id: string) =>
        id === "password" ? "Email/Password" : id === "google.com" ? "Google" : "Facebook";
      const missingNames = missing.map(providerName).join(" และ ");

      showToast({
        type: "warning",
        message: `Firebase ตรวจพบว่าบัญชี ${missingNames} หายไปจากการเข้าสู่ระบบครั้งนี้ กรุณาเชื่อมต่อบัญชีใหม่ในหน้าตั้งค่า`,
        duration: 0,
        action: {
          label: "ตั้งค่า",
          variant: "white" as const,
          onClick: () => {
            dismissToast();
            // Navigate to account page so user can re-link from the Accounts tab.
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("mb:open-account-modal", { detail: { tab: "accounts" } }));
            }
          },
        },
      });
    },
    [dismissToast, showToast],
  );

  const logAuthDebug = useCallback((event: string, payload?: Record<string, unknown>, targetUser?: User | null) => {
    if (typeof window === "undefined") return;
    const enabled = window.localStorage.getItem("mb:auth-debug") === "1" || process.env.NEXT_PUBLIC_AUTH_DEBUG === "1";
    if (!enabled) return;
    const current = targetUser ?? auth.currentUser;
    console.info("[AuthDebug]", {
      event,
      projectId: auth.app.options.projectId ?? null,
      uid: current?.uid ?? null,
      email: current?.email ?? null,
      emailVerified: current?.emailVerified ?? null,
      providers: (current?.providerData ?? []).map((p) => p.providerId),
      ...payload,
    });
  }, []);

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

  const completePendingLink = useCallback(async (signedInUser: User) => {
    if (!pendingLinkCredential) return;
    await linkWithCredential(signedInUser, pendingLinkCredential);
    await signedInUser.reload();
    await signedInUser.getIdToken(true);
    // If we just linked a Facebook credential, mark email as verified via Admin SDK.
    // This prevents Google from overriding providers on future sign-ins.
    const hasFacebook = signedInUser.providerData.some((p) => p.providerId === "facebook.com");
    if (hasFacebook && !signedInUser.emailVerified) {
      await markEmailVerifiedViaBackend(signedInUser);
    }
    // Resolve the Facebook CDN photo URL using the saved access token
    // so the profile photo picker has the FB option available immediately.
    if (hasFacebook && pendingFbAccessTokenRef.current) {
      await resolveFbPhotoWithToken(signedInUser, pendingFbAccessTokenRef.current);
      pendingFbAccessTokenRef.current = null;
    }
    setPendingLinkCredential(null);
  }, [pendingLinkCredential]);

  // ─────────────────────────────────────────────────────────────────────────
  // Email verification helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mark the signed-in user’s emailVerified = true on the backend via Admin SDK.
   * Safe for social providers (Facebook) that have already verified the email.
   * Google is always emailVerified on Firebase’s side, so no call needed.
   */
  const markEmailVerifiedViaBackend = async (u: User): Promise<void> => {
    if (u.emailVerified) return;
    try {
      const token = await u.getIdToken();
      await fetch(`${API_BASE}/users/me/mark-email-verified`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Pull the updated emailVerified flag into the local token
      await u.reload();
      await u.getIdToken(true);
    } catch {
      // non-critical — don’t fail sign-in over this
    }
  };

  /**
   * After any OAuth sign-in, Firebase Auth is automatically overwritten with the
   * provider’s displayName + photoURL.  This helper fetches the user’s stored
   * Firestore profile and, if it differs, restores it in Firebase Auth.
   * The backend’s upsertUser() no longer touches those fields on existing docs,
   * so Firestore always holds the user’s intentional values.
   */
  const restoreProfileFromFirestore = async (u: User): Promise<void> => {
    try {
      const token = await u.getIdToken();
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // 404 — new user, nothing to restore
      const profile = await res.json() as { displayName?: string | null; photoURL?: string | null };
      const nameChanged = profile.displayName && profile.displayName !== u.displayName;
      const photoChanged = profile.photoURL && profile.photoURL !== u.photoURL;
      if (nameChanged || photoChanged) {
        await updateProfile(u, {
          displayName: profile.displayName ?? u.displayName ?? undefined,
          photoURL: profile.photoURL ?? u.photoURL ?? undefined,
        });
        // Do NOT call u.reload() here! reload() fetches from Firebase Auth server
        // which may still have the provider-overwritten values, undoing the restore.
        // Force auth state observers to fire with the restored values so React
        // picks up the change immediately (otherwise user.photoURL stays stale).
        await updateCurrentUser(auth, u);
      }
    } catch {
      // Non-critical — don’t fail sign-in over this
    }
  };

  const resolveAccountConflict = useCallback(async (
    error: any,
    attemptedProvider: "google" | "facebook",
  ) => {
    const pendingCredential = attemptedProvider === "google"
      ? GoogleAuthProvider.credentialFromError(error)
      : FacebookAuthProvider.credentialFromError(error);
    const email: string | undefined = error?.customData?.email ?? error?.email;

    // If the failed attempt was Facebook, save the access token so we can
    // resolve the FB CDN photo later in completePendingLink.
    if (attemptedProvider === "facebook" && pendingCredential) {
      pendingFbAccessTokenRef.current = (pendingCredential as any).accessToken ?? null;
    }

    logAuthDebug("resolve-conflict:start", {
      attemptedProvider,
      errorCode: error?.code ?? null,
      conflictEmail: email ?? null,
      hasPendingCredential: !!pendingCredential,
    });

    if (!pendingCredential || !email) {
      logAuthDebug("resolve-conflict:missing-data", {
        attemptedProvider,
        conflictEmail: email ?? null,
        hasPendingCredential: !!pendingCredential,
      });
      showToast({ type: "error", message: "เชื่อมบัญชีอัตโนมัติไม่สำเร็จ กรุณาลองเข้าสู่ระบบด้วยวิธีเดิมก่อน" });
      return;
    }

    let signInMethods: string[] = [];
    try {
      signInMethods = await fetchSignInMethodsForEmail(auth, email);
    } catch {
      signInMethods = [];
    }

    logAuthDebug("resolve-conflict:sign-in-methods", {
      attemptedProvider,
      conflictEmail: email,
      signInMethods,
    });

    const linkWithProviderPopup = async (provider: "google" | "facebook") => {
      try {
        logAuthDebug("resolve-conflict:popup-open", { provider, conflictEmail: email });
        const providerInstance = provider === "google" ? googleProvider : facebookProvider;
        const result = await signInWithPopup(auth, providerInstance);
        if (provider === "facebook") {
          await resolveFacebookPhoto(result);
        }
        await linkWithCredential(result.user, pendingCredential);
        await result.user.reload();
        await result.user.getIdToken(true);
        // If the pending credential (the one being linked) is Facebook,
        // resolve its CDN photo using the saved access token.
        if (attemptedProvider === "facebook" && pendingFbAccessTokenRef.current) {
          await resolveFbPhotoWithToken(result.user, pendingFbAccessTokenRef.current);
          pendingFbAccessTokenRef.current = null;
        }
        setUser(auth.currentUser);
        broadcastProviderChange();
        await syncToBackend(result.user);
        // Restore user’s custom displayName/photoURL after auto-link
        await restoreProfileFromFirestore(result.user);
        logAuthDebug("resolve-conflict:linked-success", { provider, conflictEmail: email }, result.user);
        showToast({ type: "success", message: "เชื่อมบัญชีสำเร็จแล้ว", duration: 3000 });
      } catch (popupError: any) {
        const code = popupError?.code ?? "";
        logAuthDebug("resolve-conflict:popup-error", { provider, conflictEmail: email, errorCode: code });
        if (code === "auth/popup-blocked") {
          showToast({ type: "error", message: "เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup แล้วลองอีกครั้ง" });
          return;
        }
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          return;
        }
        throw popupError;
      }
    };

    if (signInMethods.includes("password")) {
      setPendingLinkCredential(pendingCredential);
      linkAccountConfirmFnRef.current = null;
      setLinkAccountExistingProvider("password");
      setLinkAccountEmail(email);
      setLinkAccountProvider(attemptedProvider);
      setLinkAccountOpen(true);
      logAuthDebug("resolve-conflict:open-password-modal", {
        attemptedProvider,
        conflictEmail: email,
      });
      return;
    }

    if (signInMethods.includes("google.com")) {
      linkAccountConfirmFnRef.current = () => linkWithProviderPopup("google");
      setLinkAccountExistingProvider("google");
      setLinkAccountEmail(email);
      setLinkAccountProvider(attemptedProvider);
      setLinkAccountOpen(true);
      logAuthDebug("resolve-conflict:open-social-modal", {
        attemptedProvider,
        existingProvider: "google",
        conflictEmail: email,
      });
      return;
    }

    if (signInMethods.includes("facebook.com")) {
      linkAccountConfirmFnRef.current = () => linkWithProviderPopup("facebook");
      setLinkAccountExistingProvider("facebook");
      setLinkAccountEmail(email);
      setLinkAccountProvider(attemptedProvider);
      setLinkAccountOpen(true);
      logAuthDebug("resolve-conflict:open-social-modal", {
        attemptedProvider,
        existingProvider: "facebook",
        conflictEmail: email,
      });
      return;
    }

    // Fallback when Firebase doesn't return sign-in methods (Email Enumeration Protection).
    // Default to password-first flow — works for email+password accounts.
    setPendingLinkCredential(pendingCredential);
    setLinkAccountExistingProvider("password");
    setLinkAccountEmail(email);
    setLinkAccountProvider(attemptedProvider);
    setLinkAccountOpen(true);
    logAuthDebug("resolve-conflict:fallback-password-modal", {
      attemptedProvider,
      conflictEmail: email,
    });
  }, [logAuthDebug, showToast]);

  // Sync user profile to backend on sign-in
  const syncToBackend = async (u: User) => {
    try {
      const token = await u.getIdToken();
      await fetch(`${API_BASE}/users/me`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // non-critical: backend sync failure
    }
  };

  useEffect(() => {
    // Wire userCache to always have a fresh token
    setTokenSupplier(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return current.getIdToken();
    });
    // Wire readingHistory to always have a fresh token
    setHistoryTokenSupplier(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return current.getIdToken();
    });

    const unsub = onAuthStateChanged(auth, async (u) => {
      logAuthDebug("auth-state-changed", {
        previousUid: lastUidRef.current,
        nextUid: u?.uid ?? null,
      }, u);
      setUser(u);
      setLoading(false);
      if (u) {
        // User switched: clear local-first caches to prevent cross-account bleed
        if (lastUidRef.current && lastUidRef.current !== u.uid) {
          clearUserCache();
          clearHistory();
        }
        lastUidRef.current = u.uid;
        await syncToBackend(u);
        const token = await u.getIdToken();
        await Promise.all([
          loadFromFirebase(token),
          loadHistoryFromFirebase(token),
        ]);
      } else {
        lastUidRef.current = null;
        clearUserCache();
        clearHistory();
      }
    });

    // Listen for provider-change messages from other tabs (link / unlink).
    // When received, reload the current user so providerData is up-to-date
    // without requiring a full page refresh.
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      bc.onmessage = async () => {
        const current = auth.currentUser;
        if (!current) return;
        await current.reload();
        // updateCurrentUser fires onAuthStateChanged with the refreshed user,
        // causing React to re-render with fresh providerData.
        await updateCurrentUser(auth, current);
      };
    }

    // Reload auth user when tab regains visibility so that emailVerified (and
    // any other server-side changes) are reflected without a full page refresh.
    // This handles the common case: user opens the verification link in their
    // email client, then switches back to this tab — the badge updates instantly.
    const onVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      const current = auth.currentUser;
      if (!current || current.emailVerified) return; // already verified — no need to poll
      await current.reload();
      await updateCurrentUser(auth, current);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsub();
      bc?.close();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [logAuthDebug]);

  const signInWithGoogle = async () => {
    try {
      logAuthDebug("google-sign-in:start");
      const result = await signInWithPopup(auth, googleProvider);
      logAuthDebug("google-sign-in:popup-success", undefined, result.user);
      await result.user.reload();
      await result.user.getIdToken(true);
      logAuthDebug("google-sign-in:after-reload", undefined, result.user);
      checkProviderLoss(result.user);
      await completePendingLink(result.user);
      await result.user.reload();
      await result.user.getIdToken(true);
      logAuthDebug("google-sign-in:after-complete-pending-link", undefined, result.user);
      await syncToBackend(result.user);
      // Restore the user’s custom displayName/photoURL that Google sign-in may have overwritten
      await restoreProfileFromFirestore(result.user);
      showToast({ type: "success", message: `ยินดีต้อนรับ, ${result.user.displayName ?? "คุณ"}!`, duration: 3000 });
    } catch (error: any) {
      logAuthDebug("google-sign-in:error", { errorCode: error?.code ?? null, errorMessage: error?.message ?? null });
      if (error?.code === "auth/account-exists-with-different-credential") {
        await resolveAccountConflict(error, "google");
      } else {
        throw error;
      }
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const normalizedEmail = normalizeEmail(email);
    const disposableEmailError = getDisposableEmailError(normalizedEmail);
    if (disposableEmailError) {
      throw new Error(disposableEmailError);
    }

    let existingSignInMethods: string[] = [];
    try {
      existingSignInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
    } catch {
      existingSignInMethods = [];
    }

    if (existingSignInMethods.length > 0) {
      const error = new Error("อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทนการสมัครใหม่") as Error & {
        code: string;
      };
      error.code = "auth/email-already-in-use";
      throw error;
    }

    const validation = await validateEmailBeforeSignup(normalizedEmail);
    if (!validation.ok) {
      throw new Error(validation.message ?? "อีเมลนี้ไม่สามารถใช้งานได้ กรุณาลองใหม่");
    }

    const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    // Update Firebase user profile with displayName
    await updateProfile(result.user, { displayName });
    // Force token refresh so the ID token includes the displayName claim ("name").
    // Without this, syncToBackend would store displayName: null in Firestore,
    // making restoreProfileFromFirestore unable to restore after a Google override.
    await result.user.reload();
    await result.user.getIdToken(true);
    await syncToBackend(result.user);
    // Send verification email — ensures emailVerified=true after clicking the link,
    // which prevents Google "Trusted Provider" from overriding providers later.
    try { await sendEmailVerification(result.user); } catch { /* ignore */ }
    showToast({
      type: "success",
      message: `สมัครสมาชิกสำเร็จ! กรุณายืนยัน email ที่ ${normalizedEmail} เพื่อเปิดใช้งานได้เต็มรูปแบบ`,
      duration: 8000,
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    logAuthDebug("email-sign-in:start", { email });
    const result = await signInWithEmailAndPassword(auth, email, password);
    logAuthDebug("email-sign-in:success", undefined, result.user);
    checkProviderLoss(result.user);
    await completePendingLink(result.user);
    logAuthDebug("email-sign-in:after-complete-pending-link", undefined, result.user);
    await syncToBackend(result.user);
    // Warn if email not yet verified (pending click in inbox)
    if (!result.user.emailVerified) {
      showToast({
        type: "warning",
        message: "ยังไม่ได้ยืนยัน email — กรุณาตรวจสอบ inbox เพื่อป้องกันบัญชีถูก override",
        duration: 0,
        action: {
          label: "ส่งอีกครั้ง",
          variant: "white" as const,
          onClick: async () => {
            dismissToast();
            try {
              await sendEmailVerification(result.user);
              showToast({ type: "success", message: "ส่ง verification email แล้ว กรุณาตรวจสอบ inbox", duration: 4000 });
            } catch {
              showToast({ type: "error", message: "ส่ง email ไม่สำเร็จ ลองใหม่ภายหลัง", duration: 4000 });
            }
          },
        },
      });
    } else {
      showToast({ type: "success", message: `ยินดีต้อนรับกลับมา, ${result.user.displayName ?? result.user.email ?? "คุณ"}!`, duration: 3000 });
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new Error("กรุณากรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน");
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
    } catch (error) {
      const authError = error as AuthError;
      if (authError?.code === "auth/user-not-found") {
        showToast({
          type: "success",
          message: "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบ inbox",
          duration: 5000,
        });
        return;
      }
      throw error;
    }

    showToast({
      type: "success",
      message: "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบ inbox ของคุณ",
      duration: 5000,
    });
  };

  const signOut = async () => {
    // Save provider snapshot BEFORE clearing state so we can detect provider loss on next sign-in
    if (user) saveSessionSnapshot(user);
    // Flush any pending likes/favorites/history to Firebase before clearing local state
    await Promise.all([flushNow(), flushHistoryNow()]);
    clearUserCache();
    clearHistory();
    await firebaseSignOut(auth);
    setUser(null);
    showToast({ type: "success", message: "ออกจากระบบแล้ว", duration: 3000 });
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const updateUserProfile = async (displayName: string) => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    // Update Firebase Auth
    await updateProfile(user, { displayName });
    await user.reload();
    // Update Firestore via explicit PATCH (not syncToBackend which skips displayName on existing docs)
    const token = await user.getIdToken();
    await fetch(`${API_BASE}/users/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) throw new Error("ไม่พบผู้ใช้");
    
    // Re-authenticate user before changing password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
  };

  const signInWithFacebook = async () => {
    try {
      logAuthDebug("facebook-sign-in:start");
      const result = await signInWithPopup(auth, facebookProvider);
      logAuthDebug("facebook-sign-in:popup-success", undefined, result.user);
      await result.user.reload();
      await result.user.getIdToken(true);
      logAuthDebug("facebook-sign-in:after-reload", undefined, result.user);
      // Facebook has verified this email on their end — mark it for Firebase too.
      // This prevents Google "Trusted Provider" from overriding providers later.
      await markEmailVerifiedViaBackend(result.user);
      checkProviderLoss(result.user);
      await resolveFacebookPhoto(result);
      await completePendingLink(result.user);
      await result.user.reload();
      await result.user.getIdToken(true);
      logAuthDebug("facebook-sign-in:after-complete-pending-link", undefined, result.user);
      await syncToBackend(result.user);
      // Restore the user’s custom displayName/photoURL that Facebook sign-in may have overwritten
      await restoreProfileFromFirestore(result.user);
      showToast({ type: "success", message: `ยินดีต้อนรับ, ${result.user.displayName ?? "คุณ"}!`, duration: 3000 });
    } catch (error: any) {
      logAuthDebug("facebook-sign-in:error", { errorCode: error?.code ?? null, errorMessage: error?.message ?? null });
      if (error?.code === "auth/account-exists-with-different-credential") {
        await resolveAccountConflict(error, "facebook");
      } else {
        throw error;
      }
    }
  };

  /** Send a message to all other tabs to reload their user's providerData. */
  const broadcastProviderChange = () => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      bc.postMessage({ type: "provider-changed" });
      bc.close();
    }
  };

  /**
   * Force-refresh current Firebase user and notify auth observers so UI updates
   * immediately after link/unlink operations.
   */
  const refreshAuthUserState = async (u: User) => {
    await u.reload();
    await u.getIdToken(true);
    await updateCurrentUser(auth, u);
    setUser(auth.currentUser);
  };

  const linkFacebookAccount = async () => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    try {
      const result = await linkWithPopup(user, facebookProvider);
      await resolveFacebookPhoto(result);
      await refreshAuthUserState(result.user);
      broadcastProviderChange();
      await syncToBackend(result.user);
      // Restore user’s custom displayName/photoURL that linkWithPopup may have overwritten.
      // This MUST run AFTER refreshAuthUserState (which reloads) so updateProfile’s
      // restored values aren’t undone by a subsequent reload().
      await restoreProfileFromFirestore(result.user);
    } catch (error: any) {
      if (error?.code === 'auth/credential-already-in-use') {
        error.credential = FacebookAuthProvider.credentialFromError(error) ?? null;
      }
      throw error;
    }
  };

  /** Upgrade Facebook photoURL from redirect URL to direct CDN URL using Graph API. */
  const resolveFacebookPhoto = async (result: Awaited<ReturnType<typeof signInWithPopup>>) => {
    try {
      const credential = FacebookAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      if (!accessToken) return;
      await resolveFbPhotoWithToken(result.user, accessToken);
    } catch {
      // Silently ignore — fall back to whatever photoURL Firebase stored
    }
  };

  /**
   * Resolve the real Facebook CDN photo URL for a user using a raw access token.
   * Shared by `resolveFacebookPhoto` (popup result) and `completePendingLink` (saved token).
   */
  const resolveFbPhotoWithToken = async (u: User, accessToken: string): Promise<void> => {
    try {
      const res = await fetch(
        `https://graph.facebook.com/me?fields=picture.type(large)&access_token=${accessToken}`
      );
      if (!res.ok) return;
      const data = await res.json() as { picture?: { data?: { url?: string } } };
      const cdnUrl = data.picture?.data?.url;
      if (cdnUrl) {
        // Persist CDN URL as current auth photo immediately so UI can render it
        // on the first Facebook sign-in (graph redirect URLs often fail to render).
        if (u.photoURL !== cdnUrl) {
          await updateProfile(u, { photoURL: cdnUrl });
          await updateCurrentUser(auth, u);
        }

        // Keep Firestore profile in sync with the resolved social avatar.
        const token = await u.getIdToken(true);
        await fetch(`${API_BASE}/users/me`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ photoURL: cdnUrl }),
        }).catch(() => {
          // Non-critical — profile restore/history still provide fallback
        });

        // Save CDN URL in photo-history so the photo picker can find it
        // even if user.photoURL points to something else.
        try {
          const histRes = await fetch("/api/proxy/users/me/photo-history", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const existing: string[] = histRes.ok ? (await histRes.json()) ?? [] : [];
          if (!existing.includes(cdnUrl)) {
            // Prepend FB CDN URL, keeping social URLs first
            await fetch("/api/proxy/users/me/photo-history", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ photos: [cdnUrl, ...existing] }),
            });
          }
        } catch {
          // photo-history save is non-critical
        }
      }
    } catch {
      // Silently ignore
    }
  };

  const linkGoogleAccount = async () => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    try {
      const result = await linkWithPopup(user, googleProvider);
      await refreshAuthUserState(result.user);
      broadcastProviderChange();
      await syncToBackend(result.user);
      // Restore user’s custom displayName/photoURL that linkWithPopup may have overwritten.
      // This MUST run AFTER refreshAuthUserState (which reloads) so updateProfile’s
      // restored values aren’t undone by a subsequent reload().
      await restoreProfileFromFirestore(result.user);
    } catch (error: any) {
      if (error?.code === 'auth/credential-already-in-use') {
        error.credential = GoogleAuthProvider.credentialFromError(error) ?? null;
      }
      throw error;
    }
  };

  const unlinkAccount = async (providerId: string) => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    
    // Check if user has at least 2 providers
    if (user.providerData.length <= 1) {
      throw new Error("ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี");
    }
    
    await unlink(user, providerId);
    await refreshAuthUserState(user);
    broadcastProviderChange();
  };

  /**
   * Sign out the current user and sign in using a credential obtained from an
   * auth/credential-already-in-use error.  Flushes pending local data first so
   * nothing is lost on the current account.
   */
  const reauthenticateUser = async (method: "password" | "google" | "facebook", password?: string): Promise<void> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    if (method === "password") {
      if (!user.email || !password) throw new Error("กรุณาระบุรหัสผ่าน");
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } else if (method === "google") {
      await reauthenticateWithPopup(user, googleProvider);
    } else if (method === "facebook") {
      await reauthenticateWithPopup(user, facebookProvider);
    }
  };

  const deleteAccount = async (): Promise<void> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    // 1. Delete Firestore data + avatar files on backend
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE}/users/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`ลบข้อมูลไม่สำเร็จ (${res.status})`);
    // 2. Clear local cache
    await Promise.all([flushNow(), flushHistoryNow()]);
    clearUserCache();
    clearHistory();
    // 3. Delete Firebase Auth user (requires recent sign-in)
    await user.delete();
    setUser(null);
  };

  const switchToConflictingAccount = async (credential: AuthCredential): Promise<void> => {
    await Promise.all([flushNow(), flushHistoryNow()]);
    clearUserCache();
    clearHistory();
    await firebaseSignOut(auth);
    const result = await signInWithCredential(auth, credential);
    setUser(result.user);
    await syncToBackend(result.user);
    // Reload to pick up any profile updates stored on the account
    await result.user.reload();
    setUser(auth.currentUser);
    showToast({ type: "success", message: `เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ, ${result.user.displayName ?? "คุณ"}!`, duration: 3000 });
  };

  const addEmailPassword = async (password: string) => {
    if (!user || !user.email) throw new Error("ไม่พบผู้ใช้");
    const credential = EmailAuthProvider.credential(user.email, password);
    const result = await linkWithCredential(user, credential);
    await refreshAuthUserState(result.user);
    broadcastProviderChange();
    await syncToBackend(result.user);
  };

  const uploadProfilePhoto = async (file: File): Promise<string> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `อัพโหลดไม่สำเร็จ (${res.status})`);
    }
    const data = await res.json();
    // data.url is a relative path e.g. /uploads/avatars/xxx.jpg
    // prefix with /api/proxy so it resolves correctly from any host
    const url = data.url as string;
    return url.startsWith("/") ? `/api/proxy${url}` : url;
  };

  const updateUserPhotoURL = async (photoURL: string): Promise<void> => {
    if (!user) throw new Error("ไม่พบผู้ใช้");
    // Update Firebase Auth
    await updateProfile(user, { photoURL });
    await user.reload();
    setUser(auth.currentUser);
    // Update Firestore via explicit PATCH (not syncToBackend which skips photoURL on existing docs)
    const token = await user.getIdToken();
    await fetch(`${API_BASE}/users/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ photoURL }),
    });
  };

  const resendVerificationEmail = async (): Promise<void> => {
    const current = auth.currentUser;
    if (!current || current.emailVerified) return;
    await sendEmailVerification(current);
    showToast({ type: "success", message: "ส่ง verification email ใหม่แล้ว กรุณาตรวจสอบ inbox", duration: 4000 });
  };

  const getPhotoHistory = async (): Promise<string[]> => {
    if (!user) return [];
    try {
      const token = await user.getIdToken();
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
      const token = await user.getIdToken();
      await fetch("/api/proxy/users/me/photo-history", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      });
    } catch {
      // Non-critical — silently ignore
    }
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

      {/* Login modal triggered by toast */}
      {loginOpen && <LoginModalLazy isOpen={loginOpen} onClose={() => setLoginOpen(false)} />}
      {/* Link account modal — identity confirmation before auto-linking a social credential */}
      {linkAccountOpen && linkAccountEmail && linkAccountProvider && (
        <LinkAccountModalLazy
          isOpen={linkAccountOpen}
          onClose={() => setLinkAccountOpen(false)}
          email={linkAccountEmail}
          linkingProvider={linkAccountProvider}
          existingProvider={linkAccountExistingProvider}
          onSocialConfirm={linkAccountConfirmFnRef.current ?? undefined}
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

type LinkAccountModalProps = { isOpen: boolean; onClose: () => void; email: string; linkingProvider: "google" | "facebook"; existingProvider: "password" | "google" | "facebook"; onSocialConfirm?: () => Promise<void> };
function LinkAccountModalLazy(props: LinkAccountModalProps) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LinkAccountModal = require("../components/LinkAccountModal").default as (p: LinkAccountModalProps) => React.ReactElement;
  return <LinkAccountModal {...props} />;
}

export const useAuth = () => useContext(AuthContext);
