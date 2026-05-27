"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  getWalletBalance,
  getWalletTransactions,
  getCreatorEarnings,
  WalletTransaction,
  CreatorEarnings,
} from "../../lib/studioApi";
import { getCached, setCache } from "../../lib/studioCache";
import StudioNav from "../components/StudioNav";
import { StudioWalletSkeleton } from "../components/StudioSkeleton";
import {
  GroupedBarChart,
  MetricCard,
  StudioAnnouncement,
  StudioSection,
} from "../components/StudioDashboardWidgets";
import {
  StudioMobileHeader,
  StudioMobileHero,
  StudioMobileMenuCard,
  StudioMobileSection,
} from "../components/StudioMobileShell";
import { StudioSelect } from "../components/StudioSelect";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  formatCurrency,
  getAvailableTransactionYears,
  getDailyWalletSeriesForMonth,
  getOverviewStats,
  getWalletMonthSummary,
  getWalletMonthlyTotals,
} from "../lib/dashboardAnalytics";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
type WalletMobileView = "menu" | "analytics" | "income" | "spending";

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
        {tx.description ? <p className="truncate text-xs text-white/30">{tx.description}</p> : null}
        <p className="text-[10px] text-white/20">{dateStr} {timeStr}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold ${isPositive ? "text-indigo-300" : "text-rose-300"}`}>
          {isPositive ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
        </p>
        <p className="text-[10px] text-white/20">คงเหลือ {formatCurrency(tx.balanceAfter)}</p>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[1.75rem] border border-white/12 bg-[#151518]/92 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">สรุปธุรกรรมทั้งหมด</h3>
            <p className="mt-1 text-sm text-white/45">ภาพรวมรายรับ รายจ่าย และจำนวนรายการในระบบกระเป๋าเงิน</p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="space-y-3 text-sm text-white/55">
            <div className="flex items-center justify-between">
              <span>จำนวนรายการรวม</span>
              <span className="font-medium text-white">{transactionsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>รายการรายรับ</span>
              <span className="font-medium text-indigo-300">{incomeTransactionsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>รายการรายจ่าย</span>
              <span className="font-medium text-rose-300">{spendingTransactionsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>เดือนที่เลือก</span>
              <span className="font-medium text-white">{monthLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const { user, loading, getIdToken, userRole } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [balance, setBalance] = useState<number | null>(() => getCached<number>("wallet:balance") ?? null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => getCached<WalletTransaction[]>("wallet:transactions") ?? []);
  const [loadingData, setLoadingData] = useState(() => getCached("wallet:balance") === null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [mobileView, setMobileView] = useState<WalletMobileView>("menu");
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [earnings, setEarnings] = useState<CreatorEarnings | null>(null);
  const hasFetched = useRef(false);

  const isCreator = userRole === "translator" || userRole === "creator";

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

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (isMobile) {
    const renderMobileContent = () => {
      if (loadingData) {
        return <StudioWalletSkeleton />;
      }

      if (mobileView === "menu") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioAnnouncement />

            <StudioMobileHero
              eyebrow="Wallet Center"
              title="กระเป๋าเงินนักแปล"
              description="มือถือจะพาคุณดูเฉพาะยอดหลักและ action สำคัญก่อน แล้วค่อยแยกกราฟกับประวัติธุรกรรมเป็นหน้าย่อย"
              aside={(
                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-3 py-2 text-right">
                  <p className="text-[10px] text-white/45">คงเหลือ</p>
                  <p className="mt-1 text-xl font-semibold text-amber-300">{formatCurrency(balance ?? 0)}</p>
                </div>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="รายรับสะสม" value={formatCurrency(walletStats.topupTotal + walletStats.rewardTotal)} hint="topup, reward, refund" tone="indigo" />
              <MetricCard label="ใช้จ่ายสะสม" value={formatCurrency(walletStats.spendingTotal)} hint="purchase ทั้งหมด" tone="rose" />
              <MetricCard label="รางวัล/คืนเงิน" value={formatCurrency(walletStats.rewardTotal)} hint="reward + refund" tone="sky" />
              <MetricCard label="รายการทั้งหมด" value={transactions.length} hint={`เดือน ${THAI_MONTHS[selectedMonth]}`} tone="amber" />
            </div>

            <button
              onClick={() => setShowSummaryModal(true)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/8"
            >
              ดูเพิ่มเติม
            </button>

            {isCreator && earnings !== null && (
              <StudioMobileSection title="ยอดขาย" subtitle="สถิติการขายบทแปลสะสม">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="ยอดขายทั้งหมด" value={earnings.totalSales} hint="จำนวนครั้งที่ซื้อ" tone="indigo" />
                  <MetricCard label="รายได้สะสม" value={formatCurrency(earnings.totalEarned)} hint="หลังหัก 30%" tone="emerald" />
                  <MetricCard label="ชื่อเรื่อง" value={earnings.titlesSold} hint="title ที่มียอดขาย" tone="sky" />
                  <MetricCard label="ผู้ซื้อไม่ซ้ำ" value={earnings.uniqueBuyers} hint="unique buyers" tone="amber" />
                </div>
              </StudioMobileSection>
            )}

            <StudioMobileSection title="ดูรายละเอียดเพิ่ม" subtitle="แยกข้อมูลที่เยอะเป็นหน้าจอย่อยตามแบบ native mobile">
              <div className="space-y-3">
                <StudioMobileMenuCard
                  icon={<span className="text-lg">📈</span>}
                  title="สรุปรายเดือน"
                  description="กราฟรายวันของเดือนที่เลือก และภาพรวม 6 เดือนล่าสุด"
                  value={`${THAI_MONTHS[selectedMonth]} ${selectedYear}`}
                  tone="indigo"
                  onClick={() => setMobileView("analytics")}
                />
                <StudioMobileMenuCard
                  icon={<span className="text-lg">🟢</span>}
                  title="ประวัติรายรับ"
                  description="ดู topup, reward และ refund แบบเต็มหน้าจอ"
                  value={`${incomeTransactions.length} รายการ`}
                  tone="emerald"
                  onClick={() => setMobileView("income")}
                />
                <StudioMobileMenuCard
                  icon={<span className="text-lg">🔴</span>}
                  title="ประวัติรายจ่าย"
                  description="รวมรายการ purchase ทั้งหมดในกระเป๋าเงิน"
                  value={`${spendingTransactions.length} รายการ`}
                  tone="rose"
                  onClick={() => setMobileView("spending")}
                />
              </div>
            </StudioMobileSection>
          </div>
        );
      }

      if (mobileView === "analytics") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioMobileHeader
              title="สรุปรายเดือน"
              subtitle="กราฟและสถิติแบบเต็มหน้าจอสำหรับมือถือ"
              onBack={() => setMobileView("menu")}
            />
            <StudioMobileSection title="เลือกเดือนที่ต้องการ" subtitle="กรองข้อมูลกราฟก่อนลงรายละเอียด">
              <div className="grid grid-cols-2 gap-2">
                <StudioSelect
                  value={String(selectedMonth)}
                  onChange={(value) => setSelectedMonth(Number(value))}
                  options={THAI_MONTHS.map((monthLabel, monthIndex) => ({ value: String(monthIndex), label: monthLabel }))}
                />
                <StudioSelect
                  value={String(selectedYear)}
                  onChange={(value) => setSelectedYear(Number(value))}
                  options={availableYears.map((year) => ({ value: String(year), label: String(year) }))}
                />
              </div>
            </StudioMobileSection>
            <StudioMobileSection title={`ข้อมูลประจำเดือน ${THAI_MONTHS[selectedMonth]} ${selectedYear}`}>
              <GroupedBarChart points={recentDailySeries} valueFormatter={formatCurrency} />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <MetricCard label="รายรับ" value={formatCurrency(monthlySummary.income)} tone="indigo" />
                <MetricCard label="รายจ่าย" value={formatCurrency(monthlySummary.spending)} tone="rose" />
                <MetricCard label="สุทธิ" value={formatCurrency(monthlySummary.net)} tone={monthlySummary.net >= 0 ? "emerald" : "amber"} />
              </div>
            </StudioMobileSection>
            <StudioMobileSection title="ภาพรวม 6 เดือนล่าสุด">
              <GroupedBarChart points={monthlyTotals} valueFormatter={formatCurrency} />
            </StudioMobileSection>
          </div>
        );
      }

      const targetTransactions = mobileView === "income" ? incomeTransactions : spendingTransactions;
      const targetTitle = mobileView === "income" ? "ประวัติรายรับ" : "ประวัติรายจ่าย";
      const targetSubtitle = mobileView === "income" ? "topup, reward และ refund" : "รายการ purchase ทั้งหมด";

      return (
        <div className="space-y-4 px-4 py-4">
          <StudioMobileHeader
            title={targetTitle}
            subtitle={targetSubtitle}
            onBack={() => setMobileView("menu")}
          />
          <StudioMobileSection title={`${targetTitle} - ${THAI_MONTHS[selectedMonth]} ${selectedYear}`}>
            {targetTransactions.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/30">ยังไม่มีรายการ</p>
            ) : (
              <div className="space-y-1">
                {targetTransactions.map((tx) => <TransactionRow key={`${mobileView}-${tx.id}`} tx={tx} />)}
              </div>
            )}
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

          <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-white/35">Wallet Center</p>
                <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">กระเป๋าเงินนักแปล</h1>
                <p className="mt-2 text-sm text-white/45">ดูยอดคงเหลือ แนวโน้มรายวัน รายเดือน และประวัติธุรกรรมในโครงแบบใกล้ dashboard ของ ReadRealm</p>
              </div>
              <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-right">
                <p className="text-xs text-white/45">ยอดคงเหลือปัจจุบัน</p>
                <p className="mt-1 text-2xl font-semibold text-amber-300">{formatCurrency(balance ?? 0)}</p>
              </div>
            </div>
          </div>

          <StudioNav />

          {loadingData ? (
            <StudioWalletSkeleton />
          ) : (
            <div className="space-y-6">
              <StudioSection 
                title="ภาพรวมกระเป๋าเงิน" 
                subtitle="รวมยอดเคลื่อนไหวหลักของบัญชีคุณ"
                action={
                  <button
                    onClick={() => setShowSummaryModal(true)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/8 hover:text-white"
                  >
                    ดูเพิ่มเติม
                  </button>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="เหรียญคงเหลือ" value={formatCurrency(walletStats.balance)} hint="ยอดล่าสุดใน wallet" tone="amber" />
                  <MetricCard label="รายรับสะสม" value={formatCurrency(walletStats.topupTotal + walletStats.rewardTotal)} hint="topup, reward, refund" tone="indigo" />
                  <MetricCard label="ใช้จ่ายสะสม" value={formatCurrency(walletStats.spendingTotal)} hint="purchase ทั้งหมด" tone="rose" />
                  <MetricCard label="รางวัล/คืนเงิน" value={formatCurrency(walletStats.rewardTotal)} hint="reward + refund" tone="sky" />
                </div>
              </StudioSection>

              {isCreator && earnings !== null && (
                <StudioSection
                  title="ยอดขาย"
                  subtitle="สถิติการขายบทแปลสะสมทั้งหมดของคุณ — ข้อมูลจาก translator_earnings"
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="ยอดขายทั้งหมด" value={earnings.totalSales} hint="จำนวนครั้งที่มีคนซื้อ" tone="indigo" />
                    <MetricCard label="รายได้สะสม" value={formatCurrency(earnings.totalEarned)} hint="หลังหัก 30% platform fee" tone="emerald" />
                    <MetricCard label="ชื่อเรื่องที่ขายได้" value={earnings.titlesSold} hint="จำนวน title ที่มียอดขาย" tone="sky" />
                    <MetricCard label="ผู้ซื้อไม่ซ้ำ" value={earnings.uniqueBuyers} hint="unique buyer ทั้งหมด" tone="amber" />
                  </div>
                </StudioSection>
              )}

              <div className="grid gap-6 xl:grid-cols-2">
                <StudioSection
                  title={`ข้อมูลประจำเดือน: ${THAI_MONTHS[selectedMonth]} ${selectedYear}`}
                  subtitle="กราฟรายวันของรายรับและรายจ่ายเฉพาะ 7 วันล่าสุดในเดือนที่เลือก"
                  action={
                    <div className="flex gap-2">
                      <div className="min-w-[10rem]">
                        <StudioSelect
                          value={String(selectedMonth)}
                          onChange={(value) => setSelectedMonth(Number(value))}
                          options={THAI_MONTHS.map((monthLabel, monthIndex) => ({ value: String(monthIndex), label: monthLabel }))}
                        />
                      </div>
                      <div className="min-w-[8rem]">
                        <StudioSelect
                          value={String(selectedYear)}
                          onChange={(value) => setSelectedYear(Number(value))}
                          options={availableYears.map((year) => ({ value: String(year), label: String(year) }))}
                        />
                      </div>
                    </div>
                  }
                >
                  <GroupedBarChart points={recentDailySeries} valueFormatter={formatCurrency} />
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MetricCard label="รายรับเดือนนี้" value={formatCurrency(monthlySummary.income)} tone="indigo" />
                    <MetricCard label="รายจ่ายเดือนนี้" value={formatCurrency(monthlySummary.spending)} tone="rose" />
                    <MetricCard label="สุทธิเดือนนี้" value={formatCurrency(monthlySummary.net)} tone={monthlySummary.net >= 0 ? "emerald" : "amber"} />
                  </div>
                </StudioSection>

                <StudioSection title="ภาพรวม 6 เดือนล่าสุด" subtitle="เปรียบเทียบ income / spending แบบ monthly">
                  <GroupedBarChart points={monthlyTotals} valueFormatter={formatCurrency} />
                </StudioSection>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <StudioSection title={`ประวัติรายรับ - ${THAI_MONTHS[selectedMonth]} ${selectedYear}`} subtitle="topup, refund และ reward ทั้งหมด">
                  {incomeTransactions.length === 0 ? (
                    <p className="py-10 text-center text-sm text-white/30">ยังไม่มีประวัติรายรับ</p>
                  ) : (
                    <div className="custom-scrollbar max-h-[360px] overflow-y-auto">
                      {incomeTransactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                    </div>
                  )}
                </StudioSection>

                <StudioSection title={`ประวัติรายจ่าย - ${THAI_MONTHS[selectedMonth]} ${selectedYear}`} subtitle="รายการ purchase ทั้งหมดในกระเป๋าเงิน">
                  {spendingTransactions.length === 0 ? (
                    <p className="py-10 text-center text-sm text-white/30">ยังไม่มีประวัติการใช้จ่าย</p>
                  ) : (
                    <div className="custom-scrollbar max-h-[360px] overflow-y-auto">
                      {spendingTransactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                    </div>
                  )}
                </StudioSection>
              </div>
            </div>
          )}
        </div>
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
