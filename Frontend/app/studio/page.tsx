"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  ChapterVersion,
  getMyVersions,
  getWalletBalance,
  getWalletTransactions,
  WalletTransaction,
} from "../lib/studioApi";
import { getCached, setCache } from "../lib/studioCache";
import StudioNav from "./components/StudioNav";

export default function StudioOverviewPage() {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  const { showToast } = useToast();

  const [versions, setVersions] = useState<ChapterVersion[]>(() => getCached<ChapterVersion[]>("overview:versions") ?? []);
  const [balance, setBalance] = useState<number | null>(() => getCached<number>("overview:balance") ?? null);
  const [recentTx, setRecentTx] = useState<WalletTransaction[]>(() => getCached<WalletTransaction[]>("overview:recentTx") ?? []);
  const [loadingData, setLoadingData] = useState(() => getCached("overview:versions") === null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      const [vers, bal, txs] = await Promise.all([
        getMyVersions(token),
        getWalletBalance(token).catch(() => ({ balance: 0 })),
        getWalletTransactions(token).catch(() => [] as WalletTransaction[]),
      ]);
      setVersions(vers);
      setBalance(bal.balance);
      setRecentTx(txs.slice(0, 5));
      setCache("overview:versions", vers);
      setCache("overview:balance", bal.balance);
      setCache("overview:recentTx", txs.slice(0, 5));
    } catch {
      showToast({ type: "error", message: "ไม่สามารถโหลดข้อมูลได้", duration: 3000 });
    } finally {
      setLoadingData(false);
    }
  }, [user, getIdToken, showToast]);

  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchAll();
    }
  }, [user, fetchAll]);

  const stats = useMemo(() => {
    const titles = new Set(versions.map((v) => v.titleId));
    const published = versions.filter((v) => v.status === "published");
    const draft = versions.filter((v) => v.status === "draft");
    const languages = new Set(versions.map((v) => v.language));
    const totalPages = versions.reduce((s, v) => s + (v.pages?.length ?? 0), 0);
    const paidChapters = versions.filter((v) => v.priceCoins > 0);
    return {
      totalWorks: titles.size,
      totalChapters: versions.length,
      published: published.length,
      draft: draft.length,
      languages: languages.size,
      totalPages,
      paidChapters: paidChapters.length,
    };
  }, [versions]);

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">สตูดิโอของฉัน</h1>
              <p className="text-sm text-white/40">ภาพรวมผลงานและรายได้ของคุณ</p>
            </div>
            <Link
              href="/studio/upload"
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95"
            >
              + อัปโหลดใหม่
            </Link>
          </div>
        </div>

        <StudioNav />

        {loadingData ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : (
          <div className="space-y-6 pt-5">
            {/* ── ข้อมูลภาพรวมผลงาน ── */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                ข้อมูลภาพรวมผลงาน
              </h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                <StatCard label="จำนวนเรื่อง" value={stats.totalWorks} icon="📚" />
                <StatCard label="จำนวนตอน" value={stats.totalChapters} icon="📄" />
                <StatCard label="จำนวนหน้า" value={stats.totalPages} icon="🖼️" />
                <StatCard label="จำนวนภาษา" value={stats.languages} icon="🌐" />
                <StatCard label="ตอนมีราคา" value={stats.paidChapters} icon="🪙" />
              </div>
            </div>

            {/* ── สถานะผลงาน ── */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                สถานะผลงาน
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-green-500/15 bg-green-500/5 p-3.5">
                  <p className="text-xs text-green-300/60">เผยแพร่แล้ว</p>
                  <p className="mt-1 text-lg font-bold text-green-400">{stats.published}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/3 p-3.5">
                  <p className="text-xs text-white/40">ฉบับร่าง</p>
                  <p className="mt-1 text-lg font-bold text-white/60">{stats.draft}</p>
                </div>
              </div>
            </div>

            {/* ── ข้อมูลรายได้ ── */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ข้อมูลรายได้
              </h2>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/15 via-purple-600/8 to-transparent p-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-white/40">ยอดเหรียญคงเหลือ</p>
                    <p className="mt-1 text-xl font-bold">{balance?.toLocaleString() ?? 0} <span className="text-xs font-normal text-white/30">เหรียญ</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">ตอนที่มีราคา</p>
                    <p className="mt-1 text-xl font-bold">{stats.paidChapters} <span className="text-xs font-normal text-white/30">ตอน</span></p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-xs text-white/40">ผลงานเผยแพร่</p>
                    <p className="mt-1 text-xl font-bold">{stats.published} <span className="text-xs font-normal text-white/30">ตอน</span></p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href="/studio/wallet" className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-600/30">
                    ดูกระเป๋าเงิน →
                  </Link>
                </div>
              </div>
            </div>

            {/* ── รายการล่าสุด ── */}
            {recentTx.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white/70">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    รายการล่าสุด
                  </h2>
                  <Link href="/studio/wallet" className="text-xs text-indigo-400 transition hover:text-indigo-300">
                    ดูทั้งหมด →
                  </Link>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
                  {recentTx.map((tx) => {
                    const isPos = tx.type === "topup" || tx.type === "refund" || tx.type === "reward";
                    const labels: Record<string, string> = { topup: "เติมเหรียญ", purchase: "ซื้อตอน", refund: "คืนเงิน", reward: "รางวัล" };
                    const d = new Date(tx.createdAt);
                    return (
                      <div key={tx.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/80">{labels[tx.type] ?? tx.type}</p>
                          <p className="text-[10px] text-white/20">{d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} {d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <p className={`text-sm font-semibold ${isPos ? "text-green-400" : "text-red-400"}`}>
                          {isPos ? "+" : "-"}{Math.abs(tx.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ลิงก์ด่วน ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Link href="/studio/works" className="group rounded-2xl border border-white/10 bg-white/3 p-4 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-sm font-semibold group-hover:text-indigo-300">📚 จัดการผลงาน</p>
                <p className="mt-1 text-xs text-white/30">ดู แก้ไข และจัดการตอนทั้งหมด</p>
              </Link>
              <Link href="/studio/upload" className="group rounded-2xl border border-white/10 bg-white/3 p-4 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-sm font-semibold group-hover:text-indigo-300">📤 อัปโหลดงานใหม่</p>
                <p className="mt-1 text-xs text-white/30">เพิ่มงานแปลตอนใหม่</p>
              </Link>
              <Link href="/studio/account" className="group rounded-2xl border border-white/10 bg-white/3 p-4 transition hover:border-white/20 hover:bg-white/5">
                <p className="text-sm font-semibold group-hover:text-indigo-300">👤 ข้อมูลบัญชี</p>
                <p className="mt-1 text-xs text-white/30">จัดการโปรไฟล์นักแปล</p>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-3.5 text-center">
      <p className="text-lg">{icon}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-[10px] text-white/40">{label}</p>
    </div>
  );
}