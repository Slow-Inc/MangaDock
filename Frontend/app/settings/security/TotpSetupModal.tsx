"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModalDialog } from "../../hooks/useDialogFocus";

type Step = "loading" | "scan" | "verify" | "done";

interface TotpSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the factor is verified and 2FA is active */
  onSuccess: () => void;
}

/**
 * Modal for TOTP enrollment.
 * Step 1 — "scan": shows QR code + manual secret key.
 * Step 2 — "verify": user enters 6-digit code to confirm the factor.
 * Step 3 — "done": success state before closing.
 */
export default function TotpSetupModal({ isOpen, onClose, onSuccess }: TotpSetupModalProps) {
  const { enrollTotp, verifyTotpEnrollment } = useAuth();

  const [step, setStep] = useState<Step>("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Kick off enrollment as soon as the modal opens (security invariant #5).
  const startEnroll = useCallback(async () => {
    setStep("loading");
    setCode("");
    setError(null);
    setLoading(true);
    try {
      const data = await enrollTotp();
      setQrCode(data.qr_code);
      setSecret(data.secret);
      setFactorId(data.factorId);
      setStep("scan");
    } catch (e) {
      setError("เกิดข้อผิดพลาดในการเริ่มต้น กรุณาปิดและลองใหม่");
      console.error(e);
      setStep("scan"); // show UI so user can read error
    } finally {
      setLoading(false);
    }
  }, [enrollTotp]);

  useEffect(() => {
    if (isOpen) {
      startEnroll();
    }
  }, [isOpen, startEnroll]);

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) return;
    setLoading(true);
    setError(null);
    try {
      // Security invariant #6: challenge then verify completes enrollment.
      await verifyTotpEnrollment(factorId, code);
      setStep("done");
    } catch {
      setError("รหัสไม่ถูกต้อง กรุณาลองใหม่");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  // aria-modal (#1073): focus moves in, Tab stays inside, Escape closes as the ✕ does, focus goes back to the opener
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog(dialogRef, onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="เปิดใช้งาน 2FA"
      className="fixed inset-0 z-[400] flex items-center justify-center bg-scrim/80 backdrop-blur-sm outline-none">
      <div className="w-full max-w-md rounded-3xl border border-ink-3 bg-raised p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">เปิดใช้งาน 2FA</p>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="text-ink-3 transition hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.7A1 1 0 0 0 5.7 7.12L10.59 12 5.7 16.88a1 1 0 1 0 1.42 1.42L12 13.41l4.88 4.89a1 1 0 0 0 1.42-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-danger/30 bg-danger/15 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {/* ── Step: loading / scan ── */}
        {(step === "loading" || step === "scan") && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-ink-2">
              สแกน QR code ด้วย Google Authenticator, Authy หรือแอปคล้ายกัน
            </p>

            {/* QR code placeholder / image */}
            <div className="mx-auto h-40 w-40 overflow-hidden rounded-xl bg-white p-2">
              {loading || !qrCode ? (
                <div className="h-full w-full animate-pulse rounded-lg bg-gray-200" />
              ) : (
                // QR code is a data URI (SVG/PNG) — use <img> to avoid Next.js
                // domain allow-listing requirements for data: URIs.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCode}
                  alt="TOTP QR Code"
                  width={144}
                  height={144}
                  className="h-full w-full"
                />
              )}
            </div>

            {secret && (
              <div className="rounded-xl border border-line bg-fill px-3 py-2">
                <p className="mb-1 text-[10px] text-ink-3">หรือกรอก secret key ด้วยตนเอง</p>
                <p className="break-all font-mono text-xs text-ink-2">{secret}</p>
              </div>
            )}

            <button
              onClick={() => setStep("verify")}
              disabled={!qrCode || loading}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg transition hover:bg-[color-mix(in_srgb,var(--ink)_88%,var(--accent))] disabled:opacity-50"
            >
              สแกนแล้ว ไปยืนยัน →
            </button>
          </div>
        )}

        {/* ── Step: verify ── */}
        {step === "verify" && (
          <div className="space-y-3">
            <p className="text-center text-xs text-ink-2">
              กรอกรหัส 6 หลักจาก Authenticator app เพื่อยืนยัน
            </p>
            <input
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
              className="w-full rounded-xl border border-ink-3 bg-fill px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
            />
            <button
              onClick={handleVerify}
              disabled={code.length !== 6 || loading}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg transition hover:bg-[color-mix(in_srgb,var(--ink)_88%,var(--accent))] disabled:opacity-50"
            >
              {loading ? "กำลังยืนยัน…" : "ยืนยันและเปิดใช้ 2FA"}
            </button>
            <button
              onClick={() => setStep("scan")}
              className="w-full text-xs text-ink-3 transition hover:text-ink-2"
            >
              ← กลับไปสแกน QR
            </button>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/20">
              <svg
                className="h-7 w-7 text-ok"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-ink">เปิดใช้งาน 2FA สำเร็จ!</p>
            <p className="text-xs text-ink-2">
              ทุกครั้งที่เข้าสู่ระบบด้วยรหัสผ่าน จะต้องกรอกรหัสจาก Authenticator app ด้วย
            </p>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg transition hover:bg-[color-mix(in_srgb,var(--ink)_88%,var(--accent))]"
            >
              เสร็จสิ้น
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
