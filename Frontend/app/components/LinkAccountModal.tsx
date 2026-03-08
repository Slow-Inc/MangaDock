"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext";

export interface LinkAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The email of the existing account that needs to confirm its identity. */
  email: string;
  /** The new social provider the user just tried to sign in with. */
  linkingProvider: "google" | "facebook";
  /**
   * How the *existing* account was set up.
   * - "password" → show password input
   * - "google" | "facebook" → show social confirm button
   */
  existingProvider: "password" | "google" | "facebook";
  /** Called when the user clicks the social confirm button. Required when existingProvider !== "password". */
  onSocialConfirm?: () => Promise<void>;
}

const GoogleIcon = ({ cls = "h-5 w-5" }: { cls?: string }) => (
  <svg viewBox="0 0 24 24" className={`${cls} shrink-0`} xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const FacebookIcon = ({ cls = "h-5 w-5" }: { cls?: string }) => (
  <svg viewBox="0 0 24 24" className={`${cls} shrink-0`} fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export default function LinkAccountModal({
  isOpen,
  onClose,
  email,
  linkingProvider,
  existingProvider,
  onSocialConfirm,
}: LinkAccountModalProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { signInWithEmail } = useAuth();
  const isPasswordMode = existingProvider === "password";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setVisible(true);
        if (isPasswordMode) setTimeout(() => inputRef.current?.focus(), 50);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isOpen, isPasswordMode]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      onClose();
      setPassword("");
      setError(null);
    }, 300);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ── Password confirmation ──────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      handleClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่");
      } else if (code === "auth/too-many-requests") {
        setError("ลองบ่อยเกินไป กรุณาลองใหม่ในภายหลัง");
      } else {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Social confirmation (Google / Facebook popup) ──────────────────────
  const handleSocialConfirm = async () => {
    if (!onSocialConfirm) return;
    setError(null);
    setLoading(true);
    try {
      await onSocialConfirm();
      handleClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Labels / icons ─────────────────────────────────────────────────────
  const linkingLabel = linkingProvider === "google" ? "Google" : "Facebook";
  const LinkingProviderIcon = linkingProvider === "google" ? GoogleIcon : FacebookIcon;
  const existingLabel =
    existingProvider === "google" ? "Google" :
    existingProvider === "facebook" ? "Facebook" : "";
  const ExistingProviderIcon = existingProvider === "google" ? GoogleIcon
    : existingProvider === "facebook" ? FacebookIcon : null;
  const providerBadgeCls =
    linkingProvider === "google"
      ? "border-white/20 bg-white/10"
      : "border-[#1877F2]/40 bg-[#1877F2]/20";
  const socialBtnCls =
    existingProvider === "google"
      ? "border-white/10 bg-white/5 hover:bg-white/10"
      : "border-[#1877F2]/40 bg-[#1877F2]/20 hover:bg-[#1877F2]/30";

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
      className={`fixed inset-0 z-400 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ display: isOpen || visible ? "flex" : "none" }}
    >
      <div
        className={`relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="ปิด"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.7A1 1 0 0 0 5.7 7.12L10.59 12 5.7 16.88a1 1 0 1 0 1.42 1.42L12 13.41l4.88 4.89a1 1 0 0 0 1.42-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
          </svg>
        </button>

        <div className="flex flex-col items-center px-8 pb-8 pt-10">
          {/* Provider badge — shows which new provider is being linked */}
          <div
            className={`mb-6 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-white ${providerBadgeCls}`}
          >
            <LinkingProviderIcon />
            <span>เชื่อมบัญชีกับ {linkingLabel}</span>
          </div>

          {/* Letter avatar with link badge */}
          <div className="relative mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-3xl font-bold text-white shadow-lg ring-4 ring-white/10">
              {email.charAt(0).toUpperCase()}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0f1117] bg-blue-600 text-white shadow">
              <LinkIcon />
            </span>
          </div>

          {/* Email */}
          <p className="mb-1 text-sm font-semibold text-white">{email}</p>

          {/* Description — adapts to existing provider */}
          <p className="mb-7 text-center text-xs text-white/50 leading-relaxed">
            {isPasswordMode ? (
              <>
                บัญชีนี้ตั้งค่ารหัสผ่านไว้แล้ว<br />
                กรอกรหัสผ่านเพื่อยืนยันและเชื่อม{linkingLabel}อัตโนมัติ
              </>
            ) : (
              <>
                บัญชีนี้เชื่อมกับ {existingLabel} ไว้แล้ว<br />
                กดยืนยันด้วย {existingLabel} เพื่อเชื่อม{linkingLabel}อัตโนมัติ
              </>
            )}
          </p>

          {/* ── Password mode ── */}
          {isPasswordMode && (
            <form onSubmit={handlePasswordSubmit} className="w-full space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  รหัสผ่าน
                </label>
                <input
                  ref={inputRef}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/20 px-4 py-2.5 text-center text-xs text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    กำลังยืนยัน...
                  </span>
                ) : (
                  "ยืนยันและเชื่อมบัญชี"
                )}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-xl py-2.5 text-sm text-white/40 transition hover:text-white/70"
              >
                ยกเลิก
              </button>
            </form>
          )}

          {/* ── Social confirm mode (Google / Facebook) ── */}
          {!isPasswordMode && (
            <div className="w-full space-y-4">
              {error && (
                <p className="rounded-xl bg-red-500/20 px-4 py-2.5 text-center text-xs text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSocialConfirm}
                disabled={loading}
                className={`flex w-full items-center gap-3 rounded-xl border px-5 py-3.5 text-sm font-medium text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${socialBtnCls}`}
              >
                {loading ? (
                  <>
                    <SpinnerIcon />
                    <span>กำลังยืนยัน...</span>
                  </>
                ) : (
                  <>
                    {ExistingProviderIcon && <ExistingProviderIcon />}
                    <span>ยืนยันด้วย {existingLabel}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="w-full rounded-xl py-2.5 text-sm text-white/40 transition hover:text-white/70 disabled:opacity-50"
              >
                ยกเลิก
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
