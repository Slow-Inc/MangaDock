"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { getDisposableEmailError, normalizeEmail } from "../lib/emailValidation";
import { useModalTransition } from "../hooks/useModalTransition";

type Mode = "login" | "register" | "forgot-password";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const overlayRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLFormElement>(null);
  const registerRef = useRef<HTMLFormElement>(null);
  const forgotPasswordRef = useRef<HTMLFormElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const { signInWithGoogle, signInWithFacebook, signUpWithEmail, signInWithEmail, sendPasswordReset } = useAuth();

  const { mounted, visible, close } = useModalTransition(isOpen, {
    duration: 300,
    onClosed: onClose,
  });

  const signInWithPopupGuard = (provider: "google" | "facebook", fn: () => Promise<void>) => async () => {
    setAuthError(null);
    setSocialLoading(provider);
    try {
      await fn();
      close();
      setTimeout(() => setSocialLoading(null), 400);
    } catch (e: unknown) {
      setSocialLoading(null);
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // silent
      } else if (code === "auth/popup-blocked") {
        setAuthError("เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup แล้วลองอีกครั้ง");
      } else if (code === "auth/credential-already-in-use") {
        setAuthError("บัญชีนี้เชื่อมต่อกับ MangaDock อีกบัญชีอยู่แล้ว กรุณาลองเข้าสู่ระบบด้วยวิธีอื่น");
      } else {
        setAuthError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !visible) return;
    requestAnimationFrame(() => {
      const target =
        mode === "login" ? loginRef.current :
        mode === "register" ? registerRef.current :
        forgotPasswordRef.current;
      if (target) setPanelHeight(target.offsetHeight);
    });
  }, [isOpen, visible, mode]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      close();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setAuthError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (err.code === "auth/invalid-email") {
        setAuthError("รูปแบบอีเมลไม่ถูกต้อง");
      } else if (err.code === "auth/too-many-requests") {
        setAuthError("ลองเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ในภายหลัง");
      } else {
        setAuthError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const normalizedEmail = normalizeEmail(registerEmail);
    const disposableEmailError = getDisposableEmailError(normalizedEmail);
    if (disposableEmailError) { setAuthError(disposableEmailError); return; }
    if (registerPassword !== registerConfirmPassword) {
      setAuthError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    setAuthLoading(true);
    try {
      await signUpWithEmail(normalizedEmail, registerPassword, registerName.trim());
      close();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === "auth/email-already-in-use") {
        setAuthError("อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทนการสมัครใหม่");
      } else if (err.code === "auth/weak-password") {
        setAuthError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      } else if (err.code === "auth/invalid-email") {
        setAuthError("รูปแบบอีเมลไม่ถูกต้อง");
      } else if (err.code === "auth/operation-not-allowed") {
        setAuthError("ระบบยังไม่เปิดให้สมัครด้วยอีเมลและรหัสผ่านในขณะนี้");
      } else if (err.code === "auth/too-many-requests") {
        setAuthError("ลองสมัครบ่อยเกินไป กรุณาลองใหม่ในภายหลัง");
      } else if (err.code === "auth/network-request-failed") {
        setAuthError("ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
      } else if (err.code === "auth/internal-error") {
        setAuthError("ระบบสมัครสมาชิกขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง");
      } else {
        setAuthError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const normalizedEmail = normalizeEmail(forgotPasswordEmail);
    if (!normalizedEmail) { setAuthError("กรุณากรอกอีเมลก่อนกดลืมรหัสผ่าน"); return; }
    setAuthLoading(true);
    try {
      await sendPasswordReset(normalizedEmail);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === "auth/invalid-email") {
        setAuthError("รูปแบบอีเมลไม่ถูกต้อง");
      } else if (err.code === "auth/too-many-requests") {
        setAuthError("คุณขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณาลองใหม่ในภายหลัง");
      } else if (err.code === "auth/network-request-failed") {
        setAuthError("ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
      } else {
        setAuthError(err.message || "ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้ กรุณาลองใหม่");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const openForgotPassword = () => {
    setAuthError(null);
    setForgotPasswordEmail(normalizeEmail(loginEmail));
    setMode("forgot-password");
  };

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30";
  const submitCls = "w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
      className={`fixed inset-0 z-[300] flex items-end md:items-center justify-center md:p-4 bg-black/70 md:bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`relative w-full md:max-w-3xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          visible
            ? "translate-y-0 md:scale-100 md:opacity-100"
            : "translate-y-full md:translate-y-0 md:scale-95 md:opacity-0"
        }`}
      >
        {/* ── OAuth Loading Overlay ── */}
        <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300 rounded-t-[28px] md:rounded-3xl pointer-events-none ${
          socialLoading ? "opacity-100" : "opacity-0"
        }`}>
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-xl">
            {socialLoading === "google" ? (
              <svg viewBox="0 0 24 24" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            ) : socialLoading === "facebook" ? (
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
            ) : null}
          </div>
          <svg className="mb-4 h-7 w-7 animate-spin text-white/50" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          <p className="text-sm font-semibold text-white">
            {socialLoading === "google" ? "กำลังรอการยืนยันจาก Google" : "กำลังรอการยืนยันจาก Facebook"}
          </p>
          <p className="mt-1.5 text-xs text-white/40">โปรดดำเนินการในหน้าต่างที่เปิดขึ้น</p>
        </div>

        {/* ── Close button ── */}
        <button
          onClick={close}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="ปิด"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.7A1 1 0 0 0 5.7 7.12L10.59 12 5.7 16.88a1 1 0 1 0 1.42 1.42L12 13.41l4.88 4.89a1 1 0 0 0 1.42-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
          </svg>
        </button>

        {/* ════════════════════════════════════════
            Bottom Sheet (mobile) / Modal (desktop)
            flex-col → flex-row at md
            social panel order swaps to TOP on mobile
        ════════════════════════════════════════ */}
        <div
          className="flex flex-col md:flex-row bg-[#111116] md:bg-white/5 md:backdrop-blur-2xl rounded-t-[28px] md:rounded-3xl border border-white/10 border-b-0 md:border-b overflow-y-auto overflow-x-hidden md:overflow-hidden max-h-[92dvh] shadow-2xl no-scrollbar"
        >
          {/* Drag handle — mobile only, sticky so it stays visible while scrolling */}
          <div className="md:hidden flex justify-center pt-3 pb-1 sticky top-0 z-10 bg-[#111116]">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* ════════════════
              SOCIAL PANEL
              mobile: order-1 (TOP)
              desktop: order-2 (RIGHT)
          ════════════════ */}
          <div className="order-1 md:order-2 md:w-1/2 shrink-0 flex flex-col gap-3 px-6 pt-5 pb-4 md:px-10 md:py-12 md:bg-white/5 md:border-l md:border-white/10 md:justify-center">

            {/* Header — mobile only */}
            <div className="md:hidden mb-1">
              <p className="text-lg font-black text-white tracking-tight">
                {mode === "register" ? "สร้างบัญชีใหม่" : mode === "forgot-password" ? "ลืมรหัสผ่าน" : "ยินดีต้อนรับ"}
              </p>
              <p className="text-xs text-white/40 mt-0.5">เข้าถึงฟีเจอร์ทั้งหมดของ MangaDock</p>
            </div>

            <p className="hidden md:block text-sm font-semibold text-white/50 mb-1 text-center">เข้าสู่ระบบด้วย</p>

            {authError && (
              <p className="rounded-xl bg-red-500/20 px-4 py-2.5 text-center text-xs text-red-300 leading-relaxed">{authError}</p>
            )}

            {/* Google */}
            <button
              onClick={signInWithPopupGuard("google", signInWithGoogle)}
              disabled={!!socialLoading || authLoading}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-white/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {socialLoading === "google" ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                  กำลังเข้าสู่ระบบ…
                </span>
              ) : <span>เข้าสู่ระบบด้วย Google</span>}
            </button>

            {/* Facebook */}
            <button
              onClick={signInWithPopupGuard("facebook", signInWithFacebook)}
              disabled={!!socialLoading || authLoading}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#1877F2]/20 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-[#1877F2]/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
              {socialLoading === "facebook" ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                  กำลังเข้าสู่ระบบ…
                </span>
              ) : <span>เข้าสู่ระบบด้วย Facebook</span>}
            </button>

            {/* OR divider — mobile only (between social top and form bottom) */}
            <div className="md:hidden flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] font-bold text-white/25 tracking-widest uppercase">หรือใช้อีเมล</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Terms — desktop only (mobile Terms is in form panel bottom) */}
            <p className="hidden md:block mt-4 text-center text-[11px] text-white/25 leading-relaxed">
              การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
              <span className="underline underline-offset-2 cursor-pointer hover:text-white/50">ข้อกำหนดการใช้งาน</span>
              {" "}และ{" "}
              <span className="underline underline-offset-2 cursor-pointer hover:text-white/50">นโยบายความเป็นส่วนตัว</span>
            </p>
          </div>

          {/* ════════════════
              FORM PANEL
              mobile: order-2 (BOTTOM, scrollable)
              desktop: order-1 (LEFT)
          ════════════════ */}
          <div className="order-2 md:order-1 md:w-1/2 flex flex-col px-6 pt-2 pb-4 md:p-10 md:overflow-hidden">
            {/* Tab switcher — sliding pill indicator */}
            <div className="relative mb-5 flex rounded-xl border border-white/10 bg-white/5 p-1 md:mb-8 shrink-0">
              <div
                className={`absolute top-1 bottom-1 rounded-lg bg-white/15 shadow transition-all duration-300 ease-in-out ${
                  mode === "register" ? "left-[calc(50%+2px)] right-1" : "left-1 right-[calc(50%+2px)]"
                }`}
              />
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors duration-300 ${
                    (m === "login" ? mode === "login" || mode === "forgot-password" : mode === m)
                      ? "text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {m === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                </button>
              ))}
            </div>

            {/* Form panels — outer div animates height, inner div clips horizontal slide */}
            <div
              className="overflow-hidden transition-[height] duration-500 ease-in-out"
              style={panelHeight ? { height: `${panelHeight}px` } : undefined}
            >
            <div className="relative overflow-hidden">
              {/* Login */}
              <form
                ref={loginRef}
                onSubmit={handleLoginSubmit}
                className={`transition-all duration-500 ${
                  mode === "login"
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-full opacity-0 absolute inset-0 pointer-events-none"
                }`}
              >
                <p className="mb-4 text-xl font-bold text-white hidden md:block md:mb-6 md:text-2xl">ยินดีต้อนรับกลับ</p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">อีเมล</label>
                    <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required placeholder="your@email.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">รหัสผ่าน</label>
                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required minLength={6} placeholder="••••••••" className={inputCls} />
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={openForgotPassword} disabled={authLoading || !!socialLoading} className="text-xs text-white/40 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-50">
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <button type="submit" disabled={authLoading || !!socialLoading} className={submitCls}>
                    {authLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                  </button>
                </div>
              </form>

              {/* Forgot password */}
              <form
                ref={forgotPasswordRef}
                onSubmit={handleForgotPasswordSubmit}
                className={`transition-all duration-500 ${
                  mode === "forgot-password"
                    ? "translate-x-0 opacity-100"
                    : mode === "login"
                      ? "translate-x-full opacity-0 absolute inset-0 pointer-events-none"
                      : "-translate-x-full opacity-0 absolute inset-0 pointer-events-none"
                }`}
              >
                <div className="mb-6">
                  <p className="text-xl font-bold text-white md:text-2xl">ลืมรหัสผ่าน</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">อีเมล</label>
                    <input type="email" value={forgotPasswordEmail} onChange={(e) => setForgotPasswordEmail(e.target.value)} required placeholder="your@email.com" className={inputCls} />
                  </div>
                  <button type="submit" disabled={authLoading || !!socialLoading} className={submitCls}>
                    {authLoading ? "กำลังส่งลิงก์รีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
                  </button>
                </div>
              </form>

              {/* Register */}
              <form
                ref={registerRef}
                onSubmit={handleRegisterSubmit}
                className={`transition-all duration-500 ${
                  mode === "register"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 absolute inset-0 pointer-events-none"
                }`}
              >
                <p className="mb-4 text-xl font-bold text-white hidden md:block md:mb-6 md:text-2xl">สร้างบัญชีใหม่</p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">ชื่อผู้ใช้</label>
                    <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required placeholder="ชื่อของคุณ" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">อีเมล</label>
                    <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required placeholder="your@email.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">รหัสผ่าน</label>
                    <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required minLength={6} placeholder="•••••••• (อย่างน้อย 6 ตัว)" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">ยืนยันรหัสผ่าน</label>
                    <input type="password" value={registerConfirmPassword} onChange={(e) => setRegisterConfirmPassword(e.target.value)} required minLength={6} placeholder="กรอกรหัสผ่านอีกครั้ง" className={inputCls} />
                  </div>
                  <button type="submit" disabled={authLoading || !!socialLoading} className={submitCls}>
                    {authLoading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
                  </button>
                </div>
              </form>
            </div>
            </div>

            {/* Terms — mobile only, pinned at bottom of form panel */}
            <p className="md:hidden mt-3 mb-1 text-center text-[11px] text-white/25 leading-relaxed">
              การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
              <span className="underline underline-offset-2 cursor-pointer hover:text-white/50">ข้อกำหนดการใช้งาน</span>
              {" "}และ{" "}
              <span className="underline underline-offset-2 cursor-pointer hover:text-white/50">นโยบายความเป็นส่วนตัว</span>
            </p>

            {/* iOS safe area */}
            <div className="md:hidden shrink-0" style={{ height: 'env(safe-area-inset-bottom, 12px)', minHeight: '12px' }} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
