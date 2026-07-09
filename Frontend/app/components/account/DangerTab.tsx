"use client";

import { useRef, useState } from "react";
import { errMessage } from "@/lib/errMessage";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type { FormState, FormAction } from "./formReducer";

interface DangerTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
  onClose: () => void;
}

export default function DangerTab({ formState, dispatch, onClose }: DangerTabProps) {
  const { user, reauthenticateUser, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const { loading, errorMessage } = formState;

  const [deleteStep, setDeleteStep] = useState<"idle" | "reauth" | "confirm">("idle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthenticating, setReauthenticating] = useState<"password" | "google" | "facebook" | null>(null);
  const reauthResolvedRef = useRef(false);

  const hasGoogleProvider = user?.providerData.some(p => p.providerId === "google.com");
  const hasFacebookProvider = user?.providerData.some(p => p.providerId === "facebook.com");
  const hasPasswordProvider = user?.providerData.some(p => p.providerId === "password");

  const handlePasswordReauthForDelete = async () => {
    setReauthenticating("password");
    dispatch({ type: "CLEAR" });
    try {
      await reauthenticateUser("password", reauthPassword);
      setDeleteStep("confirm");
      setDeleteConfirmText("");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        dispatch({ type: "SET_ERROR", message: "รหัสผ่านไม่ถูกต้อง" });
      } else if (code === "auth/user-mismatch") {
        dispatch({ type: "SET_ERROR", message: "รหัสผ่านนี้ไม่ตรงกับบัญชีที่กำลังจะลบ กรุณาใช้รหัสผ่านของบัญชีนี้" });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      setReauthenticating(null);
    }
  };

  const withDeleteReauthPopupGuard = (provider: "google" | "facebook") => async () => {
    setReauthenticating(provider);
    dispatch({ type: "CLEAR" });
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
    } catch (error: unknown) {
      reauthResolvedRef.current = true;
      const code = (error as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user closed popup — keep reauth step open
      } else if (code === "auth/popup-blocked") {
        dispatch({ type: "SET_ERROR", message: "เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup แล้วลองอีกครั้ง" });
      } else if (code === "auth/user-mismatch") {
        dispatch({ type: "SET_ERROR", message: `บัญชี ${provider === "google" ? "Google" : "Facebook"} ที่เลือกไม่ตรงกับบัญชีที่กำลังจะลบ กรุณาเลือกบัญชีให้ถูกต้อง` });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      if (focusTimer) clearTimeout(focusTimer);
      setReauthenticating(null);
    }
  };

  const handleDeleteReauthGoogle = withDeleteReauthPopupGuard("google");
  const handleDeleteReauthFacebook = withDeleteReauthPopupGuard("facebook");

  const handleDeleteAccount = async () => {
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await deleteAccount();
      onClose();
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
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
      {/* Header */}
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

      <ul className="space-y-1.5 text-xs text-white/40 pl-1">
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />ประวัติการอ่านทั้งหมด</li>
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />รายการโปรดทั้งหมด</li>
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />รูปโปรไฟล์ที่อัปโหลดทั้งหมด</li>
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />บัญชีผู้ใช้และข้อมูลทั้งหมด</li>
      </ul>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {deleteStep === "idle" && (
        <button
          onClick={() => { dispatch({ type: "CLEAR" }); setDeleteStep("reauth"); }}
          className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-95"
        >
          ลบบัญชีของฉัน
        </button>
      )}

      {deleteStep === "reauth" && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-yellow-300/80">เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยวิธีที่คุณเชื่อมต่อไว้</p>
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
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    กำลังยืนยัน…
                  </>
                ) : "ยืนยันด้วยรหัสผ่าน"}
              </button>
            </div>
          )}
          {hasPasswordProvider && (hasGoogleProvider || hasFacebookProvider) && (
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] text-white/30">หรือ</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}
          {hasGoogleProvider && (
            <button
              onClick={handleDeleteReauthGoogle}
              disabled={!!reauthenticating}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
            >
              {reauthenticating === "google" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
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
          {hasFacebookProvider && (
            <button
              onClick={handleDeleteReauthFacebook}
              disabled={!!reauthenticating}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 py-2.5 text-sm font-semibold text-[#74a9f5] transition hover:bg-[#1877F2]/20 active:scale-95 disabled:opacity-50"
            >
              {reauthenticating === "facebook" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              {reauthenticating === "facebook" ? "กำลังยืนยัน…" : "ยืนยันด้วย Facebook"}
            </button>
          )}
          <button
            onClick={() => { setDeleteStep("idle"); setReauthPassword(""); dispatch({ type: "CLEAR" }); }}
            disabled={!!reauthenticating}
            className="w-full rounded-xl border border-white/15 py-2 text-xs font-medium text-white/40 transition hover:bg-white/5 hover:text-white/60 active:scale-95"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {deleteStep === "confirm" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-red-300">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            <p className="text-[11px] text-white/40">ข้อมูล รูปโปรไฟล์ ประวัติการอ่าน และรายการโปรดทั้งหมดจะหายไปตลอดกาล</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] text-white/50">
              พิมพ์ <span className="font-mono font-semibold text-red-300">ลบบัญชี</span> เพื่อยืนยัน
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => { setDeleteConfirmText(e.target.value); dispatch({ type: "CLEAR" }); }}
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
              onClick={() => { setDeleteStep("idle"); setDeleteConfirmText(""); dispatch({ type: "CLEAR" }); }}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80 active:scale-95"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
