"use client";

/**
 * Studio analytics overview (Epic C #788), after the "Analytics Dashboard" docs the dev supplied:
 * a range switch, metric cards whose digits roll and carry a sparkline, the main ECharts area chart,
 * and the best-selling titles. Data: GET /studio/stats (the caller's own sales only, #787).
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getStudioStats, type StudioStats } from "../../lib/studioApi";
import Pill from "../../components/ui/Pill";
import Loader from "../../components/ui/Loader";
import Mascot from "../../components/mascot/Mascot";
import LoadError from "../../components/ui/LoadError";
import RollingNumber from "./RollingNumber";
import StudioAreaChart from "./charts/StudioAreaChart";
import { sparklinePoints } from "../lib/shellMath";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const nf = new Intl.NumberFormat("th-TH");

function Sparkline({ values, tone }: { values: number[]; tone: "accent" | "coin" | "ok" | "ink" }) {
  const stroke = { accent: "var(--accent)", coin: "var(--coin)", ok: "var(--ok)", ink: "var(--ink-2)" }[tone];
  return (
    <svg viewBox="0 0 120 28" className="h-7 w-full" aria-hidden preserveAspectRatio="none">
      <polyline points={sparklinePoints(values, 120, 28)} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Metric({ label, value, unit, values, tone }: { label: string; value: number; unit?: string; values: number[]; tone: "accent" | "coin" | "ok" | "ink" }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--r3)] border border-line bg-surface p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`text-[1.75rem] font-semibold leading-none ${tone === "coin" ? "text-coin" : "text-ink"}`}>
        <RollingNumber value={nf.format(value)} />
        {unit ? <span className="ml-1.5 text-xs font-normal text-ink-3">{unit}</span> : null}
      </p>
      <Sparkline values={values} tone={tone} />
    </div>
  );
}

export default function StatsOverview() {
  const { getIdToken } = useAuth();
  const [range, setRange] = useState<Range>(30);
  const [result, setResult] = useState<{ range: Range; stats: StudioStats | null; failed: boolean } | null>(null);
  const [reload, setReload] = useState(0); // bumped by LoadError's retry (#1034)

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error("no token");
        const stats = await getStudioStats(token, range);
        if (!cancelled) setResult({ range, stats, failed: false });
      } catch {
        if (!cancelled) setResult({ range, stats: null, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken, range, reload]);

  const loading = result?.range !== range;
  const stats = loading ? null : result?.stats ?? null;
  const days = stats?.days ?? [];
  const labels = useMemo(() => days.map((d) => d.date.slice(5).replace("-", "/")), [days]);
  const series = useMemo(
    () => [
      { name: "ส่วนแบ่งของคุณ (เหรียญ)", values: days.map((d) => d.earnings), token: "--coin" as const },
      { name: "ปลดล็อก", values: days.map((d) => d.unlocks), token: "--accent" as const },
    ],
    [days],
  );
  const empty = stats !== null && stats.totals.unlocks === 0 && stats.totals.uploads === 0;

  return (
    <section aria-labelledby="studio-stats-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="studio-stats-title" className="text-lg font-semibold text-ink">
            ยอดขายของคุณ
          </h2>
          <p className="text-sm text-ink-3">นับเฉพาะตอนที่คุณเป็นผู้อัปโหลด · วันตามเวลา UTC</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="ช่วงเวลา">
          {RANGES.map((r) => (
            <Pill key={r} size="sm" selected={r === range} onClick={() => setRange(r)}>
              {r} วัน
            </Pill>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-[var(--r-card)] border border-line bg-surface">
          <Loader context="section" label="กำลังโหลดสถิติ" className="text-ink-2" />
        </div>
      ) : result?.failed ? (
        // a retry, like every other failed load (#1034); clearing the result shows the loader meanwhile
        <LoadError what="สถิติ" area="studio" onRetry={() => { setResult(null); setReload((n) => n + 1); }} />
      ) : empty ? (
        <div className="flex items-center gap-5 rounded-[var(--r-card)] border border-line bg-surface p-6">
          <Mascot area="studio" size={72} />
          <div>
            <p className="font-medium text-ink">ยังไม่มียอดขายใน {range} วันนี้</p>
            <p className="mt-1 text-sm text-ink-2">อัปโหลดตอนใหม่และตั้งราคา แล้วยอดปลดล็อกจะขึ้นที่นี่</p>
          </div>
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="ส่วนแบ่งของคุณ" value={stats.totals.earnings} unit="เหรียญ" values={days.map((d) => d.earnings)} tone="coin" />
            <Metric label="ยอดปลดล็อก" value={stats.totals.unlocks} unit="ครั้ง" values={days.map((d) => d.unlocks)} tone="accent" />
            <Metric label="ยอดขายรวม" value={stats.totals.revenue} unit="เหรียญ" values={days.map((d) => d.revenue)} tone="ink" />
            <Metric label="อัปโหลด" value={stats.totals.uploads} unit="ตอน" values={days.map((d) => d.uploads)} tone="ok" />
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.6fr,1fr]">
            <div className="rounded-[var(--r-card)] border border-line bg-surface p-5">
              <StudioAreaChart labels={labels} series={series} ariaLabel={`กราฟส่วนแบ่งและยอดปลดล็อก ${range} วัน`} />
            </div>
            <div className="rounded-[var(--r-card)] border border-line bg-surface p-5">
              <h3 className="text-sm font-medium text-ink">เรื่องที่ขายดี</h3>
              {stats.titles.length === 0 ? (
                <p className="mt-3 text-sm text-ink-3">ยังไม่มีเรื่องที่มียอดปลดล็อกในช่วงนี้</p>
              ) : (
                <ol className="mt-3 divide-y divide-line">
                  {stats.titles.slice(0, 6).map((t, i) => (
                    <li key={t.titleId} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 font-mono text-xs tabular-nums text-ink-3">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.titleName || "ไม่ระบุชื่อเรื่อง"}</span>
                      <span className="font-mono text-xs tabular-nums text-ink-2">{nf.format(t.unlocks)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
