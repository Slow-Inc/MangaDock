"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { createTopup, cancelTopup, simulateTopup, subscribeTopupStream } from "../lib/studioApi";
import { useAuth } from "../contexts/AuthContext";
import { errMessage } from "@/lib/errMessage";

type Screen = "TIER_SELECT" | "QR_DISPLAY" | "QR_EXPIRED" | "SUCCESS";

const TIERS = [20, 50, 100, 200, 500, 1000] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
  initialAmount?: number;
};

export default function TopupModal({ isOpen, onClose, onSuccess, initialAmount }: Props) {
  const { getIdToken } = useAuth();
  const [screen, setScreen] = useState<Screen>("TIER_SELECT");
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [qrString, setQrString] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [successBalance, setSuccessBalance] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      setScreen("TIER_SELECT");
      setError("");
      setPaymentId(null);
      setQrString("");
      setExpiresAt(null);
      setSelectedAmount(initialAmount ?? 100);
      setCustomAmount("");
      setUseCustom(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
    }
  }, [isOpen, initialAmount]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleCancel = useCallback(async () => {
    if (screen === "QR_DISPLAY" && paymentId) {
      try {
        const token = await getIdToken();
        if (token) await cancelTopup(token, paymentId);
      } catch {
        // silent — topup expires naturally
      }
    }
    setScreen("TIER_SELECT");
    setPaymentId(null);
    setQrString("");
    setExpiresAt(null);
    setError("");
  }, [screen, paymentId, getIdToken]);

  const handleSimulate = useCallback(async () => {
    if (!paymentId) return;
    setSimulating(true);
    setError("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่ได้เข้าสู่ระบบ");
      await simulateTopup(token, paymentId);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSimulating(false);
    }
  }, [paymentId, getIdToken]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || screen !== "QR_DISPLAY") return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) setScreen("QR_EXPIRED");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, screen]);

  // SSE — receive payment confirmation push from server
  useEffect(() => {
    if (screen !== "QR_DISPLAY" || !paymentId) return;

    let cleanup: (() => void) | null = null;

    getIdToken().then((token) => {
      if (!token) return;
      cleanup = subscribeTopupStream(
        token,
        paymentId,
        (balance) => {
          setSuccessBalance(balance);
          onSuccess(balance);
          window.dispatchEvent(
            new CustomEvent("mb:coin-balance-update", { detail: { balance } }),
          );
          setScreen("SUCCESS");
        },
        () => {
          // silent — QR expiry countdown already handles timeout UX
        },
      );
    });

    return () => {
      cleanup?.();
    };
  }, [screen, paymentId, getIdToken, onSuccess]);

  const effectiveAmount = useCustom ? (parseInt(customAmount, 10) || 0) : selectedAmount;
  const canProceed = effectiveAmount >= 20;

  const handleProceed = async () => {
    if (!canProceed) return;
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่ได้เข้าสู่ระบบ");
      const result = await createTopup(token, effectiveAmount);
      setPaymentId(result.paymentId);
      setQrString(result.qrString);
      setExpiresAt(new Date(result.expiresAt));
      setScreen("QR_DISPLAY");
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-xs rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl transition-all duration-200 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">เติมเหรียญ</h3>
          <button
            onClick={handleClose}
            className="text-white/40 transition hover:text-white"
            aria-label="ปิด"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Screen 1: Tier Select */}
          {screen === "TIER_SELECT" && (
            <>
              <p className="mb-3 text-xs text-white/40">1 เหรียญ = 1 บาท • PromptPay QR</p>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setSelectedAmount(t); setUseCustom(false); }}
                    className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                      !useCustom && selectedAmount === t
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    🪙 {t}
                  </button>
                ))}
              </div>
              <div className="mb-4">
                <input
                  type="number"
                  min="20"
                  placeholder="จำนวนอื่น (≥20)"
                  value={customAmount}
                  onFocus={() => setUseCustom(true)}
                  onChange={(e) => { setCustomAmount(e.target.value); setUseCustom(true); }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
              <button
                onClick={handleProceed}
                disabled={!canProceed || loading}
                className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white transition hover:bg-amber-500 disabled:opacity-40"
              >
                {loading
                  ? "กำลังสร้าง QR..."
                  : `ดำเนินการ${canProceed ? ` (${effectiveAmount} ฿)` : ""}`}
              </button>
            </>
          )}

          {/* Screen 2: QR Display + Screen 2b: QR Expired */}
          {(screen === "QR_DISPLAY" || screen === "QR_EXPIRED") && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-white/40">สแกน QR ด้วยแอปธนาคาร</p>
              <div
                className={`rounded-xl bg-white p-3 transition-all duration-300 ${
                  screen === "QR_EXPIRED" ? "opacity-25 blur-sm" : ""
                }`}
              >
                {qrString && <QRCodeSVG value={qrString} size={180} />}
              </div>
              {screen === "QR_DISPLAY" && (
                <>
                  <p className="font-mono text-sm text-amber-300">
                    ⏱ {formatCountdown(countdown)}
                  </p>
                  {process.env.NODE_ENV !== "production" && (
                    <button
                      onClick={handleSimulate}
                      disabled={simulating}
                      className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-40"
                    >
                      {simulating ? "กำลังจำลอง..." : "⚡ จำลองการชำระ (Sandbox)"}
                    </button>
                  )}
                  {error && <p className="text-xs text-red-400">{error}</p>}
                </>
              )}
              {screen === "QR_EXPIRED" && (
                <>
                  <p className="text-xs text-red-400">QR หมดอายุแล้ว</p>
                  <button
                    onClick={() => setScreen("TIER_SELECT")}
                    className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
                  >
                    สร้าง QR ใหม่
                  </button>
                </>
              )}
              <button
                onClick={handleCancel}
                className="text-xs text-white/30 transition hover:text-white/60"
              >
                ยกเลิก
              </button>
            </div>
          )}

          {/* Screen 3: Success */}
          {screen === "SUCCESS" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-3xl text-green-400">
                ✓
              </div>
              <p className="text-base font-bold text-white">ชำระเงินสำเร็จ</p>
              <p className="text-2xl font-bold text-amber-300">🪙 {successBalance.toLocaleString()}</p>
              <p className="text-xs text-white/40">ยอดเหรียญปัจจุบัน</p>
              <button
                onClick={handleClose}
                className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                ปิด
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
