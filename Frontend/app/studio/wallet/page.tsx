"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Coin from "../../components/ui/Coin";
import { ROLE } from "../../lib/types/user";

import LoadingScreen from "../../components/LoadingScreen";
import { useProtectedPage } from "../../hooks/useProtectedPage";
import { useToast } from "../../contexts/ToastContext";
import {
  getWalletBalance,
  getWalletTransactions,
  getCreatorEarnings,
  WalletTransaction,
  CreatorEarnings,
} from "../../lib/studioApi";
import { getCached, setCache } from "../../lib/studioCache";
import { StudioWalletSkeleton } from "../components/StudioSkeleton";
import { MetricCard, StudioSection } from "../components/StudioDashboardWidgets";
import StudioBarChart from "../components/charts/StudioBarChart";
import { StudioTabBar, StudioToolbar, tabPanelProps, type StudioTab } from "../components/StudioToolbar";
import { StudioSelect } from "../components/StudioSelect";
import {
  formatCurrency,
  getAvailableTransactionYears,
  getDailyWalletSeriesForMonth,
  getOverviewStats,
  getWalletMonthSummary,
  getWalletMonthlyTotals,
} from "../lib/dashboardAnalytics";
import { FileText, Gift, LockOpen, Undo2, Wallet, type LucideIcon } from "lucide-react";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
type WalletTab = "summary" | "charts" | "history";

// Tabs show one group at a time, so the wallet mounts only the charts on screen.
const WALLET_TABS: StudioTab<WalletTab>[] = [
  { key: "summary", label: "ภาพรวม" },
  { key: "charts", label: "กราฟ" },
  { key: "history", label: "ประวัติ" },
];

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isPositive = tx.type === "topup" || tx.type === "refund" || tx.type === "reward";
  const labels: Record<string, string> = {
    topup: "เติมเหรียญ",
    purchase: "ซื้อตอน",
    refund: "คืนเงิน",
    reward: "รางวัล",
  };
  const icons: Record<string, LucideIcon> = {
    topup: Wallet,
    purchase: LockOpen,
    refund: Undo2,
    reward: Gift,
  };
  const Icon = icons[tx.type] ?? FileText;

  const date = new Date(tx.createdAt);
  const dateStr = date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  const timeStr = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fill text-base">
        <Icon aria-hidden className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{labels[tx.type] ?? tx.type}</p>
        {tx.description ? <p className="truncate text-xs text-ink-3">{tx.description}</p> : null}
        <p className="text-[10px] text-ink-3">{dateStr} {timeStr}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold ${isPositive ? "text-coin" : "text-danger"}`}>
          {isPositive ? "+" : "-"}<Coin className="mr-1 inline align-[-0.125em] text-coin" />{formatCurrency(Math.abs(tx.amount))}
        </p>
        <p className="text-[10px] text-ink-3">คงเหลือ {formatCurrency(tx.balanceAfter)}</p>
      </div>
    </div>
  );
}

function WalletSummaryModal({
  open,
  onClose,
  transactionsCount,
  incomeTransactionsCount,
  spendingTransactionsCount,
  monthLabel,
}: {
  open: boolean;
  onClose: () => void;
  transactionsCount: number;
  incomeTransactionsCount: number;
  spendingTransactionsCount: number;
  monthLabel: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-scrim/75 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[1.75rem] border border-line bg-surface p-5 shadow-[0_50px_90px_-50px_rgb(0_0_0/.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">สรุปธุรกรรมทั้งหมด</h3>
            <p className="mt-1 text-sm text-ink-3">ภาพรวมรายรับ รายจ่าย และจำนวนรายการในระบบกระเป๋าเงิน</p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-2 transition hover:bg-raised hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-bg p-4">
          <div className="space-y-3 text-sm text-ink-2">
            <div className="flex items-center justify-between">
              <span>จำนวนรายการรวม</span>
              <span className="font-medium text-ink">{transactionsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>รายการรายรับ</span>
              <span className="font-medium text-coin">{incomeTransactionsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>รายการรายจ่าย</span>
              <span className="font-medium text-danger">{spendingTransactionsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>เดือนที่เลือก</span>
              <span className="font-medium text-ink">{monthLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { user, loading, getIdToken, userRole } = useProtectedPage();
  const { showToast } = useToast();

  const [balance, setBalance] = useState<number | null>(() => getCached<number>("wallet:balance") ?? null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => getCached<WalletTransaction[]>("wallet:transactions") ?? []);
  const [loadingData, setLoadingData] = useState(() => getCached("wallet:balance") === null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<WalletTab>("summary");
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [earnings, setEarnings] = useState<CreatorEarnings | null>(null);
  const hasFetched = useRef(false);

  const isCreator = userRole === ROLE.TRANSLATOR || userRole === ROLE.CREATOR;

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
      if (isCreator) {
        const earningsData = await getCreatorEarnings(token);
        setEarnings(earningsData);
      }
    } catch {
      showToast({ type: "error", message: "ไม่สามารถโหลดข้อมูลกระเป๋าเงินได้", duration: 3000 });
    } finally {
      setLoadingData(false);
    }
  }, [user, getIdToken, showToast, isCreator]);

  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
  }, [user, fetchData]);

  const availableYears = useMemo(() => getAvailableTransactionYears(transactions), [transactions]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const walletStats = useMemo(
    () => getOverviewStats([], transactions, balance),
    [transactions, balance],
  );
  const monthlySummary = useMemo(
    () => getWalletMonthSummary(transactions, selectedYear, selectedMonth),
    [transactions, selectedYear, selectedMonth],
  );
  const dailySeries = useMemo(
    () => getDailyWalletSeriesForMonth(transactions, selectedYear, selectedMonth),
    [transactions, selectedYear, selectedMonth],
  );
  const recentDailySeries = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === selectedYear && now.getMonth() === selectedMonth;
    const endDay = isCurrentMonth ? now.getDate() : dailySeries.length;
    const startDay = Math.max(1, endDay - 6);
    return dailySeries.slice(startDay - 1, endDay);
  }, [dailySeries, selectedMonth, selectedYear]);
  const monthlyTotals = useMemo(
    () => getWalletMonthlyTotals(transactions, 6),
    [transactions],
  );

  const incomeTransactions = useMemo(
    () => transactions.filter((tx) => tx.type === "topup" || tx.type === "reward" || tx.type === "refund"),
    [transactions],
  );
  const spendingTransactions = useMemo(
    () => transactions.filter((tx) => tx.type === "purchase"),
    [transactions],
  );

  if (loading) return <LoadingScreen />;

  return (
    <div className="text-ink">
      <StudioToolbar>
        <StudioTabBar tabs={WALLET_TABS} value={tab} onChange={setTab} label="มุมมองกระเป๋าเงิน" idBase="wallet" />
        <p className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-2">
          ยอดคงเหลือ <span className="font-semibold tabular-nums text-coin"><Coin className="mr-1 inline align-[-0.125em]" />{formatCurrency(balance ?? 0)}</span>
        </p>
      </StudioToolbar>

      <div {...tabPanelProps("wallet", tab)} className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {loadingData ? (
            <StudioWalletSkeleton />
          ) : (
            <div className="space-y-6">
              {tab === "summary" ? (
              <>
              <StudioSection 
                title="ภาพรวมกระเป๋าเงิน" 
                subtitle="รวมยอดเคลื่อนไหวหลักของบัญชีคุณ"
                action={
                  <button
                    onClick={() => setShowSummaryModal(true)}
                    className="rounded-xl border border-line bg-fill px-3 py-2 text-sm font-medium text-ink-2 transition hover:border-ink-3 hover:bg-raised hover:text-ink"
                  >
                    ดูเพิ่มเติม
                  </button>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="เหรียญคงเหลือ" value={<><Coin className="mr-1.5 inline align-[-0.1em] text-coin" />{formatCurrency(walletStats.balance)}</>} hint="ยอดล่าสุดใน wallet" tone="amber" />
                  <MetricCard label="รายรับสะสม" value={formatCurrency(walletStats.topupTotal + walletStats.rewardTotal)} hint="topup, reward, refund" tone="indigo" />
                  <MetricCard label="ใช้จ่ายสะสม" value={formatCurrency(walletStats.spendingTotal)} hint="purchase ทั้งหมด" tone="rose" />
                  <MetricCard label="รางวัล/คืนเงิน" value={formatCurrency(walletStats.rewardTotal)} hint="reward + refund" tone="sky" />
                </div>
              </StudioSection>

              {isCreator && earnings !== null && (
                <StudioSection
                  title="ยอดขาย"
                  subtitle="สถิติการขายบทแปลสะสมทั้งหมดของคุณ"
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="ยอดขายทั้งหมด" value={earnings.totalSales} hint="จำนวนครั้งที่มีคนซื้อ" tone="indigo" />
                    <MetricCard label="รายได้สะสม" value={formatCurrency(earnings.totalEarned)} hint="หลังหัก 30% platform fee" tone="emerald" />
                    <MetricCard label="ชื่อเรื่องที่ขายได้" value={earnings.titlesSold} hint="จำนวน title ที่มียอดขาย" tone="sky" />
                    <MetricCard label="ผู้ซื้อไม่ซ้ำ" value={earnings.uniqueBuyers} hint="unique buyer ทั้งหมด" tone="amber" />
                  </div>
                </StudioSection>
              )}
              </>
              ) : tab === "charts" ? (
              <div className="grid gap-6 xl:grid-cols-2">
                <StudioSection
                  title={`ข้อมูลประจำเดือน: ${THAI_MONTHS[selectedMonth]} ${selectedYear}`}
                  subtitle="กราฟรายวันของรายรับและรายจ่ายเฉพาะ 7 วันล่าสุดในเดือนที่เลือก"
                  action={
                    <div className="flex gap-2">
                      <div className="min-w-[10rem]">
                        <StudioSelect
                          label="เดือน"
                          value={String(selectedMonth)}
                          onChange={(value) => setSelectedMonth(Number(value))}
                          options={THAI_MONTHS.map((monthLabel, monthIndex) => ({ value: String(monthIndex), label: monthLabel }))}
                        />
                      </div>
                      <div className="min-w-[8rem]">
                        <StudioSelect
                          label="ปี"
                          value={String(selectedYear)}
                          onChange={(value) => setSelectedYear(Number(value))}
                          options={availableYears.map((year) => ({ value: String(year), label: String(year) }))}
                        />
                      </div>
                    </div>
                  }
                >
                  <StudioBarChart points={recentDailySeries} valueFormatter={formatCurrency} ariaLabel="รายรับและรายจ่ายรายวันของเดือนที่เลือก" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MetricCard label="รายรับเดือนนี้" value={formatCurrency(monthlySummary.income)} tone="indigo" />
                    <MetricCard label="รายจ่ายเดือนนี้" value={formatCurrency(monthlySummary.spending)} tone="rose" />
                    <MetricCard label="สุทธิเดือนนี้" value={formatCurrency(monthlySummary.net)} tone={monthlySummary.net >= 0 ? "emerald" : "amber"} />
                  </div>
                </StudioSection>

                <StudioSection title="ภาพรวม 6 เดือนล่าสุด" subtitle="เปรียบเทียบ income / spending แบบ monthly">
                  <StudioBarChart points={monthlyTotals} valueFormatter={formatCurrency} ariaLabel="รายรับและรายจ่ายรายเดือน 6 เดือนล่าสุด" />
                </StudioSection>
              </div>
              ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                <StudioSection title={`ประวัติรายรับ - ${THAI_MONTHS[selectedMonth]} ${selectedYear}`} subtitle="topup, refund และ reward ทั้งหมด">
                  {incomeTransactions.length === 0 ? (
                    <p className="py-10 text-center text-sm text-ink-3">ยังไม่มีประวัติรายรับ</p>
                  ) : (
                    <div className="custom-scrollbar max-h-[360px] overflow-y-auto">
                      {incomeTransactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                    </div>
                  )}
                </StudioSection>

                <StudioSection title={`ประวัติรายจ่าย - ${THAI_MONTHS[selectedMonth]} ${selectedYear}`} subtitle="รายการ purchase ทั้งหมดในกระเป๋าเงิน">
                  {spendingTransactions.length === 0 ? (
                    <p className="py-10 text-center text-sm text-ink-3">ยังไม่มีประวัติการใช้จ่าย</p>
                  ) : (
                    <div className="custom-scrollbar max-h-[360px] overflow-y-auto">
                      {spendingTransactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                    </div>
                  )}
                </StudioSection>
              </div>
              )}
            </div>
          )}
      </div>

      <WalletSummaryModal
        open={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        transactionsCount={transactions.length}
        incomeTransactionsCount={incomeTransactions.length}
        spendingTransactionsCount={spendingTransactions.length}
        monthLabel={THAI_MONTHS[selectedMonth]}
      />
    </div>
  );
}
