"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  getMyVersions,
  getWalletBalance,
  getWalletTransactions,
  type WalletTransaction,
} from "../lib/studioApi";
import type { ChapterVersion } from "../lib/types";
import { getCached, setCache } from "../lib/studioCache";
import StudioNav from "./components/StudioNav";
import { StudioOverviewSkeleton } from "./components/StudioSkeleton";
import {
  DonutChart,
  GroupedBarChart,
  HorizontalBreakdownChart,
  LineChart,
  MetricCard,
  StudioAnnouncement,
  StudioSection,
} from "./components/StudioDashboardWidgets";
import {
  StudioMobileHeader,
  StudioMobileHero,
  StudioMobileMenuCard,
  StudioMobileSection,
} from "./components/StudioMobileShell";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  formatCurrency,
  getLanguageBreakdown,
  getOverviewStats,
  getTopTitlesByChapterCount,
  getTransactionTypeBreakdown,
  getVersionStatusBreakdown,
  getWalletFlowLastDays,
  getWalletMonthlyTotals,
} from "./lib/dashboardAnalytics";

type OverviewMobileView = "menu" | "insights" | "wallet" | "activity";

function RecentTransactionList({ transactions }: { transactions: WalletTransaction[] }) {
  const labels: Record<string, string> = {
    topup: "เติมเหรียญ",
    purchase: "ซื้อตอน",
    refund: "คืนเงิน",
    reward: "รางวัล",
  };

  if (transactions.length === 0) {
    return <p className="py-10 text-center text-sm text-white/30">ยังไม่มีรายการล่าสุด</p>;
  }

  return (
    <div className="space-y-2">
      {transactions.slice(0, 6).map((tx) => {
        const isPositive = tx.type === "topup" || tx.type === "refund" || tx.type === "reward";
        const date = new Date(tx.createdAt);
        return (
          <div key={tx.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isPositive ? "bg-indigo-500/12 text-indigo-300" : "bg-rose-500/12 text-rose-300"}`}>
              {isPositive ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/85">{labels[tx.type] ?? tx.type}</p>
              <p className="truncate text-[11px] text-white/30">{tx.description || "รายการกระเป๋าเงิน"}</p>
            </div>

            <div className="shrink-0 text-right">
              <p className={`text-sm font-semibold ${isPositive ? "text-indigo-300" : "text-rose-300"}`}>
                {isPositive ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
              </p>
              <p className="text-[11px] text-white/25">
                {date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StudioOverviewPage() {
  const { getIdToken } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [versions, setVersions] = useState<ChapterVersion[]>(() => getCached<ChapterVersion[]>("studio:versions") ?? []);
  const [balance, setBalance] = useState<number | null>(() => getCached<number>("overview:balance") ?? null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => getCached<WalletTransaction[]>("overview:transactions") ?? []);
  const [loadingData, setLoadingData] = useState(() => getCached("studio:versions") === null);
  const [mobileView, setMobileView] = useState<OverviewMobileView>("menu");
  const hasFetched = useRef(false);

  const fetchAll = useCallback(async () => {
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
      setTransactions(txs);
      setCache("studio:versions", vers);
      setCache("overview:balance", bal.balance);
      setCache("overview:transactions", txs);
    } catch {
      showToast({ type: "error", message: "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้", duration: 3000 });
    } finally {
      setLoadingData(false);
    }
  }, [getIdToken, showToast]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  const overviewStats = useMemo(
    () => getOverviewStats(versions, transactions, balance),
    [versions, transactions, balance],
  );

  const statusBreakdown = useMemo(() => getVersionStatusBreakdown(versions), [versions]);
  const languageBreakdown = useMemo(() => getLanguageBreakdown(versions).slice(0, 6), [versions]);
  const titleBreakdown = useMemo(() => getTopTitlesByChapterCount(versions, 6), [versions]);
  const transactionTypes = useMemo(() => getTransactionTypeBreakdown(transactions), [transactions]);
  const last30Days = useMemo(() => getWalletFlowLastDays(transactions, 30), [transactions]);
  const monthlyWallet = useMemo(() => getWalletMonthlyTotals(transactions, 6), [transactions]);
  const dailyIncome = useMemo(
    () => last30Days.map((item) => ({ label: item.label, value: item.income })),
    [last30Days],
  );

  if (isMobile) {
    const renderMobileContent = () => {
      if (loadingData) {
        return (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        );
      }

      if (mobileView === "menu") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioAnnouncement />

            <StudioMobileHero
              eyebrow="Studio Dashboard"
              title="สตูดิโอของฉัน"
              description="ดูสถิติ รายได้ และกิจกรรมล่าสุดของคุณ"
              aside={(
                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-3 py-2 text-right">
                  <p className="text-[10px] text-white/45">เหรียญ</p>
                  <p className="mt-1 text-xl font-semibold text-amber-300">{formatCurrency(overviewStats.balance)}</p>
                </div>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="จำนวนเรื่อง" value={overviewStats.totalWorks} hint="เรื่องที่เคยอัปโหลด" tone="indigo" />
              <MetricCard label="จำนวนตอน" value={overviewStats.totalChapters} hint={`${overviewStats.totalPages} หน้า`} tone="violet" />
              <MetricCard label="เผยแพร่แล้ว" value={overviewStats.published} hint={`ร่าง ${overviewStats.draft}`} tone="emerald" />
              <MetricCard label="ตอนมีราคา" value={overviewStats.paidChapters} hint={`เฉลี่ย ${formatCurrency(overviewStats.avgPrice)}`} tone="amber" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/studio/upload"
                className="rounded-2xl bg-indigo-500 px-4 py-3 text-center text-sm font-semibold text-white transition active:scale-[0.99]"
              >
                + อัปโหลดใหม่
              </Link>
              <Link
                href="/studio/works"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white/80 transition active:scale-[0.99]"
              >
                ไปหน้าผลงาน
              </Link>
            </div>

            <StudioMobileSection title="ข้อมูลเชิงลึก" subtitle="แตะเพื่อเข้าไปดูรายละเอียดแต่ละกลุ่มข้อมูล">
              <div className="space-y-3">
                <StudioMobileMenuCard
                  icon={
                    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V21h4.5v-7.5H3zm6.75-6V21H14.25V7.5H9.75zM16.5 3V21H21V3h-4.5z" />
                    </svg>
                  }
                  title="ข้อมูลผลงาน"
                  description="ภาษา สถานะผลงาน และเรื่องที่มีจำนวนตอนมากที่สุด"
                  value={`${overviewStats.languages} ภาษา`}
                  tone="indigo"
                  onClick={() => setMobileView("insights")}
                />
                <StudioMobileMenuCard
                  icon={
                    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-4-4a4 4 0 008 0m-8-4a4 4 0 008 0" />
                      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
                    </svg>
                  }
                  title="กระแสเหรียญ"
                  description="ดูรายรับรายจ่ายรายเดือน และแนวโน้มธุรกรรมล่าสุด"
                  value={formatCurrency(overviewStats.balance)}
                  tone="amber"
                  onClick={() => setMobileView("wallet")}
                />
                <StudioMobileMenuCard
                  icon={
                    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  }
                  title="รายการล่าสุด"
                  description="สรุป transaction ล่าสุดและทางลัดไปหน้าจัดการที่เกี่ยวข้อง"
                  value={`${transactions.length} รายการ`}
                  tone="emerald"
                  onClick={() => setMobileView("activity")}
                />
              </div>
            </StudioMobileSection>

            <StudioMobileSection title="ไปต่อเร็ว ๆ" subtitle="ลัดไปหน้าเฉพาะทางแทนการรวมทุกอย่างไว้จอเดียว">
              <div className="space-y-3">
                <Link href="/studio/works" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-sm text-white/80">
                  <span>จัดการผลงาน</span>
                  <span className="text-white/30">→</span>
                </Link>
                <Link href="/studio/wallet" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-sm text-white/80">
                  <span>ดูประวัติกระเป๋าเงิน</span>
                  <span className="text-white/30">→</span>
                </Link>
                <Link href="/studio/account" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-sm text-white/80">
                  <span>แก้ไขโปรไฟล์นักแปล</span>
                  <span className="text-white/30">→</span>
                </Link>
              </div>
            </StudioMobileSection>
          </div>
        );
      }

      if (mobileView === "insights") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioMobileHeader
              title="ข้อมูลผลงาน"
              subtitle="แยกดูเฉพาะ analytics ฝั่งผลงาน"
              onBack={() => setMobileView("menu")}
            />
            <StudioMobileSection title="สถานะผลงาน" subtitle="สัดส่วน draft, pending, approved, published และรายการที่โดน moderator ลบ">
              <DonutChart data={statusBreakdown} />
            </StudioMobileSection>
            <StudioMobileSection title="โครงสร้างภาษา" subtitle="ภาษาที่ถูกใช้งานบ่อยที่สุด">
              <HorizontalBreakdownChart data={languageBreakdown} />
            </StudioMobileSection>
            <StudioMobileSection title="เรื่องหลักของสตูดิโอ" subtitle="เรื่องที่มีจำนวนตอนมากที่สุด">
              <HorizontalBreakdownChart data={titleBreakdown} />
            </StudioMobileSection>
          </div>
        );
      }

      if (mobileView === "wallet") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioMobileHeader
              title="กระแสเหรียญ"
              subtitle="รวมข้อมูล wallet แบบแยกหน้าสำหรับมือถือ"
              onBack={() => setMobileView("menu")}
            />
            <StudioMobileSection title="ภาพรวม 6 เดือนล่าสุด" subtitle="เปรียบเทียบรายรับและรายจ่ายแบบรายเดือน">
              <GroupedBarChart points={monthlyWallet} valueFormatter={formatCurrency} />
            </StudioMobileSection>
            <StudioMobileSection title="รายรับ 30 วันล่าสุด" subtitle="ดูเฉพาะธุรกรรมขาเข้า เช่น topup, reward และ refund">
              <LineChart points={dailyIncome} valueFormatter={formatCurrency} />
            </StudioMobileSection>
            <StudioMobileSection title="ประเภทธุรกรรม" subtitle="สัดส่วน transaction ทั้งหมดในกระเป๋าเงิน">
              <DonutChart data={transactionTypes} />
            </StudioMobileSection>
          </div>
        );
      }

      return (
        <div className="space-y-4 px-4 py-4">
          <StudioMobileHeader
            title="รายการล่าสุด"
            subtitle="ดู activity ล่าสุดโดยไม่ต้องแบกทุกกราฟไว้หน้าเดียว"
            onBack={() => setMobileView("menu")}
          />
          <StudioMobileSection title="ธุรกรรมล่าสุด" subtitle="รายการล่าสุดในระบบกระเป๋าเงิน">
            <RecentTransactionList transactions={transactions} />
          </StudioMobileSection>
          <StudioMobileSection title="ลิงก์ด่วน" subtitle="ไปยังหน้าจัดการแบบเต็มเมื่ออยากลงรายละเอียด">
            <div className="space-y-3">
              <Link href="/studio/wallet" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-sm text-white/80">
                <span>เปิดหน้ากระเป๋าเงินเต็ม</span>
                <span className="text-white/30">→</span>
              </Link>
              <Link href="/studio/works" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-sm text-white/80">
                <span>ไปหน้าผลงาน</span>
                <span className="text-white/30">→</span>
              </Link>
            </div>
          </StudioMobileSection>
        </div>
      );
    };

    return (
      <div className="pb-[calc(var(--mobile-nav-height)+1.75rem+env(safe-area-inset-bottom))] text-white">
        <Navbar />
        <div className="pt-[calc(4.9rem+env(safe-area-inset-top))]">
          {renderMobileContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[calc(var(--mobile-nav-height)+1.5rem)] text-white md:pb-0">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-6 pt-[calc(5.5rem+env(safe-area-inset-top))] md:pt-28">
        <div className="space-y-5">
          <StudioAnnouncement />

          <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-white/35">Studio Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">ภาพรวมสตูดิโอของฉัน</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/45">
                รวมสถิติผลงาน สถานะการเผยแพร่ และการเคลื่อนไหวของกระเป๋าเงินไว้ในที่เดียว โดยใช้ข้อมูลจริงจาก MetaBooks
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/studio/upload"
                className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-95"
              >
                + อัปโหลดใหม่
              </Link>
              <Link
                href="/studio/wallet"
                className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/8 hover:text-white"
              >
                ดูกระเป๋าเงิน
              </Link>
            </div>
          </div>

          <StudioNav />

          {loadingData ? (
            <StudioOverviewSkeleton />
          ) : (
            <div className="space-y-6">
              <StudioSection
                title="ข้อมูลภาพรวมบัญชี"
                subtitle="สรุปจำนวนผลงาน สถานะ และข้อมูลกระเป๋าเงินในมุมเดียวกับ dashboard นักเขียน"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="จำนวนเรื่อง" value={overviewStats.totalWorks} hint="นับจาก title ที่เคยอัปโหลด" tone="indigo" />
                  <MetricCard label="จำนวนตอน" value={overviewStats.totalChapters} hint={`รวมทั้งหมด ${overviewStats.totalPages} หน้า`} tone="violet" />
                  <MetricCard label="เผยแพร่แล้ว" value={overviewStats.published} hint={`รอตรวจสอบ ${overviewStats.pending} | แบบร่าง ${overviewStats.draft}`} tone="emerald" />
                  <MetricCard label="เหรียญคงเหลือ" value={formatCurrency(overviewStats.balance)} hint={`ใช้จ่ายสะสม ${formatCurrency(overviewStats.spendingTotal)}`} tone="amber" />
                </div>
              </StudioSection>

              <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
                <StudioSection
                  title="ข้อมูลผลงานเชิงลึก"
                  subtitle="ส่วนนี้แทนภาพรวมแนว ReadRealm โดยใช้ข้อมูลที่ MetaBooks มีอยู่จริง"
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricCard label="จำนวนภาษา" value={overviewStats.languages} hint="ภาษางานแปลที่เคยใช้งาน" tone="sky" />
                    <MetricCard label="ตอนมีราคา" value={overviewStats.paidChapters} hint={`ราคาเฉลี่ย ${formatCurrency(overviewStats.avgPrice)} เหรียญ`} tone="amber" />
                    <MetricCard label="คุณภาพเฉลี่ย" value={overviewStats.avgQuality.toFixed(1)} hint="คำนวณจาก qualityScore ของแต่ละเวอร์ชัน" tone="emerald" />
                    <MetricCard label="รายรับสะสม" value={formatCurrency(overviewStats.topupTotal + overviewStats.rewardTotal)} hint="topup, reward, refund" tone="indigo" />
                    <MetricCard label="รางวัล/คืนเงิน" value={formatCurrency(overviewStats.rewardTotal)} hint="reward + refund" tone="sky" />
                    <MetricCard label="โดน moderator ลบ" value={overviewStats.rejected} hint={`approved ${overviewStats.approved} เวอร์ชัน`} tone="rose" />
                  </div>
                </StudioSection>

                <StudioSection
                  title="รายการล่าสุด"
                  subtitle="ธุรกรรมล่าสุดในระบบกระเป๋าเงิน"
                  action={
                    <Link href="/studio/wallet" className="text-xs font-medium text-indigo-300 transition hover:text-indigo-200">
                      ดูทั้งหมด →
                    </Link>
                  }
                >
                  <RecentTransactionList transactions={transactions} />
                </StudioSection>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <StudioSection title="สถานะผลงาน" subtitle="สัดส่วน draft / published / pending moderation ของเวอร์ชันทั้งหมด">
                  <DonutChart data={statusBreakdown} />
                </StudioSection>

                <StudioSection title="โครงสร้างภาษา" subtitle="ภาษาที่ใช้งานบ่อยที่สุดในผลงานของคุณ">
                  <HorizontalBreakdownChart data={languageBreakdown} />
                </StudioSection>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <StudioSection title="กระแสเหรียญรายเดือน" subtitle="เปรียบเทียบรายรับและรายจ่าย 6 เดือนล่าสุด">
                  <GroupedBarChart points={monthlyWallet} valueFormatter={formatCurrency} />
                </StudioSection>

                <StudioSection title="รายรับรายวัน 30 วันล่าสุด" subtitle="กราฟเส้นสำหรับธุรกรรมขาเข้า เช่น topup, reward และ refund">
                  <LineChart points={dailyIncome} valueFormatter={formatCurrency} />
                </StudioSection>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <StudioSection title="ผลงานที่มีจำนวนตอนสูงสุด" subtitle="ดูได้เร็วว่าชื่อเรื่องไหนเป็นแกนหลักของสตูดิโอคุณ">
                  <HorizontalBreakdownChart data={titleBreakdown} />
                </StudioSection>

                <StudioSection title="ประเภทธุรกรรม" subtitle="สัดส่วนธุรกรรมที่เกิดขึ้นในกระเป๋าเงินทั้งหมด">
                  <DonutChart data={transactionTypes} />
                </StudioSection>
              </div>

              <StudioSection title="ลิงก์ด่วน" subtitle="เข้าถึงหัวข้อหลักในสไตล์ dashboard นักเขียนได้ไวขึ้น">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Link href="/studio/works" className="group rounded-2xl border border-white/10 bg-white/4 p-4 transition hover:border-white/20 hover:bg-white/7">
                    <p className="text-sm font-semibold text-white transition group-hover:text-indigo-300">ผลงานของฉัน</p>
                    <p className="mt-1 text-xs text-white/35">ค้นหา กรอง และจัดการตอนทั้งหมด</p>
                  </Link>
                  <Link href="/studio/upload" className="group rounded-2xl border border-white/10 bg-white/4 p-4 transition hover:border-white/20 hover:bg-white/7">
                    <p className="text-sm font-semibold text-white transition group-hover:text-indigo-300">อัปโหลดงานใหม่</p>
                    <p className="mt-1 text-xs text-white/35">เพิ่ม chapter/version ใหม่เข้าสู่ระบบ</p>
                  </Link>
                  <Link href="/studio/wallet" className="group rounded-2xl border border-white/10 bg-white/4 p-4 transition hover:border-white/20 hover:bg-white/7">
                    <p className="text-sm font-semibold text-white transition group-hover:text-indigo-300">กระเป๋าเงิน</p>
                    <p className="mt-1 text-xs text-white/35">ดู transaction และแนวโน้มรายเดือน</p>
                  </Link>
                  <Link href="/studio/account" className="group rounded-2xl border border-white/10 bg-white/4 p-4 transition hover:border-white/20 hover:bg-white/7">
                    <p className="text-sm font-semibold text-white transition group-hover:text-indigo-300">ข้อมูลนักแปล</p>
                    <p className="mt-1 text-xs text-white/35">แก้ไขโปรไฟล์และความพร้อมของบัญชี</p>
                  </Link>
                </div>
              </StudioSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
