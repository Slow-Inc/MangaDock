"use client";

import type { ReactNode } from "react";
import type { BreakdownDatum, ChartPoint, StackedChartPoint } from "../lib/dashboardAnalytics";
import { formatCompactNumber } from "../lib/dashboardAnalytics";

const TONE_STYLES = {
  indigo: {
    text: "text-indigo-300",
    border: "border-indigo-500/20",
    bg: "bg-indigo-500/10",
    fill: "#818cf8",
    softFill: "rgba(129,140,248,0.28)",
  },
  emerald: {
    text: "text-emerald-300",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
    fill: "#34d399",
    softFill: "rgba(52,211,153,0.24)",
  },
  amber: {
    text: "text-amber-300",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
    fill: "#fbbf24",
    softFill: "rgba(251,191,36,0.26)",
  },
  rose: {
    text: "text-rose-300",
    border: "border-rose-500/20",
    bg: "bg-rose-500/10",
    fill: "#fb7185",
    softFill: "rgba(251,113,133,0.24)",
  },
  sky: {
    text: "text-sky-300",
    border: "border-sky-500/20",
    bg: "bg-sky-500/10",
    fill: "#38bdf8",
    softFill: "rgba(56,189,248,0.24)",
  },
  violet: {
    text: "text-violet-300",
    border: "border-violet-500/20",
    bg: "bg-violet-500/10",
    fill: "#a78bfa",
    softFill: "rgba(167,139,250,0.24)",
  },
  slate: {
    text: "text-white/70",
    border: "border-white/10",
    bg: "bg-white/5",
    fill: "#94a3b8",
    softFill: "rgba(148,163,184,0.22)",
  },
} as const;

type Tone = keyof typeof TONE_STYLES;

function getToneStyles(tone: Tone = "indigo") {
  return TONE_STYLES[tone];
}

export function StudioAnnouncement() {
  return (
    <div className="rounded-2xl border border-indigo-400/35 bg-indigo-500/8 px-4 py-3 text-sm text-indigo-200 shadow-[0_0_0_1px_rgba(129,140,248,0.05)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-indigo-400/15 p-1 text-indigo-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.11 12.3A2 2 0 004.91 19h14.18a2 2 0 001.73-2.84l-7.11-12.3a2 2 0 00-3.46 0z" />
          </svg>
        </div>
        <p>
          ประกาศ: แดชบอร์ด Studio แสดงข้อมูลจากระบบจริงที่มีอยู่ใน MetaBooks แล้ว และจะขยายเพิ่มได้ทันทีเมื่อ backend analytics พร้อม
        </p>
      </div>
    </div>
  );
}

export function StudioSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-white/35">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const styles = getToneStyles(tone);
  return (
    <div className={`rounded-2xl border ${styles.border} ${styles.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-white/45">{label}</p>
          <div className={`mt-2 text-2xl font-semibold ${styles.text}`}>{value}</div>
          {hint ? <p className="mt-1 text-[11px] text-white/30">{hint}</p> : null}
        </div>
        {icon ? <div className={`shrink-0 ${styles.text}`}>{icon}</div> : null}
      </div>
    </div>
  );
}

export function LegendRow({
  items,
}: {
  items: Array<{ label: string; tone: Tone }>;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => {
        const styles = getToneStyles(item.tone);
        return (
          <div key={item.label} className="flex items-center gap-2 text-xs text-white/45">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: styles.fill }} />
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-sm text-white/30">
      {label}
    </div>
  );
}

export function LineChart({
  points,
  stroke = "#818cf8",
  fill = "rgba(129,140,248,0.16)",
  valueFormatter = formatCompactNumber,
}: {
  points: ChartPoint[];
  stroke?: string;
  fill?: string;
  valueFormatter?: (value: number) => string;
}) {
  if (points.length === 0 || points.every((point) => point.value === 0)) {
    return <EmptyChartState label="ยังไม่มีข้อมูลเพียงพอสำหรับกราฟนี้" />;
  }

  const width = 720;
  const height = 256;
  const padding = 18;
  const labelBand = 26;
  const plotBottom = height - padding - labelBand;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : width - padding * 2;

  const coords = points.map((point, index) => {
    const x = padding + index * stepX;
    const y = plotBottom - (point.value / maxValue) * (plotBottom - padding);
    return { ...point, x, y };
  });

  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${plotBottom} L ${coords[0].x} ${plotBottom} Z`;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/25 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[256px] w-full">
          {Array.from({ length: 5 }).map((_, row) => {
            const y = padding + ((plotBottom - padding) / 4) * row;
            return (
              <g key={row}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
                <text x={4} y={y + 4} fill="rgba(255,255,255,0.35)" fontSize="11">
                  {valueFormatter(Math.round(maxValue - (maxValue / 4) * row))}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={fill} />
          <path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

          {coords.map((point, index) => (
            <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" fill={stroke} />
          ))}

          {coords.map((point, index) => (
            <text
              key={`x-label-${point.label}-${index}`}
              x={point.x}
              y={height - 7}
              textAnchor="middle"
              fill="rgba(255,255,255,0.35)"
              fontSize="10"
            >
              {point.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function GroupedBarChart({
  points,
  valueFormatter = formatCompactNumber,
}: {
  points: StackedChartPoint[];
  valueFormatter?: (value: number) => string;
}) {
  if (points.length === 0 || points.every((point) => point.income === 0 && point.spending === 0)) {
    return <EmptyChartState label="ยังไม่มีข้อมูลธุรกรรมในช่วงเวลานี้" />;
  }

  const width = 720;
  const height = 256;
  const padding = 20;
  const labelBand = 26;
  const plotBottom = height - padding - labelBand;
  const groupWidth = (width - padding * 2) / points.length;
  const barWidth = Math.max(6, Math.min(16, groupWidth * 0.28));
  const maxValue = Math.max(
    ...points.flatMap((point) => [point.income, point.spending]),
    1,
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/25 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[256px] w-full">
          {Array.from({ length: 5 }).map((_, row) => {
            const y = padding + ((plotBottom - padding) / 4) * row;
            return (
              <g key={row}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
                <text x={4} y={y + 4} fill="rgba(255,255,255,0.35)" fontSize="11">
                  {valueFormatter(Math.round(maxValue - (maxValue / 4) * row))}
                </text>
              </g>
            );
          })}

          {points.map((point, index) => {
            const groupX = padding + index * groupWidth + groupWidth / 2;
            const incomeHeight = (point.income / maxValue) * (height - padding * 2);
            const spendingHeight = (point.spending / maxValue) * (height - padding * 2);

            return (
              <g key={`${point.label}-${index}`}>
                <rect
                  x={groupX - barWidth - 2}
                  y={plotBottom - incomeHeight}
                  width={barWidth}
                  height={incomeHeight}
                  rx="4"
                  fill="#818cf8"
                />
                <rect
                  x={groupX + 2}
                  y={plotBottom - spendingHeight}
                  width={barWidth}
                  height={spendingHeight}
                  rx="4"
                  fill="#fb7185"
                />
                <text
                  x={groupX}
                  y={height - 7}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.35)"
                  fontSize="10"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <LegendRow items={[{ label: "รายรับ", tone: "indigo" }, { label: "รายจ่าย", tone: "rose" }]} />
    </div>
  );
}

export function HorizontalBreakdownChart({
  data,
  formatter = formatCompactNumber,
}: {
  data: BreakdownDatum[];
  formatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <EmptyChartState label="ยังไม่มีข้อมูลสำหรับเปรียบเทียบ" />;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const styles = getToneStyles(item.tone ?? "indigo");
        const width = `${(item.value / maxValue) * 100}%`;

        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="truncate text-white/75">{item.label}</p>
              <p className={`shrink-0 font-medium ${styles.text}`}>{formatter(item.value)}</p>
            </div>
            <div className="h-2 rounded-full bg-white/6">
              <div className="h-full rounded-full" style={{ width, backgroundColor: styles.fill }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({
  data,
  formatter = formatCompactNumber,
}: {
  data: BreakdownDatum[];
  formatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <EmptyChartState label="ยังไม่มีข้อมูลสัดส่วน" />;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 64;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  const segments = data.reduce<{
    offset: number;
    entries: Array<{ item: BreakdownDatum; segment: number; dashOffset: number }>;
  }>((acc, item) => {
    const segment = (item.value / total) * circumference;
    return {
      offset: acc.offset + segment,
      entries: [
        ...acc.entries,
        {
          item,
          segment,
          dashOffset: circumference - acc.offset,
        },
      ],
    };
  }, { offset: 0, entries: [] }).entries;

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-center">
      <div className="relative flex h-[170px] w-[170px] shrink-0 items-center justify-center self-center">
        <svg viewBox="0 0 180 180" className="h-[170px] w-[170px] -rotate-90">
          <circle cx="90" cy="90" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
          {segments.map(({ item, segment, dashOffset }) => {
            const styles = getToneStyles(item.tone ?? "indigo");
            return (
              <circle
                key={item.label}
                cx="90"
                cy="90"
                r={radius}
                stroke={styles.fill}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] text-white/35">รวมทั้งหมด</p>
          <p className="mt-1 text-2xl font-semibold text-white">{formatter(total)}</p>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item) => {
          const styles = getToneStyles(item.tone ?? "indigo");
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: styles.fill }} />
                <p className="truncate text-sm text-white/75">{item.label}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${styles.text}`}>{formatter(item.value)}</p>
                <p className="text-[11px] text-white/30">{percent}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
