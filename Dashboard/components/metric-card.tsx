"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LucideIcon } from "lucide-react";

// Deterministic time labels (no Date → SSR-safe), matching the GPU host charts' window.
const STEP = 20;
const BASE = 10 * 3600 + 25 * 60; // 10:25:00
const pad = (n: number) => String(n).padStart(2, "0");
const tlabel = (i: number) => {
  const s = BASE + i * STEP;
  return `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}`;
};

export function MetricCard({
  label,
  value,
  unit,
  sub,
  data,
  color,
  Icon,
  domain,
  times,
}: {
  label: string;
  value: number | string;
  unit?: string;
  sub?: string;
  data: number[];
  color: string;
  Icon: LucideIcon;
  domain?: [number, number];
  times?: string[]; // real x-axis labels (live); falls back to the deterministic mock labels
}) {
  // Live: real timestamps right-aligned onto the data; mock: the deterministic tlabel window.
  const off = times ? times.length - data.length : 0;
  const series = data.map((v, i) => ({ t: times?.[off + i] ?? tlabel(i), v }));
  const id = `g-${label.replace(/\s/g, "")}`;
  // Dedupe: a short live series can land first/mid/last in the same minute → identical
  // tick labels → recharts duplicate-key warning. Unique tick values fix it.
  const xTicks = series.length
    ? [...new Set([series[0].t, series[Math.floor(series.length / 2)].t, series[series.length - 1].t])]
    : [];

  return (
    <div
      className="theme-tx flex flex-col gap-2 rounded-[14px] p-4"
      style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} style={{ color }} />
        <span className="text-[11.5px] font-medium" style={{ color: "var(--panel-ink-2)" }}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="tnum text-[26px] font-semibold leading-none tracking-tight" style={{ color: "var(--panel-ink)" }}>
          {value}
        </span>
        {unit && (
          <span className="text-[12px] font-medium" style={{ color: "var(--panel-ink-3)" }}>
            {unit}
          </span>
        )}
      </div>
      <div className="h-[88px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            No Data
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--panel-hairline)" strokeDasharray="2 4" />
            <XAxis dataKey="t" ticks={xTicks} tick={{ fontSize: 9, fill: "var(--panel-ink-3)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
            <YAxis domain={domain ?? ["dataMin", "dataMax"]} width={28} tick={{ fontSize: 9, fill: "var(--panel-ink-3)" }} tickLine={false} axisLine={false} tickCount={3} />
            <Tooltip
              contentStyle={{ background: "var(--panel-3)", border: "1px solid var(--panel-hairline)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "var(--panel-ink-3)" }}
              itemStyle={{ color }}
              formatter={(v: number) => [`${v}${unit ? ` ${unit}` : ""}`, label]}
            />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
      {sub && (
        <span className="tnum text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
