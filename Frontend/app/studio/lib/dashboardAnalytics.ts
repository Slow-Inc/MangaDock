"use client";

import { createVersion, type WalletTransaction } from "../../lib/studioApi";
import type { ChapterVersion } from "../../lib/types";

export type ChartPoint = {
  label: string;
  value: number;
};

export type StackedChartPoint = {
  label: string;
  income: number;
  spending: number;
  net: number;
};

export type BreakdownDatum = {
  label: string;
  value: number;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";
};

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function getTransactionIncomeAmount(tx: WalletTransaction) {
  return tx.type === "topup" || tx.type === "reward" || tx.type === "refund"
    ? Math.max(0, tx.amount)
    : 0;
}

function getTransactionSpendingAmount(tx: WalletTransaction) {
  return tx.type === "purchase" ? Math.abs(tx.amount) : 0;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value);
}

export function getOverviewStats(versions: ChapterVersion[], transactions: WalletTransaction[], balance: number | null) {
  const titles = new Set(versions.map((version) => version.titleId));
  const languages = new Set(versions.map((version) => version.language));
  const paidVersions = versions.filter((version) => version.priceCoins > 0);
  const totalPages = versions.reduce((sum, version) => sum + (version.pages?.length ?? 0), 0);
  const totalQuality = versions.reduce((sum, version) => sum + (version.qualityScore ?? 0), 0);
  const published = versions.filter((version) => version.status === "published").length;
  const draft = versions.filter((version) => version.status === "draft").length;
  const pending = versions.filter((version) => version.status === "pending_moderation").length;
  const rejected = versions.filter((version) => version.status === "rejected").length;
  const approved = versions.filter((version) => version.status === "approved").length;

  const topupTotal = transactions.reduce((sum, tx) => sum + (tx.type === "topup" ? Math.max(0, tx.amount) : 0), 0);
  const rewardTotal = transactions.reduce((sum, tx) => sum + (tx.type === "reward" || tx.type === "refund" ? Math.max(0, tx.amount) : 0), 0);
  const spendingTotal = transactions.reduce((sum, tx) => sum + (tx.type === "purchase" ? Math.abs(tx.amount) : 0), 0);

  return {
    totalWorks: titles.size,
    totalChapters: versions.length,
    totalPages,
    languages: languages.size,
    paidChapters: paidVersions.length,
    published,
    draft,
    pending,
    rejected,
    approved,
    balance: balance ?? 0,
    topupTotal,
    rewardTotal,
    spendingTotal,
    avgQuality: versions.length > 0 ? totalQuality / versions.length : 0,
    avgPrice: paidVersions.length > 0
      ? paidVersions.reduce((sum, version) => sum + version.priceCoins, 0) / paidVersions.length
      : 0,
  };
}

export function getVersionStatusBreakdown(versions: ChapterVersion[]): BreakdownDatum[] {
  const counts = versions.reduce<Record<string, number>>((acc, version) => {
    acc[version.status] = (acc[version.status] ?? 0) + 1;
    return acc;
  }, {});

  const result: BreakdownDatum[] = [
    { label: "เผยแพร่", value: counts.published ?? 0, tone: "emerald" },
    { label: "ร่าง", value: counts.draft ?? 0, tone: "slate" },
    { label: "รอตรวจ", value: counts.pending_moderation ?? 0, tone: "amber" },
    { label: "อนุมัติ", value: counts.approved ?? 0, tone: "sky" },
    { label: "โดน moderator ลบ", value: counts.rejected ?? 0, tone: "rose" },
  ];
  return result.filter((item) => item.value > 0);
}

export function getLanguageBreakdown(versions: ChapterVersion[]): BreakdownDatum[] {
  const counts = versions.reduce<Record<string, number>>((acc, version) => {
    acc[version.language] = (acc[version.language] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([language, value], index) => ({
      label: language.toUpperCase(),
      value,
      tone: (["indigo", "violet", "sky", "emerald", "amber", "rose"] as const)[index % 6],
    }))
    .sort((a, b) => b.value - a.value);
}

export function getTopTitlesByChapterCount(versions: ChapterVersion[], limit = 6): BreakdownDatum[] {
  const grouped = versions.reduce<Record<string, { titleName: string; count: number }>>((acc, version) => {
    if (!acc[version.titleId]) {
      acc[version.titleId] = { titleName: version.titleName || "ไม่ระบุชื่อเรื่อง", count: 0 };
    }
    acc[version.titleId].count += 1;
    return acc;
  }, {});

  return Object.values(grouped)
    .map((entry, index) => ({
      label: entry.titleName,
      value: entry.count,
      tone: (["indigo", "violet", "sky", "emerald", "amber", "rose"] as const)[index % 6],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function getWalletFlowLastDays(transactions: WalletTransaction[], days = 30): StackedChartPoint[] {
  const now = new Date();
  const today = startOfDay(now);
  const buckets = new Map<string, { label: string; income: number; spending: number; net: number }>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const bucketDate = new Date(today);
    bucketDate.setDate(today.getDate() - offset);
    buckets.set(dayKey(bucketDate), {
      label: `${bucketDate.getDate()}`,
      income: 0,
      spending: 0,
      net: 0,
    });
  }

  for (const tx of transactions) {
    const txDate = startOfDay(new Date(tx.createdAt));
    const key = dayKey(txDate);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.income += getTransactionIncomeAmount(tx);
    bucket.spending += getTransactionSpendingAmount(tx);
    bucket.net = bucket.income - bucket.spending;
  }

  return Array.from(buckets.values());
}

export function getWalletMonthlyTotals(transactions: WalletTransaction[], months = 6): StackedChartPoint[] {
  const now = new Date();
  const buckets = new Map<string, { label: string; income: number; spending: number; net: number }>();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.set(monthKey(bucketDate), {
      label: THAI_MONTHS_SHORT[bucketDate.getMonth()],
      income: 0,
      spending: 0,
      net: 0,
    });
  }

  for (const tx of transactions) {
    const txDate = new Date(tx.createdAt);
    const key = monthKey(txDate);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.income += getTransactionIncomeAmount(tx);
    bucket.spending += getTransactionSpendingAmount(tx);
    bucket.net = bucket.income - bucket.spending;
  }

  return Array.from(buckets.values());
}

export function getTransactionTypeBreakdown(transactions: WalletTransaction[]): BreakdownDatum[] {
  const counts = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.type] = (acc[tx.type] ?? 0) + 1;
    return acc;
  }, {});

  const result: BreakdownDatum[] = [
    { label: "เติมเหรียญ", value: counts.topup ?? 0, tone: "indigo" },
    { label: "ซื้อ", value: counts.purchase ?? 0, tone: "rose" },
    { label: "คืนเงิน", value: counts.refund ?? 0, tone: "sky" },
    { label: "รางวัล", value: counts.reward ?? 0, tone: "amber" },
  ];
  return result.filter((item) => item.value > 0);
}

export function getAvailableTransactionYears(transactions: WalletTransaction[]) {
  const years = new Set(transactions.map((tx) => new Date(tx.createdAt).getFullYear()));
  if (years.size === 0) years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

export function getDailyWalletSeriesForMonth(
  transactions: WalletTransaction[],
  year: number,
  monthIndex: number,
): StackedChartPoint[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const buckets = Array.from({ length: daysInMonth }, (_, dayIndex) => ({
    label: `${dayIndex + 1}`,
    income: 0,
    spending: 0,
    net: 0,
  }));

  for (const tx of transactions) {
    const txDate = new Date(tx.createdAt);
    if (txDate.getFullYear() !== year || txDate.getMonth() !== monthIndex) continue;

    const bucket = buckets[txDate.getDate() - 1];
    if (!bucket) continue;
    bucket.income += getTransactionIncomeAmount(tx);
    bucket.spending += getTransactionSpendingAmount(tx);
    bucket.net = bucket.income - bucket.spending;
  }

  return buckets;
}

export function getWalletMonthSummary(
  transactions: WalletTransaction[],
  year: number,
  monthIndex: number,
) {
  return transactions.reduce(
    (summary, tx) => {
      const txDate = new Date(tx.createdAt);
      if (txDate.getFullYear() !== year || txDate.getMonth() !== monthIndex) return summary;

      summary.income += getTransactionIncomeAmount(tx);
      summary.spending += getTransactionSpendingAmount(tx);
      summary.net = summary.income - summary.spending;
      summary.count += 1;
      return summary;
    },
    { income: 0, spending: 0, net: 0, count: 0 },
  );
}

export function getAccountProfileCompleteness(profile: {
  bio: string;
  languages: string[];
  country: string;
  preferredLanguage: string;
  hasPhoto: boolean;
}) {
  const checklist = [
    Boolean(profile.bio.trim()),
    profile.languages.length > 0,
    Boolean(profile.country.trim()),
    Boolean(profile.preferredLanguage.trim()),
    profile.hasPhoto,
  ];

  const completed = checklist.filter(Boolean).length;
  return {
    completed,
    total: checklist.length,
    percent: Math.round((completed / checklist.length) * 100),
  };
}
