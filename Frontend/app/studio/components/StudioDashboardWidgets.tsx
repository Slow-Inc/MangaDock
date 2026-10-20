"use client";

import type { ReactNode } from "react";
import type { BreakdownDatum, ChartPoint, StackedChartPoint } from "../lib/dashboardAnalytics";
import { formatCompactNumber } from "../lib/dashboardAnalytics";

// Tone keys are kept for the data layer; each maps onto a design token. `fill` is a CSS value, so it is
// applied through `style` (SVG presentation attributes cannot read CSS variables).
const TONE_STYLES = {
  indigo: {
    text: "text-accent",
    border: "border-accent/20",
    bg: "bg-accent/10",
    fill: "var(--accent)",
  },
  emerald: {
    text: "text-ok",
    border: "border-ok/20",
    bg: "bg-ok/10",
    fill: "var(--ok)",
  },
  amber: {
    text: "text-coin",
    border: "border-coin/20",
    bg: "bg-coin/10",
    fill: "var(--coin)",
  },
  rose: {
    text: "text-danger",
    border: "border-danger/20",
    bg: "bg-danger/10",
    fill: "var(--danger)",
  },
  sky: {
    text: "text-ink-2",
    border: "border-line",
    bg: "bg-fill",
    fill: "color-mix(in srgb, var(--accent) 55%, transparent)",
  },
  violet: {
    text: "text-ink-2",
    border: "border-line",
    bg: "bg-fill",
    fill: "var(--ink-3)",
  },
  slate: {
    text: "text-ink-2",
    border: "border-line",
    bg: "bg-fill",
    fill: "var(--ink-3)",
  },
} as const;

type Tone = keyof typeof TONE_STYLES;

function getToneStyles(tone: Tone = "indigo") {
  return TONE_STYLES[tone];
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
    <section className="rounded-[1.75rem] border border-line bg-fill p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-ink-3">{subtitle}</p> : null}
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
    <div className="rounded-xl border border-line bg-fill p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3">{label}</p>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</div>
          {hint ? <p className="mt-1 text-[11px] text-ink-3">{hint}</p> : null}
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
          <div key={item.label} className="flex items-center gap-2 text-xs text-ink-3">
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
    <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-line bg-bg text-sm text-ink-3">
      {label}
    </div>
  );
}

export function LineChart({
  points,
  stroke = "var(--accent)",
  fill = "color-mix(in srgb, var(--accent) 16%, transparent)",
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
    <div role="img" aria-label="กราฟยอดวิวรายวัน">
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-bg p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[256px] w-full">
          <title>กราฟยอดวิวรายวัน</title>
          {Array.from({ length: 5 }).map((_, row) => {
            const y = padding + ((plotBottom - padding) / 4) * row;
            return (
              <g key={row}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-line" strokeDasharray="4 6" />
                <text x={4} y={y + 4} className="fill-ink-3" fontSize="11">
                  {valueFormatter(Math.round(maxValue - (maxValue / 4) * row))}
                </text>
              </g>
            );
          })}

          <path d={areaPath} style={{ fill }} />
          <path d={linePath} fill="none" style={{ stroke }} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

          {coords.map((point, index) => (
            <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" style={{ fill: stroke }} />
          ))}

          {coords.map((point, index) => (
            <text
              key={`x-label-${point.label}-${index}`}
              x={point.x}
              y={height - 7}
              textAnchor="middle"
              className="fill-ink-3"
              fontSize="10"
            >
              {point.label}
            </text>
          ))}
        </svg>
      </div>
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
    <div role="img" aria-label="กราฟยอดวิวแยกตามมังงะ">
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-bg p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[256px] w-full">
          <title>กราฟยอดวิวแยกตามมังงะ</title>
          {Array.from({ length: 5 }).map((_, row) => {
            const y = padding + ((plotBottom - padding) / 4) * row;
            return (
              <g key={row}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-line" strokeDasharray="4 6" />
                <text x={4} y={y + 4} className="fill-ink-3" fontSize="11">
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
                  style={{ fill: "var(--accent)" }}
                />
                <rect
                  x={groupX + 2}
                  y={plotBottom - spendingHeight}
                  width={barWidth}
                  height={spendingHeight}
                  rx="4"
                  style={{ fill: "var(--danger)" }}
                />
                <text
                  x={groupX}
                  y={height - 7}
                  textAnchor="middle"
                  className="fill-ink-3"
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
    <div role="img" aria-label="กราฟรายได้แยกประเภท">
    <div className="space-y-3">
      {data.map((item) => {
        const styles = getToneStyles(item.tone ?? "indigo");
        const width = `${(item.value / maxValue) * 100}%`;

        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="truncate text-ink-2">{item.label}</p>
              <p className="shrink-0 font-medium tabular-nums text-ink">{formatter(item.value)}</p>
            </div>
            <div className="h-2 rounded-full bg-fill">
              <div className="h-full rounded-full" style={{ width, backgroundColor: styles.fill }} />
            </div>
          </div>
        );
      })}
    </div>
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
    <div role="img" aria-label="กราฟสัดส่วนรายได้">
    <div className="flex flex-col gap-5 md:flex-row md:items-center">
      <div className="relative flex h-[170px] w-[170px] shrink-0 items-center justify-center self-center">
        <svg viewBox="0 0 180 180" className="h-[170px] w-[170px] -rotate-90">
          <title>กราฟสัดส่วนรายได้</title>
          <circle cx="90" cy="90" r={radius} className="stroke-line" strokeWidth={strokeWidth} fill="none" />
          {segments.map(({ item, segment, dashOffset }) => {
            const styles = getToneStyles(item.tone ?? "indigo");
            return (
              <circle
                key={item.label}
                cx="90"
                cy="90"
                r={radius}
                style={{ stroke: styles.fill }}
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
          <p className="text-[11px] text-ink-3">รวมทั้งหมด</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatter(total)}</p>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item) => {
          const styles = getToneStyles(item.tone ?? "indigo");
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: styles.fill }} />
                <p className="truncate text-sm text-ink-2">{item.label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-ink">{formatter(item.value)}</p>
                <p className="text-[11px] text-ink-3">{percent}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
