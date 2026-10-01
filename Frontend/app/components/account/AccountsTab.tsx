"use client";

import { useRef, useState } from "react";
import { errMessage } from "@/lib/errMessage";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type { FormState, FormAction } from "./formReducer";

type Tab = "profile" | "password" | "accounts" | "danger";

interface AccountsTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
  onTabChange: (tab: Tab) => void;
  onClose: () => void;
}

export default function AccountsTab({ formState, dispatch, onTabChange, onClose }: AccountsTabProps) {
  const {
    user, linkGoogleAccount, linkFacebookAccount, unlinkAccount,
    switchToConflictingAccount, resendVerificationEmail,
  } = useAuth();
  const { showToast } = useToast();
  const { loading, successMessage, errorMessage } = formState;

  const [linking, setLinking] = useState<"google" | "facebook" | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const linkingResolvedRef = useRef(false);

  const hasGoogleProvider = user?.providerData.some(p => p.providerId === "google.com");
  const hasFacebookProvider = user?.providerData.some(p => p.providerId === "facebook.com");
  const hasPasswordProvider = user?.providerData.some(p => p.providerId === "password");

  const showConflict = (info: { credential: unknown; provider: "google" | "facebook" }) => {
    showToast({
      type: "warning",
      message: (
        <>
          บัญชี <span className="font-semibold text-white">{info.provider === "google" ? "Google" : "Facebook"}</span> นี้ผูกกับ MangaDock อีกบัญชีอยู่แล้ว
        </>
      ),
      duration: 0,
      action: {
        label: "เข้าบัญชีนั้น",
        onClick: async () => {
          try {
            await switchToConflictingAccount(info.credential);
            onClose();
          } catch (error: unknown) {
            dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
          }
        },
      },
    });
  };

  const withFocusGuard = (provider: "google" | "facebook", fn: () => Promise<void>) => async () => {
    dispatch({ type: "CLEAR" });
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
      dispatch({ type: "SET_SUCCESS", message: `เชื่อมต่อบัญชี ${provider === "google" ? "Google" : "Facebook"} สำเร็จ ✓` });
    } catch (error: unknown) {
      linkingResolvedRef.current = true;
      const code = (error as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user closed popup — silent reset
      } else if (code === "auth/credential-already-in-use") {
        const credential = (error as { credential?: unknown }).credential;
        if (credential) {
          showConflict({ credential, provider });
        } else {
          dispatch({ type: "SET_ERROR", message: `บัญชี ${provider === "google" ? "Google" : "Facebook"} นี้เชื่อมต่อกับผู้ใช้อื่นแล้ว` });
        }
      } else if (code === "auth/provider-already-linked") {
        dispatch({ type: "SET_ERROR", message: `เชื่อมต่อกับ ${provider === "google" ? "Google" : "Facebook"} อยู่แล้ว` });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      if (focusTimer) clearTimeout(focusTimer);
      setLinking(null);
    }
  };

  const handleLinkGoogle = withFocusGuard("google", linkGoogleAccount);
  const handleLinkFacebook = withFocusGuard("facebook", linkFacebookAccount);

  const handleUnlinkProvider = async (providerId: string) => {
    dispatch({ type: "CLEAR" });
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await unlinkAccount(providerId);
      dispatch({ type: "SET_SUCCESS", message: "ยกเลิกการเชื่อมต่อสำเร็จ ✓" });
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  return (
    <>
      {successMessage && (
        <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}
      <div className="space-y-3">
        {/* Email/Password row */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-500">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white font-medium">อีเมล/รหัสผ่าน</p>
                <p className="text-xs text-white/40">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center">
              {hasPasswordProvider ? (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300">เชื่อมต่อแล้ว</span>
              ) : (
                <div className="group relative flex items-center">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 cursor-default select-none">
                    ไม่ได้ตั้งค่า
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 text-[9px] font-bold leading-none">i</span>
                  </span>
                  <div className="absolute top-full right-0 pt-2 hidden group-hover:block z-50">
                    <div className="w-52 rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-[11px] text-white/70 shadow-xl backdrop-blur-xl">
                      ไปที่แท็บ{" "}
                      <strong
                        className="text-white underline decoration-white/40 cursor-pointer hover:text-amber-300 hover:decoration-amber-300"
                        onClick={() => onTabChange("password")}
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
          {/* Email verification status */}
          <div className="flex items-center justify-between pl-12">
            {user?.emailVerified ? (
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
            {!user?.emailVerified && (
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
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    กำลังส่ง…
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    ส่ง email ยืนยัน
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Facebook row */}
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
            <button
              onClick={() => handleUnlinkProvider("facebook.com")}
              disabled={loading || !!linking || (!hasPasswordProvider && !hasGoogleProvider)}
              title={(!hasPasswordProvider && !hasGoogleProvider) ? "ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี" : ""}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ยกเลิก
            </button>
          ) : (
            <button
              onClick={handleLinkFacebook}
              disabled={!!linking || loading}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {linking === "facebook" ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  กำลังเชื่อมต่อ…
                </span>
              ) : "เชื่อมต่อ"}
            </button>
          )}
        </div>

        {/* Google row */}
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
            <button
              onClick={() => handleUnlinkProvider("google.com")}
              disabled={loading || !!linking || (!hasPasswordProvider && !hasFacebookProvider)}
              title={(!hasPasswordProvider && !hasFacebookProvider) ? "ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี" : ""}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ยกเลิก
            </button>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={!!linking || loading}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {linking === "google" ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  กำลังเชื่อมต่อ…
                </span>
              ) : "เชื่อมต่อ"}
            </button>
          )}
        </div>

        <p className="text-[11px] text-white/30 pt-1">💡 เชื่อมต่อบัญชีหลายแบบเพื่อเข้าสู่ระบบได้หลายวิธี</p>
      </div>
    </>
  );
}
