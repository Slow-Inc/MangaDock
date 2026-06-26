"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useTopupCreate, TIERS } from "../../hooks/useTopupCreate";

export default function TopupPage() {
  const router = useRouter();
  const { user, loading, getIdToken, showLoginPrompt } = useAuth();
  const {
    selectedAmount, setSelectedAmount,
    customAmount, setCustomAmount,
    useCustom, setUseCustom,
    effectiveAmount, canProceed,
    loading: creating, error,
    handleProceed,
  } = useTopupCreate(getIdToken);

  useEffect(() => {
    if (!loading && !user) {
      showLoginPrompt();
      router.replace("/");
    }
  }, [loading, user, showLoginPrompt, router]);

  const onProceed = async () => {
    const result = await handleProceed();
    if (result) {
      sessionStorage.setItem(
        `topup:${result.paymentId}`,
        JSON.stringify({ qrString: result.qrString, expiresAt: result.expiresAt }),
      );
      router.push(`/wallet/topup/${result.paymentId}`);
    }
  };

  if (loading || !user) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#111] p-4">
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <h1 className="text-sm font-bold text-white">เติมเหรียญ</h1>
          <p className="mt-0.5 text-xs text-white/40">1 เหรียญ = 1 บาท • PromptPay QR</p>
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
            {creating
              ? "กำลังสร้าง QR..."
              : `ดำเนินการ${canProceed ? ` (${effectiveAmount} ฿)` : ""}`}
          </button>

          <button
            onClick={() => router.back()}
            className="mt-3 w-full text-center text-xs text-white/30 transition hover:text-white/60"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </main>
  );
}
