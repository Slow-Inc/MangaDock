"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../contexts/AuthContext";
import { useTopupCreate, TIERS } from "../hooks/useTopupCreate";
import { useTopupStream } from "../hooks/useTopupStream";
import { cancelTopup, simulateTopup } from "../lib/studioApi";
import { errMessage } from "@/lib/errMessage";
import { PRIMARY_FILL } from "./ui/Button";

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
      <div className="border-b border-line px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">สแกน QR เพื่อชำระเงิน</h2>
        <button onClick={handleCancel} className="text-ink-3 hover:text-ink transition text-lg leading-none">✕</button>
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        {status === "paid" ? (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ok/10 text-3xl text-ok">✓</div>
            <p className="text-base font-bold text-ink">ชำระเงินสำเร็จ</p>
            {successBalance !== null && (
              <>
                <p className="text-2xl font-bold text-coin">🪙 {successBalance.toLocaleString()}</p>
                <p className="text-xs text-ink-3">ยอดเหรียญปัจจุบัน</p>
              </>
            )}
            <p className="text-xs text-ink-3">กำลังปิด...</p>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-3">สแกน QR ด้วยแอปธนาคาร</p>
            <div className={`rounded-xl bg-white p-3 transition-all duration-300 ${status === "expired" ? "opacity-25 blur-sm" : ""}`}>
              <QRCodeSVG value={qrString} size={180} />
            </div>
            {status === "pending" && (
              <>
                <p className="font-mono text-sm text-coin">⏱ {formatCountdown(countdown)}</p>
                {process.env.NODE_ENV !== "production" && (
                  <button
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="w-full rounded-xl border border-accent/40 bg-accent/10 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-40"
                  >
                    {simulating ? "กำลังจำลอง..." : "⚡ จำลองการชำระ"}
                  </button>
                )}
                {simError && <p className="text-xs text-danger">{simError}</p>}
                <button onClick={handleCancel} className="text-xs text-ink-3 transition hover:text-ink-2">
                  ยกเลิก
                </button>
              </>
            )}
            {status === "expired" && (
              <>
                <p className="text-xs text-danger">QR หมดอายุแล้ว</p>
                <button
                  onClick={onRetry}
                  className="w-full rounded-xl border border-coin/40 bg-coin/10 py-2.5 text-sm font-semibold text-coin transition hover:bg-coin/20"
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-scrim/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xs rounded-2xl border border-line bg-surface shadow-2xl">
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
            <div className="border-b border-line px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink">เติมเหรียญ</h2>
                <p className="mt-0.5 text-xs text-ink-3">1 เหรียญ = 1 บาท • PromptPay QR</p>
              </div>
              <button onClick={onClose} className="text-ink-3 hover:text-ink transition text-lg leading-none">✕</button>
            </div>
            <div className="p-5">
              <div className="mb-3 grid grid-cols-3 gap-2">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setSelectedAmount(t); setUseCustom(false); }}
                    className={`rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition ${
                      !useCustom && selectedAmount === t
                        ? "border-coin/40 bg-coin/10 text-coin"
                        : "border-line bg-fill text-ink-2 hover:bg-raised"
                    }`}
                  >
                    {t}
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
                  className="w-full rounded-xl border border-line bg-fill px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-coin/40 focus:outline-none"
                />
              </div>
              {error && <p className="mb-3 text-xs text-danger">{error}</p>}
              <button
                onClick={onProceed}
                disabled={!canProceed || creating}
                className={`w-full rounded-xl ${PRIMARY_FILL} py-2.5 text-sm font-bold transition disabled:opacity-40`}
              >
                {creating ? "กำลังสร้าง QR..." : `ดำเนินการ${canProceed ? ` (${effectiveAmount} ฿)` : ""}`}
              </button>
              <button
                onClick={onClose}
                className="mt-3 w-full text-center text-xs text-ink-3 transition hover:text-ink-2"
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
