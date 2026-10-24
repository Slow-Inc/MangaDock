"use client";
import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDialogFocus } from "../hooks/useDialogFocus";

interface MfaVerifyScreenProps {
  factorId: string;
  /** Called when the user cancels — clears mfaRequired so the overlay unmounts */
  onClose: () => void;
}

/**
 * Full-screen overlay shown after a successful password login when AAL2 is
 * required (i.e. the user has a verified TOTP factor).  The user must enter
 * their 6-digit OTP to complete sign-in; pressing "ยกเลิก" aborts and clears
 * the pending MFA state (user stays signed in at AAL1 until they log out).
 */
export default function MfaVerifyScreen({ factorId, onClose }: MfaVerifyScreenProps) {
  const { verifyTotpForLogin } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // aria-modal (#1073): Tab stays inside. No Escape — the only way out is "cancel and sign out", not a key to hit by chance
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, () => true);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      await verifyTotpForLogin(factorId, code);
      // verifyTotpForLogin calls reloadPage() on success — component unmounts
    } catch {
      setError("รหัส OTP ไม่ถูกต้อง กรุณาลองอีกครั้ง");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="การยืนยันสองขั้นตอน"
      className="fixed inset-0 z-[400] flex items-center justify-center bg-scrim/90 backdrop-blur-sm outline-none">
      <div className="w-full max-w-sm rounded-3xl border border-ink-3 bg-raised p-8 text-center shadow-2xl">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/20">
          <svg
            className="h-7 w-7 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <p className="text-base font-semibold text-ink">การยืนยันสองขั้นตอน</p>
        <p className="mt-1 text-xs text-ink-2">
          กรอกรหัส 6 หลักจาก Authenticator app ของคุณ
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/15 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        <input aria-label="รหัสยืนยัน 6 หลัก"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={code}
          maxLength={6}
          autoFocus
          autoComplete="one-time-code"
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          placeholder="000000"
          className="mt-4 w-full rounded-xl border border-ink-3 bg-fill px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
        />

        <button
          onClick={handleVerify}
          disabled={code.length !== 6 || loading}
          className="mt-3 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-bg transition hover:bg-[color-mix(in_srgb,var(--ink)_88%,var(--accent))] disabled:opacity-50"
        >
          {loading ? "กำลังยืนยัน…" : "ยืนยัน"}
        </button>

        <button
          onClick={onClose}
          className="mt-2 text-xs text-ink-3 transition hover:text-ink-2"
        >
          ยกเลิกและออกจากระบบ
        </button>
      </div>
    </div>
  );
}
