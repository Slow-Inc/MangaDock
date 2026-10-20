"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Coin from "../components/ui/Coin";
import Link from "next/link";
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
import { PRIMARY_FILL } from "../components/ui/Button";
import { StudioOverviewSkeleton } from "./components/StudioSkeleton";
import { MetricCard, StudioSection } from "./components/StudioDashboardWidgets";
import StudioLoadError from "./components/StudioLoadError";
import { studioLoadState } from "./lib/studioLoadState";
import StudioAreaChart, { type AreaSeries } from "./components/charts/StudioAreaChart";
import StudioBarChart from "./components/charts/StudioBarChart";
import StudioBreakdownChart from "./components/charts/StudioBreakdownChart";
import StudioDonutChart from "./components/charts/StudioDonutChart";
import ChartEmpty from "./components/charts/ChartEmpty";
import { hasValues } from "./components/charts/chartMath";
import { StudioTabBar, StudioToolbar, tabPanelProps, type StudioTab } from "./components/StudioToolbar";
import StatsOverview from "./components/StatsOverview";
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

type OverviewTab = "summary" | "works" | "coins";

// Tabs show one group at a time, so the overview mounts only the charts on screen.
const OVERVIEW_TABS: StudioTab<OverviewTab>[] = [
  { key: "summary", label: "ภาพรวม" },
  { key: "works", label: "ผลงาน" },
  { key: "coins", label: "เหรียญ" },
];

function RecentTransactionList({ transactions }: { transactions: WalletTransaction[] }) {
  const labels: Record<string, string> = {
    topup: "เติมเหรียญ",
    purchase: "ซื้อตอน",
    refund: "คืนเงิน",
    reward: "รางวัล",
  };

  if (transactions.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-3">ยังไม่มีรายการล่าสุด</p>;
  }

  return (
    <div className="space-y-2">
      {transactions.slice(0, 6).map((tx) => {
        const isPositive = tx.type === "topup" || tx.type === "refund" || tx.type === "reward";
        const date = new Date(tx.createdAt);
        return (
          <div key={tx.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isPositive ? "bg-fill text-coin" : "bg-danger/10 text-danger"}`}>
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
              <p className="text-sm font-medium text-ink">{labels[tx.type] ?? tx.type}</p>
              <p className="truncate text-[11px] text-ink-3">{tx.description || "รายการกระเป๋าเงิน"}</p>
            </div>

            <div className="shrink-0 text-right">
              <p className={`text-sm font-semibold ${isPositive ? "text-coin" : "text-danger"}`}>
                {isPositive ? "+" : "-"}<Coin className="mr-1 inline align-[-0.125em] text-coin" />{formatCurrency(Math.abs(tx.amount))}
              </p>
              <p className="text-[11px] text-ink-3">
                {date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IncomeChart({ labels, series }: { labels: string[]; series: AreaSeries[] }) {
  if (!hasValues(series[0].values)) return <ChartEmpty label="ยังไม่มีข้อมูลเพียงพอสำหรับกราฟนี้" />;
  return <StudioAreaChart labels={labels} series={series} valueFormatter={formatCurrency} ariaLabel="รายรับรายวัน 30 วันล่าสุด" />;
}

export default function StudioOverviewPage() {
  const { getIdToken } = useAuth();
  const { showToast } = useToast();

  const [versions, setVersions] = useState<ChapterVersion[]>(() => getCached<ChapterVersion[]>("studio:versions") ?? []);
  const [balance, setBalance] = useState<number | null>(() => getCached<number>("overview:balance") ?? null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => getCached<WalletTransaction[]>("overview:transactions") ?? []);
  const [loadingData, setLoadingData] = useState(() => getCached("studio:versions") === null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [txFailed, setTxFailed] = useState(false);
  const [tab, setTab] = useState<OverviewTab>("summary");
  const hasFetched = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoadFailed(false);
    try {
      const token = await getIdToken();
      if (!token) return;
      const [vers, bal, txs] = await Promise.all([
        getMyVersions(token),
        // A failed wallet call is "unknown", not 0 coins (#828).
        getWalletBalance(token).catch(() => null),
        getWalletTransactions(token).catch(() => null),
      ]);

      setVersions(vers);
      setBalance(bal?.balance ?? null);
      // A failed list keeps the last good one (if any) and is reported, never shown as "no spending".
      setTxFailed(txs === null);
      if (txs) setTransactions(txs);
      setCache("studio:versions", vers);
      if (bal) setCache("overview:balance", bal.balance);
      if (txs) setCache("overview:transactions", txs);
    } catch {
      setLoadFailed(true);
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

  const view = studioLoadState({ loading: loadingData, failed: loadFailed, hasData: versions.length > 0 });

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
  const incomeLabels = useMemo(() => last30Days.map((item) => item.label), [last30Days]);
  const incomeSeries = useMemo<AreaSeries[]>(
    () => [{ name: "รายรับ", values: last30Days.map((item) => item.income), token: "--accent" }],
    [last30Days],
  );

  return (
    <div className="text-ink">
      <StudioToolbar>
        <StudioTabBar tabs={OVERVIEW_TABS} value={tab} onChange={setTab} label="มุมมองภาพรวม" idBase="overview" />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/studio/upload"
            className={`rounded-xl ${PRIMARY_FILL} px-4 py-2 text-sm font-semibold transition active:scale-95`}
          >
            + อัปโหลดใหม่
          </Link>
          <Link
            href="/studio/wallet"
            className="rounded-xl border border-line bg-fill px-4 py-2 text-sm font-medium text-ink-2 transition hover:border-ink-3 hover:bg-raised hover:text-ink"
          >
            ดูกระเป๋าเงิน
          </Link>
        </div>
      </StudioToolbar>

      <div {...tabPanelProps("overview", tab)} className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {tab === "summary" ? <StatsOverview /> : null}

        {view === "loading" ? (
          <StudioOverviewSkeleton />
        ) : view === "error" ? (
          <StudioLoadError what="ข้อมูลสตูดิโอ" onRetry={() => { setLoadingData(true); fetchAll(); }} />
        ) : tab === "summary" ? (
          <>
            <StudioSection
              title="ข้อมูลภาพรวมบัญชี"
              subtitle="สรุปจำนวนผลงาน สถานะ และข้อมูลกระเป๋าเงินในมุมเดียวกับ dashboard นักเขียน"
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="จำนวนเรื่อง" value={overviewStats.totalWorks} hint="นับจาก title ที่เคยอัปโหลด" tone="indigo" />
                <MetricCard label="จำนวนตอน" value={overviewStats.totalChapters} hint={`รวมทั้งหมด ${overviewStats.totalPages} หน้า`} tone="violet" />
                <MetricCard label="เผยแพร่แล้ว" value={overviewStats.published} hint={`รอตรวจสอบ ${overviewStats.pending} | แบบร่าง ${overviewStats.draft}`} tone="emerald" />
                <MetricCard label="เหรียญคงเหลือ" value={balance === null ? "—" : <><Coin className="mr-1.5 inline align-[-0.1em] text-coin" />{formatCurrency(overviewStats.balance)}</>} hint={`ใช้จ่ายสะสม ${txFailed && transactions.length === 0 ? "—" : formatCurrency(overviewStats.spendingTotal)}`} tone="amber" />
              </div>
            </StudioSection>

            <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
              <StudioSection
                title="ข้อมูลผลงานเชิงลึก"
                subtitle="ภาษา ราคา และคุณภาพของตอนที่คุณเผยแพร่"
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
                  <Link href="/studio/wallet" className="text-xs font-medium text-accent transition hover:text-accent/80">
                    ดูทั้งหมด →
                  </Link>
                }
              >
                <RecentTransactionList transactions={transactions} />
              </StudioSection>
            </div>
          </>
        ) : tab === "works" ? (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <StudioSection title="สถานะผลงาน" subtitle="สัดส่วน draft / published / pending moderation ของเวอร์ชันทั้งหมด">
                <StudioDonutChart data={statusBreakdown} ariaLabel="สัดส่วนสถานะผลงาน" />
              </StudioSection>

              <StudioSection title="โครงสร้างภาษา" subtitle="ภาษาที่ใช้งานบ่อยที่สุดในผลงานของคุณ">
                <StudioBreakdownChart data={languageBreakdown} ariaLabel="จำนวนตอนแยกตามภาษา" />
              </StudioSection>
            </div>

            <StudioSection title="ผลงานที่มีจำนวนตอนสูงสุด" subtitle="ดูได้เร็วว่าชื่อเรื่องไหนเป็นแกนหลักของสตูดิโอคุณ">
              <StudioBreakdownChart data={titleBreakdown} ariaLabel="เรื่องที่มีจำนวนตอนมากที่สุด" />
            </StudioSection>
          </>
        ) : txFailed && transactions.length === 0 ? (
          <StudioLoadError what="ธุรกรรมกระเป๋าเงิน" onRetry={() => { setLoadingData(true); fetchAll(); }} />
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <StudioSection title="กระแสเหรียญรายเดือน" subtitle="เปรียบเทียบรายรับและรายจ่าย 6 เดือนล่าสุด">
                <StudioBarChart points={monthlyWallet} valueFormatter={formatCurrency} ariaLabel="รายรับและรายจ่ายรายเดือน 6 เดือนล่าสุด" />
              </StudioSection>

              <StudioSection title="รายรับรายวัน 30 วันล่าสุด" subtitle="กราฟเส้นสำหรับธุรกรรมขาเข้า เช่น topup, reward และ refund">
                <IncomeChart labels={incomeLabels} series={incomeSeries} />
              </StudioSection>
            </div>

            <StudioSection title="ประเภทธุรกรรม" subtitle="สัดส่วนธุรกรรมที่เกิดขึ้นในกระเป๋าเงินทั้งหมด">
              <StudioDonutChart data={transactionTypes} ariaLabel="สัดส่วนประเภทธุรกรรม" />
            </StudioSection>
          </>
        )}
      </div>
    </div>
  );
}
