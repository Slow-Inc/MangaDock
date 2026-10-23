"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useReauth } from "../../hooks/useReauth";
import { supabase } from "../../lib/supabase";
import TotpSetupModal from "./TotpSetupModal";
import SessionList from "./SessionList";
import ActivityLog from "./ActivityLog";

export default function SecuritySettingsPage() {
  const { user, getActiveTotpFactor, unenrollTotp } = useAuth();
  const { withReauth, ReauthModalNode } = useReauth("ปิด 2FA");

  const [totpFactor, setTotpFactor] = useState<{
    id: string;
    friendly_name: string;
  } | null>(null);
  const [totpLoading, setTotpLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  // Track whether the user completed setup (vs. closing mid-flow)
  const setupCompletedRef = useRef(false);

  // Initial load — setState is called inside .then() (async callback, not synchronously
  // inside the effect body), which satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    getActiveTotpFactor().then((factor) => {
      setTotpFactor(factor);
      setTotpLoading(false);
    });
  }, [getActiveTotpFactor]);

  // Refresh after events (setup success). Called only from event handlers — never
  // from an effect body — so calling setState inside is fine.
  const refreshFactor = useCallback(async () => {
    const factor = await getActiveTotpFactor();
    setTotpFactor(factor);
    setTotpLoading(false);
  }, [getActiveTotpFactor]);

  // Unenroll is gated by re-auth. fn must handle its own errors (useReauth contract).
  const handleUnenroll = withReauth(async () => {
    if (!totpFactor) return;
    try {
      await unenrollTotp(totpFactor.id);
      setTotpFactor(null);
    } catch {
      // swallow — unenrollTotp errors must not propagate through withReauth
    }
  });

  const handleOpenSetup = () => {
    setupCompletedRef.current = false;
    setShowSetup(true);
  };

  // Called by TotpSetupModal "done" step — enrollment verified and active
  const handleSetupSuccess = useCallback(() => {
    setupCompletedRef.current = true;
    void refreshFactor();
  }, [refreshFactor]);

  // Called when user closes the modal without completing setup.
  // Cleans up any unverified TOTP factor left behind in Supabase MFA.
  const handleModalClose = useCallback(async () => {
    setShowSetup(false);
    if (!setupCompletedRef.current) {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const unverified = data?.totp?.filter((f) => f.status !== "verified") ?? [];
        await Promise.all(unverified.map((f) => unenrollTotp(f.id)));
      } catch {
        // non-critical — Supabase auto-expires unverified factors eventually
      }
    }
  }, [unenrollTotp]);

  // 2FA is only available for email/password accounts.
  // Google/Facebook accounts have 2FA managed by their own provider.
  const hasPassword =
    user?.providerData.some((p) => p.providerId === "password") ?? false;
  const isOAuthOnly =
    !hasPassword &&
    (user?.providerData.some(
      (p) => p.providerId === "google.com" || p.providerId === "facebook.com",
    ) ??
      false);

  return (
    <div className="space-y-6">
      {ReauthModalNode}
      <TotpSetupModal
        isOpen={showSetup}
        onClose={handleModalClose}
        onSuccess={handleSetupSuccess}
      />

      <div>
        <h2 className="text-base font-semibold text-ink">ความปลอดภัย</h2>
        <p className="mt-1 text-xs text-ink-3">
          จัดการ 2FA อุปกรณ์ที่เข้าสู่ระบบ และประวัติกิจกรรม
        </p>
      </div>

      {/* ── 2FA Section ──────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-line bg-fill p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">
              การยืนยันตัวตนสองขั้นตอน (2FA)
            </p>
            <p className="mt-0.5 text-xs text-ink-3">
              {isOAuthOnly
                ? "2FA จัดการโดย Google/Facebook แทน"
                : !hasPassword
                  ? "ไม่พบบัญชีในระบบ"
                  : totpLoading
                    ? "กำลังโหลด…"
                    : totpFactor
                      ? "เปิดใช้งานอยู่"
                      : "ปิดอยู่"}
            </p>
          </div>
          {hasPassword && !totpLoading && (
            totpFactor ? (
              <button
                onClick={handleUnenroll}
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/20"
              >
                ปิด 2FA
              </button>
            ) : (
              <button
                onClick={handleOpenSetup}
                className="rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-bg transition hover:bg-[color-mix(in_srgb,var(--ink)_88%,var(--accent))]"
              >
                เปิด 2FA
              </button>
            )
          )}
        </div>

        {totpFactor && (
          <div className="flex items-center gap-2 rounded-xl border border-ok/20 bg-ok/10 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-ok" />
            <p className="text-xs text-ok">
              2FA เปิดใช้งานอยู่ — ต้องกรอกรหัส 6 หลักทุกครั้งที่ login
            </p>
          </div>
        )}

        {isOAuthOnly && (
          <div className="rounded-xl border border-line bg-fill px-3 py-2">
            <p className="text-xs text-ink-2">
              บัญชีนี้เข้าสู่ระบบผ่าน Google หรือ Facebook
              ซึ่งมีระบบ 2FA ของตัวเอง คุณสามารถจัดการ 2FA
              ได้ในการตั้งค่าของแต่ละ provider
            </p>
          </div>
        )}
      </div>

      {/* ── Sessions ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">อุปกรณ์ที่เข้าสู่ระบบ</p>
        <SessionList />
      </div>

      {/* ── Activity Log ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">ประวัติการเข้าสู่ระบบ</p>
        <ActivityLog />
      </div>
    </div>
  );
}
