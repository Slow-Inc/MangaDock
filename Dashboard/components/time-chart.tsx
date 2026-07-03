"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X_TICKS } from "@/lib/series";

export interface ChartMetric {
  key: string;
  title: string;
  unit: string;
  color: string;
  dec: number;
  domain: [number, number];
  data: { t: string; v: number }[];
}

/** Grafana-style time-series card: title + current value, Y axis (units) + X axis (time) + grid. */
export function TimeChart({ m, height = 112 }: { m: ChartMetric; height?: number }) {
  const current = m.data[m.data.length - 1].v;
  const fmt = (v: number) => v.toFixed(m.dec);

  return (
    <div className="rounded-xl px-3 pt-2.5 pb-1.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--panel-ink-2)" }}>{m.title}</span>
        <span className="tnum text-[12.5px] font-semibold" style={{ color: m.color }}>{fmt(current)} {m.unit}</span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={m.data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`g-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity={0.26} />
                <stop offset="100%" stopColor={m.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--panel-hairline)" strokeDasharray="2 4" />
            <XAxis dataKey="t" ticks={X_TICKS} tick={{ fontSize: 9, fill: "var(--panel-ink-3)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
            <YAxis domain={m.domain} tickFormatter={fmt} width={30} tick={{ fontSize: 9, fill: "var(--panel-ink-3)" }} tickLine={false} axisLine={false} tickCount={4} />
            <Tooltip
              contentStyle={{ background: "var(--panel-3)", border: "1px solid var(--panel-hairline)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "var(--panel-ink-3)" }}
              itemStyle={{ color: m.color }}
              formatter={(v: number) => [`${fmt(v)} ${m.unit}`, m.title]}
            />
            <Area type="monotone" dataKey="v" stroke={m.color} strokeWidth={1.5} fill={`url(#g-${m.key})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
