"use client";
import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { errMessage } from "@/lib/errMessage";

interface ReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionLabel?: string;
}

export default function ReauthModal({
  isOpen,
  onClose,
  onSuccess,
  actionLabel = "ดำเนินการต่อ",
}: ReauthModalProps) {
  const { user, reauthenticateUser } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"password" | "google" | "facebook" | null>(null);
  const resolvedRef = useRef(false);

  const hasPassword = user?.providerData.some((p) => p.providerId === "password");
  const hasGoogle = user?.providerData.some((p) => p.providerId === "google.com");
  const hasFacebook = user?.providerData.some((p) => p.providerId === "facebook.com");

  const handlePassword = async () => {
    if (!password) return;
    setLoading("password");
    setError(null);
    try {
      await reauthenticateUser("password", password);
      onSuccess();
      setPassword("");
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === "auth/wrong-password"
          ? "รหัสผ่านไม่ถูกต้อง"
          : errMessage(e) || "เกิดข้อผิดพลาด",
      );
    } finally {
      setLoading(null);
    }
  };

  const handleOAuth = (provider: "google" | "facebook") => async () => {
    setLoading(provider);
    setError(null);
    resolvedRef.current = false;
    const onFocus = () =>
      setTimeout(() => {
        if (!resolvedRef.current) setLoading(null);
      }, 2000);
    window.addEventListener("focus", onFocus, { once: true });
    try {
      await reauthenticateUser(provider);
      resolvedRef.current = true;
      onSuccess();
    } catch (e) {
      resolvedRef.current = true;
      const code = (e as { code?: string })?.code ?? "";
      if (!code.includes("popup-closed") && !code.includes("cancelled")) {
        setError(errMessage(e) || "เกิดข้อผิดพลาด");
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl">
        <p className="text-sm font-semibold text-white">ยืนยันตัวตน</p>
        <p className="mt-1 text-xs text-white/50">
          เพื่อความปลอดภัยก่อน{actionLabel} กรุณายืนยันว่าเป็นคุณ
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {hasPassword && (
            <>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="รหัสผ่านของคุณ"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handlePassword()}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
              />
              <button
                onClick={handlePassword}
                disabled={!password || !!loading}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {loading === "password" ? "กำลังยืนยัน…" : "ยืนยันด้วยรหัสผ่าน"}
              </button>
            </>
          )}

          {hasPassword && (hasGoogle || hasFacebook) && (
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] text-white/30">หรือ</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}

          {hasGoogle && (
            <button
              onClick={handleOAuth("google")}
              disabled={!!loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              {loading === "google" ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading === "google" ? "กำลังยืนยัน…" : "ยืนยันด้วย Google"}
            </button>
          )}

          {hasFacebook && (
            <button
              onClick={handleOAuth("facebook")}
              disabled={!!loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 py-2.5 text-sm font-semibold text-[#74a9f5] transition hover:bg-[#1877F2]/20 disabled:opacity-50"
            >
              {loading === "facebook" ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              )}
              {loading === "facebook" ? "กำลังยืนยัน…" : "ยืนยันด้วย Facebook"}
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              setPassword("");
              setError(null);
            }}
            className="w-full rounded-xl border border-white/10 py-2 text-xs text-white/40 transition hover:bg-white/5 hover:text-white/60"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
