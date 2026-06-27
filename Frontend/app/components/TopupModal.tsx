"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../contexts/AuthContext";
import { useTopupCreate, TIERS } from "../hooks/useTopupCreate";
import { useTopupStream } from "../hooks/useTopupStream";
import { cancelTopup, simulateTopup } from "../lib/studioApi";
import { errMessage } from "@/lib/errMessage";

function formatCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Separate component so useTopupStream gets fresh state for each new paymentId (via key prop)
function QrStep({
  paymentId,
  qrString,
  expiresAt,
  getIdToken,
  onClose,
  onRetry,
}: {
  paymentId: string;
  qrString: string;
  expiresAt: Date;
  getIdToken: () => Promise<string | null>;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { countdown, status, successBalance } = useTopupStream(paymentId, expiresAt, getIdToken);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState("");

  useEffect(() => {
    if (status !== "paid" || successBalance === null) return;
    const id = setTimeout(onClose, 1500);
    return () => clearTimeout(id);
  }, [status, successBalance, onClose]);

  const handleCancel = async () => {
    try {
      const token = await getIdToken();
      if (token) await cancelTopup(token, paymentId);
    } catch {}
    onClose();
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setSimError("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่ได้เข้าสู่ระบบ");
      await simulateTopup(token, paymentId);
    } catch (err) {
      setSimError(errMessage(err));
    } finally {
      setSimulating(false);
    }
  };

  return (
    <>
      <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">สแกน QR เพื่อชำระเงิน</h2>
        <button onClick={handleCancel} className="text-white/40 hover:text-white transition text-lg leading-none">✕</button>
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        {status === "paid" ? (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-3xl text-green-400">✓</div>
            <p className="text-base font-bold text-white">ชำระเงินสำเร็จ</p>
            {successBalance !== null && (
              <>
                <p className="text-2xl font-bold text-amber-300">🪙 {successBalance.toLocaleString()}</p>
                <p className="text-xs text-white/40">ยอดเหรียญปัจจุบัน</p>
              </>
            )}
            <p className="text-xs text-white/40">กำลังปิด...</p>
          </>
        ) : (
          <>
            <p className="text-xs text-white/40">สแกน QR ด้วยแอปธนาคาร</p>
            <div className={`rounded-xl bg-white p-3 transition-all duration-300 ${status === "expired" ? "opacity-25 blur-sm" : ""}`}>
              <QRCodeSVG value={qrString} size={180} />
            </div>
            {status === "pending" && (
              <>
                <p className="font-mono text-sm text-amber-300">⏱ {formatCountdown(countdown)}</p>
                {process.env.NODE_ENV !== "production" && (
                  <button
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-40"
                  >
                    {simulating ? "กำลังจำลอง..." : "⚡ จำลองการชำระ"}
                  </button>
                )}
                {simError && <p className="text-xs text-red-400">{simError}</p>}
                <button onClick={handleCancel} className="text-xs text-white/30 transition hover:text-white/60">
                  ยกเลิก
                </button>
              </>
            )}
            {status === "expired" && (
              <>
                <p className="text-xs text-red-400">QR หมดอายุแล้ว</p>
                <button
                  onClick={onRetry}
                  className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                  สร้าง QR ใหม่
                </button>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function TopupModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { getIdToken } = useAuth();
  const [qrData, setQrData] = useState<{ paymentId: string; qrString: string; expiresAt: Date } | null>(null);

  const {
    selectedAmount, setSelectedAmount,
    customAmount, setCustomAmount,
    useCustom, setUseCustom,
    effectiveAmount, canProceed,
    loading: creating, error,
    handleProceed,
  } = useTopupCreate(getIdToken);

  useEffect(() => {
    if (!isOpen) setQrData(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const onProceed = async () => {
    const result = await handleProceed();
    if (result) {
      setQrData({ paymentId: result.paymentId, qrString: result.qrString, expiresAt: new Date(result.expiresAt) });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        {qrData ? (
          <QrStep
            key={qrData.paymentId}
            paymentId={qrData.paymentId}
            qrString={qrData.qrString}
            expiresAt={qrData.expiresAt}
            getIdToken={getIdToken}
            onClose={onClose}
            onRetry={() => setQrData(null)}
          />
        ) : (
          <>
            <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">เติมเหรียญ</h2>
                <p className="mt-0.5 text-xs text-white/40">1 เหรียญ = 1 บาท • PromptPay QR</p>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white transition text-lg leading-none">✕</button>
            </div>
            <div className="p-5">
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
                onClick={onProceed}
                disabled={!canProceed || creating}
                className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white transition hover:bg-amber-500 disabled:opacity-40"
              >
                {creating ? "กำลังสร้าง QR..." : `ดำเนินการ${canProceed ? ` (${effectiveAmount} ฿)` : ""}`}
              </button>
              <button
                onClick={onClose}
                className="mt-3 w-full text-center text-xs text-white/30 transition hover:text-white/60"
              >
                ยกเลิก
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
