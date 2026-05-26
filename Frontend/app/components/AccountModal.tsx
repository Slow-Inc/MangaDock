"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

type Tab = "profile" | "password" | "accounts" | "danger";
const TAB_ORDER: Tab[] = ["profile", "password", "accounts", "danger"];

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Jump to a specific tab when the modal opens. */
  initialTab?: string;
  /** Render as a full page instead of a portal overlay (for mobile). */
  asPage?: boolean;
}

export default function AccountModal({ isOpen, onClose, initialTab, asPage = false }: AccountModalProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLDivElement>(null);
  const accountsRef = useRef<HTMLDivElement>(null);
  const dangerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const [pageView, setPageView] = useState<"menu" | "detail">("menu");
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [previousPhotos, setPreviousPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Per-provider linking state — tracks which provider popup is open
  const [linking, setLinking] = useState<"google" | "facebook" | null>(null);
  const linkingResolvedRef = useRef(false);

  const { user, getIdToken, updateUserProfile, updateUserPassword, linkGoogleAccount, linkFacebookAccount, unlinkAccount, addEmailPassword, uploadProfilePhoto, updateUserPhotoURL, getPhotoHistory, savePhotoHistory, switchToConflictingAccount, deleteAccount, reauthenticateUser, resendVerificationEmail, isTranslator, userRole } = useAuth();
  const { showToast, dismissToast } = useToast();

  const [deleteStep, setDeleteStep] = useState<"idle" | "reauth" | "confirm">("idle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthenticating, setReauthenticating] = useState<"password" | "google" | "facebook" | null>(null);
  const reauthResolvedRef = useRef(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  const tabRefs: Record<Tab, React.RefObject<HTMLDivElement | null>> = {
    profile: profileRef,
    password: passwordRef,
    accounts: accountsRef,
    danger: dangerRef,
  };

  const hasGoogleProvider = user?.providerData.some(p => p.providerId === "google.com");
  const hasFacebookProvider = user?.providerData.some(p => p.providerId === "facebook.com");
  const hasPasswordProvider = user?.providerData.some(p => p.providerId === "password");

  // Photos from linked social providers.
  // Note: providerData[facebook].photoURL is a graph.facebook.com redirect that renders as a
  // silhouette. resolveFacebookPhoto() saves the real CDN URL into user.photoURL at link time.
  // If the user later switches to a different photo the CDN URL is pushed into previousPhotos —
  // so we search both user.photoURL and previousPhotos for any fbcdn / fbsbx URL.
  const socialProviderPhotos = (user?.providerData ?? [])
    .filter(p => p.providerId === "google.com" || p.providerId === "facebook.com")
    .flatMap((p): { url: string; provider: "google.com" | "facebook.com" }[] => {
      if (p.providerId === "facebook.com") {
        const allUrls = [user?.photoURL, ...previousPhotos].filter(Boolean) as string[];
        const fbCdnUrl = allUrls.find(u => u.includes("fbcdn.net") || u.includes("fbsbx.com"));
        const providerUrlOk = p.photoURL && !p.photoURL.includes("graph.facebook.com");
        const url = fbCdnUrl ?? (providerUrlOk ? p.photoURL! : null);
        return url ? [{ url, provider: "facebook.com" as const }] : [];
      }
      return p.photoURL ? [{ url: p.photoURL, provider: "google.com" as const }] : [];
    });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen && !asPage) {
      // On mobile, navigate to the dedicated account page instead of showing a modal
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        router.push(`/account${initialTab ? `?tab=${initialTab}` : ""}`);
        onClose();
        return;
      }
      // Jump to requested tab (e.g. "accounts" from provider-loss warning)
      if (initialTab && TAB_ORDER.includes(initialTab as Tab)) {
        setTab(initialTab as Tab);
      }
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else if (isOpen && asPage) {
      if (initialTab && TAB_ORDER.includes(initialTab as Tab)) {
        setTab(initialTab as Tab);
        setPageView("detail");
      } else {
        setPageView("menu");
      }
      setVisible(true);
    } else {
      setVisible(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab, asPage]);

  // Measure active panel height on tab/message/visibility change
  useEffect(() => {
    if (!isOpen || !visible || asPage) return;
    requestAnimationFrame(() => {
      const target = tabRefs[tab].current;
      if (target) setPanelHeight(target.offsetHeight);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, visible, tab, asPage, successMessage, errorMessage, showPhotoPicker, photoUploading, deleteStep, deleteConfirmText, reauthenticating, sendingVerification]);

  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      // Load photo history from Firestore (shared across all devices)
      getPhotoHistory().then(setPreviousPhotos).catch(() => setPreviousPhotos([]));
    }
    if (!isOpen) { setShowPhotoPicker(false); setPhotoError(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOpen]);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const resetTransientState = useCallback(() => {
    clearMessages();
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDeleteStep("idle");
    setDeleteConfirmText("");
    setReauthPassword("");
    setReauthenticating(null);
    setShowPhotoPicker(false);
    setPhotoError(null);
    setTab("profile");
    setPageView("menu");
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    dismissToast();
    setTimeout(() => {
      onClose();
      resetTransientState();
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, dismissToast, resetTransientState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  // Lock body scroll while open (not needed in page mode)
  useEffect(() => {
    if (isOpen && !asPage) { document.body.style.overflow = "hidden"; }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, asPage]);

  const handleTabChange = (t: Tab) => {
    clearMessages();
    setTab(t);
    setShowPhotoPicker(false);
    setPhotoError(null);
    setDeleteStep("idle");
    setDeleteConfirmText("");
    setReauthPassword("");
    if (asPage) setPageView("detail");
  };

  const handlePageBack = useCallback(() => {
    if (asPage && pageView === "detail") {
      clearMessages();
      setShowPhotoPicker(false);
      setPhotoError(null);
      setDeleteStep("idle");
      setDeleteConfirmText("");
      setReauthPassword("");
      setPageView("menu");
      return;
    }
    handleClose();
  }, [asPage, pageView, handleClose]);

  // Compute slide direction per panel
  const tabIndex = TAB_ORDER.indexOf(tab);
  const panelClass = (panelTab: Tab) => {
    const panelIndex = TAB_ORDER.indexOf(panelTab);
    const isActive = panelTab === tab;
    if (asPage) return isActive ? "block" : "hidden";
    if (isActive) return "transition-all duration-500 translate-x-0 opacity-100";
    const slideLeft = panelIndex < tabIndex;
    return `transition-all duration-500 ${slideLeft ? "-translate-x-full" : "translate-x-full"} opacity-0 absolute inset-0 pointer-events-none overflow-hidden`;
  };

  const handleUpdateProfile = async () => {
    clearMessages();
    setLoading(true);
    try {
      await updateUserProfile(displayName);
      setSuccessMessage("อัปเดตชื่อผู้ใช้สำเร็จ ✓");
    } catch (error: any) {
      setErrorMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  /** Step 1 → 2 (password): re-authenticate, then advance to confirm step. */
  const handlePasswordReauthForDelete = async () => {
    setReauthenticating("password");
    setErrorMessage(null);
    try {
      await reauthenticateUser("password", reauthPassword);
      // Reauth successful — advance to the "type to confirm" step
      setDeleteStep("confirm");
      setDeleteConfirmText("");
    } catch (error: any) {
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setErrorMessage("รหัสผ่านไม่ถูกต้อง");
      } else if (error?.code === "auth/user-mismatch") {
        setErrorMessage("รหัสผ่านนี้ไม่ตรงกับบัญชีที่กำลังจะลบ กรุณาใช้รหัสผ่านของบัญชีนี้");
      } else {
        setErrorMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setReauthenticating(null);
    }
  };

  /**
   * Step 1 → 2 (Google/Facebook): popup re-auth with focus-guard.
   * If user closes popup mid-flow, reset loading state so delete UI remains usable.
   */
  const withDeleteReauthPopupGuard = (provider: "google" | "facebook") => async () => {
    setReauthenticating(provider);
    setErrorMessage(null);
    reauthResolvedRef.current = false;

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const onFocus = () => {
      focusTimer = setTimeout(() => {
        if (!reauthResolvedRef.current) setReauthenticating(null);
      }, 2000);
    };
    window.addEventListener("focus", onFocus, { once: true });

    try {
      await reauthenticateUser(provider);
      reauthResolvedRef.current = true;
      setDeleteStep("confirm");
      setDeleteConfirmText("");
    } catch (error: any) {
      reauthResolvedRef.current = true;
      const code = error?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User closed popup — keep reauth step open and ready for retry
      } else if (code === "auth/popup-blocked") {
        setErrorMessage("เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup แล้วลองอีกครั้ง");
      } else if (code === "auth/user-mismatch") {
        setErrorMessage(`บัญชี ${provider === "google" ? "Google" : "Facebook"} ที่เลือกไม่ตรงกับบัญชีที่กำลังจะลบ กรุณาเลือกบัญชีให้ถูกต้อง`);
      } else {
        setErrorMessage(error?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      if (focusTimer) clearTimeout(focusTimer);
      setReauthenticating(null);
    }
  };

  const handleDeleteReauthGoogle = withDeleteReauthPopupGuard("google");
  const handleDeleteReauthFacebook = withDeleteReauthPopupGuard("facebook");

  /** Step 3: the actual delete, called only after typing the confirmation phrase. */
  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await deleteAccount();
      handleClose();
      showToast({
        type: "success",
        message: (
          <>
            ลบบัญชีสำเร็จแล้ว —{" "}
            <span className="font-semibold text-white">ขอบคุณที่ใช้บริการ MangaDock</span>
          </>
        ),
        duration: 5000,
      });
    } catch (error: any) {
      setErrorMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  // Core logic: change photo URL and update Firestore history (synced across all devices)
  const applyPhotoChange = async (newPhotoURL: string) => {
    const oldPhotoURL = user?.photoURL ?? null;
    await updateUserPhotoURL(newPhotoURL);
    if (user) {
      // Merge old + new + existing history, dedupe.
      // Social CDN URLs (fbcdn, lh3) are kept for badge detection but capped at 1 per provider
      // so they don't accumulate across link/unlink cycles.
      const merged = [
        ...(oldPhotoURL ? [oldPhotoURL] : []),
        newPhotoURL,
        ...previousPhotos,
      ];
      const seen = new Set<string>();
      let fbCdnCount = 0, googleCdnCount = 0;
      const deduped = merged.filter(u => {
        if (seen.has(u)) return false;
        seen.add(u);
        if (u.includes("fbcdn.net") || u.includes("fbsbx.com")) {
          return fbCdnCount++ === 0; // keep only the most recent FB CDN URL
        }
        if (u.includes("lh3.googleusercontent.com")) {
          return googleCdnCount++ === 0; // keep only the most recent Google CDN URL
        }
        return true;
      });
      // Always put social CDN URLs first so they are never pushed out by the
      // backend's slot limit (which allows up to 6 uploaded photos).
      const isSocialCdn = (u: string) =>
        u.includes("fbcdn.net") || u.includes("fbsbx.com") ||
        u.includes("lh3.googleusercontent.com");
      const socialUrls = deduped.filter(isSocialCdn);
      const uploadedUrls = deduped.filter(u => !isSocialCdn(u));
      const updated = [...socialUrls, ...uploadedUrls].slice(0, 8);
      setPreviousPhotos(updated);
      savePhotoHistory(updated);
    }
  };

  const handlePhotoSelect = async (photoURL: string) => {
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      await applyPhotoChange(photoURL);
      setShowPhotoPicker(false);
    } catch (error: any) {
      const msg = error?.code === "storage/unauthorized"
        ? "ไม่มีสิทธิ์อัพโหลด — ตรวจสอบ MangaDock Storage Rules"
        : error?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
      setPhotoError(msg);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const url = await uploadProfilePhoto(file);
      await applyPhotoChange(url);
      setShowPhotoPicker(false);
    } catch (error: any) {
      const msg = error?.code === "storage/unauthorized"
        ? "ไม่มีสิทธิ์อัพโหลด — ตรวจสอบ MangaDock Storage Rules"
        : error?.message || "อัพโหลดไม่สำเร็จ กรุณาลองใหม่";
      setPhotoError(msg);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (url: string) => {
    const filtered = previousPhotos.filter(u => u !== url);
    setPreviousPhotos(filtered);
    savePhotoHistory(filtered);
    // Delete the file from the server if it's an uploaded avatar
    if (url.includes('/uploads/avatars/')) {
      const filename = url.split('/uploads/avatars/').pop();
      if (filename) {
        try {
          const token = await getIdToken();
          await fetch('/api/proxy/users/me/avatar', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ filename }),
          });
        } catch {
          // best-effort — Firestore history is already updated
        }
      }
    }
  };

  const handleUpdatePassword = async () => {
    clearMessages();
    if (newPassword !== confirmPassword) { setErrorMessage("รหัสผ่านใหม่ไม่ตรงกัน"); return; }
    if (newPassword.length < 6) { setErrorMessage("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setLoading(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setSuccessMessage("เปลี่ยนรหัสผ่านสำเร็จ ✓");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (error: any) {
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        setErrorMessage("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      } else {
        setErrorMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmailPassword = async () => {
    clearMessages();
    if (newPassword !== confirmPassword) { setErrorMessage("รหัสผ่านไม่ตรงกัน"); return; }
    if (newPassword.length < 6) { setErrorMessage("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setLoading(true);
    try {
      await addEmailPassword(newPassword);
      setSuccessMessage("เพิ่มรหัสผ่านสำเร็จ ✓ ตอนนี้คุณสามารถ login ด้วย Email ได้แล้ว");
      setNewPassword(""); setConfirmPassword("");
    } catch (error: any) {
      if (error.code === "auth/provider-already-linked") {
        setErrorMessage("เชื่อมต่อ Email/Password อยู่แล้ว");
      } else {
        setErrorMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setLoading(false);
    }
  };

  // Attach a window-focus listener while a provider popup is open.
  // If the main window regains focus and the popup hasn't resolved within 2 s,
  // the user closed it — force-reset the linking state.
  const withFocusGuard = (provider: "google" | "facebook", fn: () => Promise<void>) => async () => {
    clearMessages();
    setLinking(provider);
    linkingResolvedRef.current = false;

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const onFocus = () => {
      focusTimer = setTimeout(() => {
        if (!linkingResolvedRef.current) setLinking(null);
      }, 2000);
    };
    window.addEventListener("focus", onFocus, { once: true });

    try {
      await fn();
      linkingResolvedRef.current = true;
      setSuccessMessage(`เชื่อมต่อบัญชี ${provider === "google" ? "Google" : "Facebook"} สำเร็จ ✓`);
    } catch (error: any) {
      linkingResolvedRef.current = true;
      const code = error?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User closed the popup — not an error, just silently reset
      } else if (code === "auth/credential-already-in-use") {
        const credential = (error as any).credential;
        if (credential) {
          showConflict({ credential, provider });
        } else {
          setErrorMessage(`บัญชี ${provider === "google" ? "Google" : "Facebook"} นี้เชื่อมต่อกับผู้ใช้อื่นแล้ว`);
        }
      } else if (code === "auth/provider-already-linked") {
        setErrorMessage(`เชื่อมต่อกับ ${provider === "google" ? "Google" : "Facebook"} อยู่แล้ว`);
      } else {
        setErrorMessage(error?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      if (focusTimer) clearTimeout(focusTimer);
      setLinking(null);
    }
  };

  const showConflict = (info: { credential: any; provider: "google" | "facebook" }) => {
    showToast({
      type: "warning",
      message: (
        <>
          บัญชี <span className="font-semibold text-white">{info.provider === "google" ? "Google" : "Facebook"}</span> นี้ผูกกับ MangaDock อีกบัญชีอยู่แล้ว
        </>
      ),
      duration: 0, // no auto-dismiss — user must act
      action: {
        label: "เข้าบัญชีนั้น",
        onClick: async () => {
          try {
            await switchToConflictingAccount(info.credential);
            handleClose();
          } catch (error: any) {
            setErrorMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
          }
        },
      },
    });
  };

  const handleLinkGoogle = withFocusGuard("google", linkGoogleAccount);
  const handleLinkFacebook = withFocusGuard("facebook", linkFacebookAccount);

  const handleUnlinkProvider = async (providerId: string) => {
    clearMessages();
    setLoading(true);
    try {
      await unlinkAccount(providerId);
      setSuccessMessage("ยกเลิกการเชื่อมต่อสำเร็จ ✓");
    } catch (error: any) {
      setErrorMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (!asPage && !mounted) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "profile",
      label: "ข้อมูลส่วนตัว",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: "password",
      label: hasPasswordProvider ? "รหัสผ่าน" : "เพิ่มรหัสผ่าน",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      id: "accounts",
      label: "การเชื่อมต่อ",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      id: "danger",
      label: "โซนอันตราย",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
    },
  ];

  const activeTabMeta = tabs.find((item) => item.id === tab) ?? tabs[0];
  const isPageMenu = asPage && pageView === "menu";

  const getTabDescription = (tabId: Tab) => {
    switch (tabId) {
      case "profile":
        return "แก้ไขชื่อผู้ใช้ อีเมล และรูปโปรไฟล์";
      case "password":
        return hasPasswordProvider ? "เปลี่ยนรหัสผ่านและความปลอดภัยของบัญชี" : "ตั้งรหัสผ่านเพื่อเข้าสู่ระบบด้วยอีเมล";
      case "accounts":
        return "เชื่อมต่อหรือยกเลิกการเชื่อมต่อ Google และ Facebook";
      case "danger":
        return "ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร";
    }
  };

  const getTabStatus = (tabId: Tab) => {
    switch (tabId) {
      case "profile":
        return user.emailVerified ? "พร้อมใช้งาน" : "รอยืนยันอีเมล";
      case "password":
        return hasPasswordProvider ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้ง";
      case "accounts": {
        const linkedProviders = [hasGoogleProvider, hasFacebookProvider, hasPasswordProvider].filter(Boolean).length;
        return `เชื่อม ${linkedProviders} วิธี`;
      }
      case "danger":
        return "ระวัง";
    }
  };

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30";
  const labelClass = "block text-xs font-medium text-white/50 mb-1.5";

  const mobileSectionMenu = (
    <div className="space-y-3 px-4 py-5 sm:px-6">
      <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <p className="text-sm font-semibold text-white">หมวดการจัดการบัญชี</p>
        <p className="mt-1 text-xs text-white/45">เลือกหัวข้อที่ต้องการจัดการ แล้วค่อยเข้าไปแก้ไขในหน้าย่อย</p>
      </div>

      {tabs.map((section) => {
        const isDanger = section.id === "danger";
        return (
          <button
            key={section.id}
            onClick={() => handleTabChange(section.id)}
            className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition active:scale-[0.99] ${
              isDanger
                ? "border-red-500/25 bg-red-500/8 hover:bg-red-500/12"
                : "border-white/10 bg-white/4 hover:bg-white/7"
            }`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isDanger ? "bg-red-500/12 text-red-300" : "bg-white/8 text-white/75"}`}>
              {section.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${isDanger ? "text-red-300" : "text-white"}`}>{section.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isDanger ? "bg-red-500/12 text-red-300" : "bg-white/8 text-white/45"}`}>
                  {getTabStatus(section.id)}
                </span>
              </div>
              <p className={`mt-1 text-xs ${isDanger ? "text-red-200/65" : "text-white/45"}`}>{getTabDescription(section.id)}</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 shrink-0 ${isDanger ? "text-red-300/70" : "text-white/30"}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </div>
  );

  const modalCard = (
    <div className={asPage
      ? "relative flex w-full flex-col"
      : `relative flex w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl transition-all duration-300 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`
    }>
        {/* Header */}
        <div className="border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              {/* Clickable avatar */}
              <button
                onClick={() => { setShowPhotoPicker(p => !p); setPhotoError(null); }}
                disabled={photoUploading}
                title="เปลี่ยนรูปโปรไฟล์"
                aria-label="เปลี่ยนรูปโปรไฟล์"
                className="group relative h-14 w-14 shrink-0 focus:outline-none"
              >
                {user.photoURL ? (
                  <div className="relative h-14 w-14 rounded-full overflow-hidden ring-2 ring-white/10">
                    <Image
                      src={user.photoURL}
                      alt={user.displayName ?? "User"}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized={user.photoURL.toLowerCase().endsWith('.gif') || user.photoURL.includes('graph.facebook.com')}
                    />
                  </div>
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold uppercase ring-2 ring-white/10">
                    {(user.displayName ?? user.email ?? "U")[0]}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition group-hover:opacity-100">
                  {photoUploading ? (
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.415.586H8v-2.414a2 2 0 01.586-1.414L9 13z" />
                    </svg>
                  )}
                </div>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{user.displayName || "ผู้ใช้"}</p>
                  {isTranslator && (
                    <span className="rounded-full bg-indigo-600/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                      {userRole === "admin" ? "Admin" : userRole === "creator" ? "Creator" : "นักแปล"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-white/25">คลิกที่รูปเพื่อเปลี่ยน</p>
              </div>
            </div>
            {!asPage && (
              <button
                onClick={handleClose}
                aria-label="ปิด"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.7A1 1 0 0 0 5.7 7.12L10.59 12 5.7 16.88a1 1 0 1 0 1.42 1.42L12 13.41l4.88 4.89a1 1 0 0 0 1.42-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
                </svg>
              </button>
            )}
          </div>

          {/* Photo picker — slides open below header */}
          <div className={`overflow-hidden transition-all duration-300 ${showPhotoPicker ? "max-h-60" : "max-h-0"}`}>
            <div className="border-t border-white/10 bg-black/20 px-6 py-3">
              {photoError && (
                <div className="mb-2.5 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-[11px] text-red-300">
                  {photoError}
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoUploading}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {photoUploading ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      กำลังอัพโหลด...
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      อัพโหลดใหม่
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="อัพโหลดรูปโปรไฟล์ใหม่"
                  title="อัพโหลดรูปโปรไฟล์ใหม่"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Social provider photos with platform badge */}
                {socialProviderPhotos.map(({ url, provider }) => {
                  const isGoogle = provider === "google.com";
                  const isCurrent = user?.photoURL === url;
                  return (
                    <div key={provider} className="relative">
                      <button
                        onClick={() => handlePhotoSelect(url)}
                        disabled={photoUploading || isCurrent}
                        title={`ใช้รูปจาก ${isGoogle ? "Google" : "Facebook"}`}
                        aria-label={`ใช้รูปจาก ${isGoogle ? "Google" : "Facebook"}`}
                        className={`relative h-9 w-9 overflow-hidden rounded-full transition focus:outline-none disabled:opacity-50 ${
                          isCurrent ? "ring-2 ring-blue-400" : "ring-2 ring-white/10 hover:ring-white/50"
                        }`}
                      >
                        <Image src={url} alt={isGoogle ? "Google photo" : "Facebook photo"} fill sizes="36px" className="object-cover" unoptimized={url.toLowerCase().endsWith('.gif')} />
                      </button>
                      {/* Platform badge */}
                      <div className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ${isGoogle ? "bg-white" : "bg-[#1877F2]"}`}>
                        {isGoogle ? (
                          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="white">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Previously used photos — exclude social CDN URLs (covered by badges) */}
                {(() => {
                  const isSocialCdnUrl = (url: string) =>
                    url.includes("fbcdn.net") || url.includes("fbsbx.com") ||
                    url.includes("lh3.googleusercontent.com");
                  const prevDisplay = previousPhotos.filter(
                    url => !socialProviderPhotos.some(s => s.url === url) && !isSocialCdnUrl(url)
                  );
                  if (prevDisplay.length === 0) return socialProviderPhotos.length === 0 ? (
                    <p className="text-xs text-white/30">ไม่มีรูปที่เคยใช้</p>
                  ) : null;
                  return (
                    <div className="flex flex-wrap gap-2">
                      {prevDisplay.map((url) => {
                        const isCurrent = user?.photoURL === url;
                        return (
                          <div key={url} className="group relative">
                            <button
                              onClick={() => handlePhotoSelect(url)}
                              disabled={photoUploading || isCurrent}
                              title="เลือกรูปนี้"
                              aria-label="เลือกรูปโปรไฟล์ที่เคยใช้"
                              className={`relative h-9 w-9 overflow-hidden rounded-full ring-2 transition focus:outline-none disabled:opacity-50 ${
                                isCurrent ? "ring-blue-400" : "ring-white/10 hover:ring-white/50"
                              }`}
                            >
                              <Image src={url} alt="previous photo" fill sizes="36px" className="object-cover" unoptimized={url.toLowerCase().endsWith('.gif') || url.includes('/uploads/')} />
                            </button>
                            {/* Delete button — only visible on hover */}
                            <button
                              onClick={() => handleDeletePhoto(url)}
                              disabled={photoUploading}
                              title="ลบรูปนี้"
                              aria-label="ลบรูปโปรไฟล์นี้ออกจากประวัติ"
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity hover:bg-red-600 focus:outline-none group-hover:opacity-100 disabled:cursor-not-allowed pointer-events-none group-hover:pointer-events-auto"
                            >
                              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        {isPageMenu ? (
          <div className="account-page-panel account-page-panel-menu-enter">
            {mobileSectionMenu}
          </div>
        ) : (
          <div className="account-page-panel account-page-panel-detail-enter">
            {!asPage && (
              <div className="flex gap-1 border-b border-white/10 px-6 pt-4">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTabChange(t.id)}
                    className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                      t.id === "danger"
                        ? `ml-auto ${tab === "danger" ? "bg-red-500/15 text-red-400" : "text-red-400/40 hover:text-red-400/70"}`
                        : tab === t.id
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white/3 px-6 py-5">
              {asPage && (
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className={`text-sm font-semibold ${tab === "danger" ? "text-red-300" : "text-white"}`}>{activeTabMeta.label}</p>
                    <p className="mt-1 text-xs text-white/45">{getTabDescription(tab)}</p>
                  </div>
                  <button
                    onClick={handlePageBack}
                    className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
                  >
                    เปลี่ยนหมวด
                  </button>
                </div>
              )}

              <div
                className="relative overflow-hidden transition-[height] duration-500"
                style={asPage ? undefined : (panelHeight ? { height: `${panelHeight}px` } : undefined)}
              >

              {/* ─── Profile panel ─── */}
              <div ref={profileRef} className={panelClass("profile")}>
              {successMessage && <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">{successMessage}</div>}
              {errorMessage && <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">{errorMessage}</div>}
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>ชื่อผู้ใช้</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="ชื่อของคุณ" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>อีเมล</label>
                  <input type="email" value={email} disabled title="อีเมล (ไม่สามารถแก้ไขได้)" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 outline-none cursor-not-allowed" />
                  <p className="text-[11px] text-white/30 mt-1.5">ไม่สามารถเปลี่ยนอีเมลได้ในขณะนี้</p>
                </div>
                <button onClick={handleUpdateProfile} disabled={loading || !displayName.trim()} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>

                {/* ── Translator studio shortcut ── */}
                <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white/70">สตูดิโอนักแปล</p>
                      <p className="text-[11px] text-white/30">
                        {isTranslator ? "จัดการงานแปลและอัปโหลดใหม่" : "สมัครเพื่อเริ่มอัปโหลดงานแปล"}
                      </p>
                    </div>
                    <Link
                      href="/studio"
                      className="rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-600/30"
                    >
                      {isTranslator ? "เปิดสตูดิโอ" : "สมัคร"}
                    </Link>
                  </div>
                </div>
              </div>

            </div>

              {/* ─── Password panel ─── */}
              <div ref={passwordRef} className={panelClass("password")}>
              {successMessage && <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">{successMessage}</div>}
              {errorMessage && <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">{errorMessage}</div>}

              {hasPasswordProvider ? (
                /* ── Change existing password ── */
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>รหัสผ่านปัจจุบัน</label>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>รหัสผ่านใหม่</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="•••••••• (อย่างน้อย 6 ตัว)" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>ยืนยันรหัสผ่านใหม่</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
                  </div>
                  <button onClick={handleUpdatePassword} disabled={loading || !currentPassword || !newPassword || !confirmPassword} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
                  </button>
                </div>
              ) : (
                /* ── Add password to Google-only account ── */
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                    <p className="text-xs text-blue-300">ℹ️ เพิ่มรหัสผ่านเพื่อให้สามารถ login ด้วย Email <strong>{user?.email}</strong> ได้โดยไม่ต้องใช้ Google</p>
                  </div>
                  <div>
                    <label className={labelClass}>รหัสผ่านใหม่</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="•••••••• (อย่างน้อย 6 ตัว)" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>ยืนยันรหัสผ่าน</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
                  </div>
                  <button onClick={handleAddEmailPassword} disabled={loading || !newPassword || !confirmPassword} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? "กำลังเพิ่มรหัสผ่าน..." : "เพิ่มรหัสผ่าน"}
                  </button>
                </div>
              )}
            </div>

              {/* ─── Accounts panel ─── */}
              <div ref={accountsRef} className={panelClass("accounts")}>
              {successMessage && <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">{successMessage}</div>}
              {errorMessage && <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">{errorMessage}</div>}
              <div className="space-y-3">
                {/* Email/Password */}
                <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                  {/* Row 1: icon + label + connection badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-500">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">อีเมล/รหัสผ่าน</p>
                        <p className="text-xs text-white/40">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {hasPasswordProvider ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300">
                          เชื่อมต่อแล้ว
                        </span>
                      ) : (
                        <div className="group relative flex items-center">
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 cursor-default select-none">
                            ไม่ได้ตั้งค่า
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 text-[9px] font-bold leading-none">
                              i
                            </span>
                          </span>
                          <div className="absolute top-full right-0 pt-2 hidden group-hover:block z-50">
                            <div className="w-52 rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-[11px] text-white/70 shadow-xl backdrop-blur-xl">
                              ไปที่แท็บ{" "}
                              <strong
                                className="text-white underline decoration-white/40 cursor-pointer hover:text-amber-300 hover:decoration-amber-300"
                                onClick={() => handleTabChange("password")}
                              >
                                เพิ่มรหัสผ่าน
                              </strong>{" "}
                              เพื่อตั้งรหัสผ่าน แล้วจะสามารถ Login ด้วย Email ได้โดยไม่ต้องใช้ Google
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: email verification status + resend button */}
                  <div className="flex items-center justify-between pl-12">
                    {user.emailVerified ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-green-400/80">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        ยืนยัน email แล้ว
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.17 14.17A1 1 0 003 19.5h18a1 1 0 00.88-1.47L13.71 3.86a2 2 0 00-3.52.14z" />
                        </svg>
                        ยังไม่ได้ยืนยัน email
                      </span>
                    )}
                    {!user.emailVerified && (
                      <button
                        onClick={async () => {
                          setSendingVerification(true);
                          try {
                            await resendVerificationEmail();
                          } catch {
                            showToast({ type: "error", message: "ส่ง email ไม่สำเร็จ ลองใหม่ภายหลัง", duration: 4000 });
                          } finally {
                            setSendingVerification(false);
                          }
                        }}
                        disabled={sendingVerification}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/20 active:scale-95 disabled:opacity-50"
                      >
                        {sendingVerification ? (
                          <>
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                            กำลังส่ง…
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            ส่ง email ยืนยัน
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {/* Facebook */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
                        <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">Facebook</p>
                      <p className="text-xs text-white/40">เข้าสู่ระบบด้วยบัญชี Facebook</p>
                    </div>
                  </div>
                  {hasFacebookProvider ? (
                    <button onClick={() => handleUnlinkProvider("facebook.com")} disabled={loading || !!linking || (!hasPasswordProvider && !hasGoogleProvider)} title={(!hasPasswordProvider && !hasGoogleProvider) ? "ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี" : ""} className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed">ยกเลิก</button>
                  ) : (
                    <button onClick={handleLinkFacebook} disabled={!!linking || loading} className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {linking === "facebook" ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                          กำลังเชื่อมต่อ…
                        </span>
                      ) : "เชื่อมต่อ"}
                    </button>
                  )}
                </div>
                {/* Google */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="h-5 w-5">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">Google</p>
                      <p className="text-xs text-white/40">เข้าสู่ระบบด้วยบัญชี Google</p>
                    </div>
                  </div>
                  {hasGoogleProvider ? (
                    <button onClick={() => handleUnlinkProvider("google.com")} disabled={loading || !!linking || (!hasPasswordProvider && !hasFacebookProvider)} title={(!hasPasswordProvider && !hasFacebookProvider) ? "ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี" : ""} className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed">ยกเลิก</button>
                  ) : (
                    <button onClick={handleLinkGoogle} disabled={!!linking || loading} className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {linking === "google" ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                          กำลังเชื่อมต่อ…
                        </span>
                      ) : "เชื่อมต่อ"}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-white/30 pt-1">💡 เชื่อมต่อบัญชีหลายแบบเพื่อเข้าสู่ระบบได้หลายวิธี</p>
              </div>
            </div>

              {/* ─── Danger panel ─── */}
              <div ref={dangerRef} className={panelClass("danger")}>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">

                {/* ── Header (always visible) ── */}
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.17 14.17A1 1 0 003 19.5h18a1 1 0 00.88-1.47L13.71 3.86a2 2 0 00-3.52.14z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-300">ลบบัญชีถาวร</p>
                    <p className="text-xs text-white/50 mt-0.5">ข้อมูลทั้งหมดจะถูกลบอย่างถาวร ไม่สามารถย้อนกลับได้</p>
                  </div>
                </div>

                {/* ── Bullet list of what gets deleted ── */}
                <ul className="space-y-1.5 text-xs text-white/40 pl-1">
                  <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />ประวัติการอ่านทั้งหมด</li>
                  <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />รายการโปรดทั้งหมด</li>
                  <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />รูปโปรไฟล์ที่อัปโหลดทั้งหมด</li>
                  <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />บัญชีผู้ใช้และข้อมูลทั้งหมด</li>
                </ul>

                {/* ── Error message ── */}
                {errorMessage && (
                  <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
                    {errorMessage}
                  </div>
                )}

                {/* ══════════════════════════════════════════════
                     STEP 1 — idle: show the initial delete button
                ══════════════════════════════════════════════ */}
                {deleteStep === "idle" && (
                  <button
                    onClick={() => { clearMessages(); setDeleteStep("reauth"); }}
                    className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-95"
                  >
                    ลบบัญชีของฉัน
                  </button>
                )}

                {/* ══════════════════════════════════════════════
                     STEP 2 — reauth: show provider options
                ══════════════════════════════════════════════ */}
                {deleteStep === "reauth" && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-yellow-300/80">
                      เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยวิธีที่คุณเชื่อมต่อไว้
                    </p>

                    {/* Password provider */}
                    {hasPasswordProvider && (
                      <div className="space-y-2">
                        <input
                          type="password"
                          value={reauthPassword}
                          onChange={(e) => setReauthPassword(e.target.value)}
                          placeholder="รหัสผ่านของคุณ"
                          autoFocus
                          className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/30"
                          onKeyDown={(e) => { if (e.key === "Enter" && reauthPassword) handlePasswordReauthForDelete(); }}
                        />
                        <button
                          onClick={handlePasswordReauthForDelete}
                          disabled={!reauthPassword || !!reauthenticating}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-600 py-2.5 text-sm font-semibold text-white transition hover:bg-yellow-500 active:scale-95 disabled:opacity-50"
                        >
                          {reauthenticating === "password" ? (
                            <>
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                              กำลังยืนยัน…
                            </>
                          ) : "ยืนยันด้วยรหัสผ่าน"}
                        </button>
                      </div>
                    )}

                    {/* Divider when password + social both exist */}
                    {hasPasswordProvider && (hasGoogleProvider || hasFacebookProvider) && (
                      <div className="flex items-center gap-2">
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="text-[10px] text-white/30">หรือ</span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                    )}

                    {/* Google provider */}
                    {hasGoogleProvider && (
                      <button
                        onClick={handleDeleteReauthGoogle}
                        disabled={!!reauthenticating}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
                      >
                        {reauthenticating === "google" ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        )}
                        {reauthenticating === "google" ? "กำลังยืนยัน…" : "ยืนยันด้วย Google"}
                      </button>
                    )}

                    {/* Facebook provider */}
                    {hasFacebookProvider && (
                      <button
                        onClick={handleDeleteReauthFacebook}
                        disabled={!!reauthenticating}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 py-2.5 text-sm font-semibold text-[#74a9f5] transition hover:bg-[#1877F2]/20 active:scale-95 disabled:opacity-50"
                      >
                        {reauthenticating === "facebook" ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                        {reauthenticating === "facebook" ? "กำลังยืนยัน…" : "ยืนยันด้วย Facebook"}
                      </button>
                    )}

                    {/* Cancel */}
                    <button
                      onClick={() => { setDeleteStep("idle"); setReauthPassword(""); clearMessages(); }}
                      disabled={!!reauthenticating}
                      className="w-full rounded-xl border border-white/15 py-2 text-xs font-medium text-white/40 transition hover:bg-white/5 hover:text-white/60 active:scale-95"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}

                {/* ══════════════════════════════════════════════
                     STEP 3 — confirm: type "ลบบัญชี" to proceed
                ══════════════════════════════════════════════ */}
                {deleteStep === "confirm" && (
                  <div className="space-y-3">
                    {/* Danger warning */}
                    <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 space-y-1">
                      <p className="text-xs font-semibold text-red-300">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
                      <p className="text-[11px] text-white/40">
                        ข้อมูล รูปโปรไฟล์ ประวัติการอ่าน และรายการโปรดทั้งหมดจะหายไปตลอดกาล
                      </p>
                    </div>

                    {/* GitHub-style confirmation input */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-white/50">
                        พิมพ์ <span className="font-mono font-semibold text-red-300">ลบบัญชี</span> เพื่อยืนยัน
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => { setDeleteConfirmText(e.target.value); clearMessages(); }}
                        placeholder="ลบบัญชี"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none font-mono transition focus:border-red-400/60 focus:ring-1 focus:ring-red-400/30"
                        onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmText === "ลบบัญชี") handleDeleteAccount(); }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== "ลบบัญชี" || loading}
                        className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {loading ? "กำลังลบ..." : "ลบบัญชีนี้"}
                      </button>
                      <button
                        onClick={() => { setDeleteStep("idle"); setDeleteConfirmText(""); clearMessages(); }}
                        disabled={loading}
                        className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80 active:scale-95"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (asPage) {
    return (
      <div className="min-h-dvh bg-[#141414] pb-[calc(var(--mobile-nav-height)+2rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#141414]/90 px-4 py-3 backdrop-blur-xl">
          <button
            onClick={handlePageBack}
            aria-label="กลับ"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{isPageMenu ? "จัดการบัญชี" : activeTabMeta.label}</p>
            <p className="text-[11px] text-white/40">{isPageMenu ? "เลือกหมวดที่ต้องการจัดการ" : "จัดการข้อมูลในหมวดนี้"}</p>
          </div>
        </div>
        {modalCard}
      </div>
    );
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      className={`fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ display: isOpen || visible ? "flex" : "none" }}
    >
      {modalCard}
    </div>,
    document.body
  );
}
