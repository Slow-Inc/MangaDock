"use client";

import { useEffect, useMemo, useState } from "react";
import { getHistory } from "../../lib/readingHistory";

type HistoryBook = ReturnType<typeof getHistory>[number];

function calcStreak(books: HistoryBook[]): number {
  const days = new Set(
    books.map((b) => new Date(b.lastReadAt).toDateString()),
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (days.has(d.toDateString())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function topGenres(books: HistoryBook[], limit = 5): { genre: string; count: number }[] {
  const map = new Map<string, number>();
  for (const b of books) {
    for (const g of b.categories ?? []) {
      map.set(g, (map.get(g) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, count]) => ({ genre, count }));
}

function activityByDayOfWeek(books: HistoryBook[]): number[] {
  const days = Array(7).fill(0);
  for (const b of books) {
    days[new Date(b.lastReadAt).getDay()]++;
  }
  return days;
}

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function StatsPage() {
  const [history, setHistory] = useState<HistoryBook[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const streak = useMemo(() => calcStreak(history), [history]);
  const genres = useMemo(() => topGenres(history), [history]);
  const activity = useMemo(() => activityByDayOfWeek(history), [history]);
  const maxActivity = Math.max(...activity, 1);

  const totalSeries = history.length;
  const recentCount = history.filter(
    (b) => b.lastReadAt > Date.now() - 7 * 86400_000,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white/90">สถิติการอ่าน</h2>
        <p className="mt-0.5 text-sm text-white/40">ข้อมูลจากประวัติการอ่านในเครื่องของคุณ</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Series ที่อ่าน" value={totalSeries} sub="ทั้งหมด (สูงสุด 30)" />
        <StatCard label="อ่านสัปดาห์นี้" value={recentCount} sub="7 วันที่ผ่านมา" />
        <StatCard label="Streak" value={streak} sub="วันติดต่อกัน" accent />
      </div>

      {/* Activity by day of week */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <p className="mb-4 text-sm font-semibold text-white/70">กิจกรรมรายวัน</p>
        <div className="flex items-end gap-2">
          {activity.map((count, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-indigo-500/60 transition-all"
                style={{ height: `${Math.max(4, (count / maxActivity) * 80)}px` }}
              />
              <span className="text-xs text-white/30">{DAY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top genres */}
      {genres.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
          <p className="mb-4 text-sm font-semibold text-white/70">แนวที่ชอบ</p>
          <div className="space-y-2.5">
            {genres.map(({ genre, count }) => (
              <div key={genre} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs text-white/60">{genre}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500/70"
                    style={{ width: `${(count / (genres[0]?.count ?? 1)) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-white/35">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="py-16 text-center text-sm text-white/30">
          ยังไม่มีประวัติการอ่าน เริ่มอ่านมังงะเพื่อดูสถิติของคุณ
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-indigo-500/30 bg-indigo-500/8" : "border-white/8 bg-white/3"}`}>
      <p className="text-xs text-white/40">{label}</p>
      <p className={`mt-1 text-3xl font-black ${accent ? "text-indigo-300" : "text-white/90"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-white/30">{sub}</p>
    </div>
  );
}
