"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  getWalletBalance,
  getWalletTransactions,
  topupCoins,
  WalletTransaction,
} from "../../lib/studioApi";
import { getCached, setCache } from "../../lib/studioCache";
import StudioNav from "../components/StudioNav";

const TOPUP_PRESETS = [50, 100, 200, 500, 1000, 2000];

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isPositive = tx.type === "topup" || tx.type === "refund" || tx.type === "reward";
  const labels: Record<string, string> = {
    topup: "เติมเหรียญ",
    purchase: "ซื้อตอน",
    refund: "คืนเงิน",
    reward: "รางวัล",
  };
  const icons: Record<string, string> = {
    topup: "💰",
    purchase: "🔓",
    refund: "↩️",
    reward: "🎁",
  };

  const date = new Date(tx.createdAt);
  const dateStr = date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  const timeStr = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 border-b border-white/5 py-3 last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-base">
        {icons[tx.type] ?? "📝"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{labels[tx.type] ?? tx.type}</p>
        {tx.description && (
          <p className="truncate text-xs text-white/30">{tx.description}</p>
        )}
        <p className="text-[10px] text-white/20">{dateStr} {timeStr}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
          {isPositive ? "+" : "-"}{Math.abs(tx.amount)}
        </p>
        <p className="text-[10px] text-white/20">คงเหลือ {tx.balanceAfter}</p>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  const { showToast } = useToast();

  const [balance, setBalance] = useState<number | null>(() => getCached<number>("wallet:balance") ?? null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => getCached<WalletTransaction[]>("wallet:transactions") ?? []);
  const [loadingData, setLoadingData] = useState(() => getCached("wallet:balance") === null);
  const [topupAmount, setTopupAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      const [bal, txs] = await Promise.all([
        getWalletBalance(token),
        getWalletTransactions(token),
      ]);
      setBalance(bal.balance);
      setTransactions(txs);
      setCache("wallet:balance", bal.balance);
      setCache("wallet:transactions", txs);
    } catch {
      showToast({ type: "error", message: "ไม่สามารถโหลดข้อมูลกระเป๋าเงินได้", duration: 3000 });
    } finally {
      setLoadingData(false);
    }
  }, [user, getIdToken, showToast]);

  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
  }, [user, fetchData]);

  const handleTopup = async () => {
    const amount = topupAmount ?? (customAmount ? parseInt(customAmount, 10) : 0);
    if (!amount || amount <= 0) {
      showToast({ type: "error", message: "กรุณาเลือกจำนวนเหรียญ", duration: 2000 });
      return;
    }
    setTopupLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      const result = await topupCoins(token, amount);
      setBalance(result.balance);
      setCache("wallet:balance", result.balance);
      setTopupAmount(null);
      setCustomAmount("");
      showToast({ type: "success", message: `เติม ${amount} เหรียญสำเร็จ!`, duration: 2000 });
      // Refresh transactions
      const txs = await getWalletTransactions(token);
      setTransactions(txs);
      setCache("wallet:transactions", txs);
    } catch (e: unknown) {
      showToast({ type: "error", message: e instanceof Error ? e.message : "เติมเหรียญไม่สำเร็จ", duration: 3000 });
    } finally {
      setTopupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="pb-[calc(var(--mobile-nav-height)+1.5rem)] text-white md:pb-0">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-6 pt-[calc(5.5rem+env(safe-area-inset-top))] md:pt-28">
        <div className="pb-4">
          <h1 className="text-xl font-bold">สตูดิโอของฉัน</h1>
          <p className="text-sm text-white/40">อัปโหลดและจัดการงานแปลของคุณ</p>
        </div>

        <StudioNav />

        <div className="space-y-6 pt-5">
          {/* ── ยอดคงเหลือในกระเป๋าเงิน ── */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ยอดคงเหลือในกระเป๋าเงิน
            </h2>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent p-5">
              {loadingData ? (
                <div className="h-8 w-24 animate-pulse rounded-lg bg-white/10" />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-white/40">ยอดรวมคงเหลือ</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-300">{balance?.toLocaleString() ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">รายรับ (เติม)</p>
                    <p className="mt-1 text-lg font-bold text-green-400">
                      {transactions.filter((t) => t.type === "topup").reduce((s, t) => s + t.amount, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">ใช้จ่าย (ซื้อ)</p>
                    <p className="mt-1 text-lg font-bold text-red-400">
                      {transactions.filter((t) => t.type === "purchase").reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">รางวัล/คืนเงิน</p>
                    <p className="mt-1 text-lg font-bold text-yellow-400">
                      {transactions.filter((t) => t.type === "reward" || t.type === "refund").reduce((s, t) => s + t.amount, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── เติมเหรียญ ── */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              เติมเหรียญ
            </h2>
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {TOPUP_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => { setTopupAmount(amount); setCustomAmount(""); }}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      topupAmount === amount
                        ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  placeholder="จำนวนอื่น..."
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setTopupAmount(null); }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleTopup}
                  disabled={topupLoading || (!topupAmount && !customAmount)}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
                >
                  {topupLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "เติมเงิน"}
                </button>
              </div>
            </div>
          </div>

          {/* ── ประวัติรายรับ ── */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h4l3-7 4 14 3-7h4" /></svg>
              ประวัติรายรับ
            </h2>
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              {loadingData ? (
                <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>
              ) : (() => {
                const income = transactions.filter((t) => t.type === "topup" || t.type === "reward" || t.type === "refund");
                return income.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/30">ยังไม่มีประวัติรายรับ</p>
                ) : (
                  <div className="custom-scrollbar max-h-[300px] overflow-y-auto">
                    {income.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── ประวัติการใช้จ่าย ── */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              ประวัติการใช้จ่าย
            </h2>
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              {loadingData ? (
                <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>
              ) : (() => {
                const spending = transactions.filter((t) => t.type === "purchase");
                return spending.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/30">ยังไม่มีประวัติการใช้จ่าย</p>
                ) : (
                  <div className="custom-scrollbar max-h-[300px] overflow-y-auto">
                    {spending.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
