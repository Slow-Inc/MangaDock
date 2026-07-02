"use client";

import { Activity } from "lucide-react";
import { gen, TIME } from "@/lib/series";
import { TimeChart, type ChartMetric } from "@/components/time-chart";

// Detailed GPU/host time-series (ADR 016 §1d) — beyond util/VRAM/CPU/RAM.
const METRICS: ChartMetric[] = [
  { key: "gpuTemp", title: "GPU Temp", unit: "°C", color: "var(--c-inpaint)", dec: 0, domain: [60, 88], data: gen(73, 6, { trend: 0.22, max: 86 }) },
  { key: "cpuTemp", title: "CPU Temp", unit: "°C", color: "var(--error)", dec: 0, domain: [40, 80], data: gen(56, 7, { phase: 1.5, trend: 0.08, min: 44, max: 74 }) },
  { key: "gfxClock", title: "Graphics Clock", unit: "GHz", color: "var(--c-detect)", dec: 2, domain: [1.5, 2.3], data: gen(1.98, 0.18, { spike: 0.7, phase: 1, dec: 2, min: 1.55 }) },
  { key: "fan", title: "Fan Speed", unit: "%", color: "var(--c-render)", dec: 0, domain: [35, 60], data: gen(47, 6, { trend: 0.16, phase: 2, max: 58 }) },
  { key: "power", title: "Power Draw", unit: "W", color: "var(--processing)", dec: 0, domain: [0, 320], data: gen(185, 85, { spike: 0.6, min: 55, max: 310 }) },
  { key: "cpuClock", title: "CPU Clock", unit: "GHz", color: "var(--frontend)", dec: 1, domain: [3, 5], data: gen(4.0, 0.55, { spike: 0.5, phase: 3, dec: 1, min: 3.1, max: 4.9 }) },
  { key: "cpuUsage", title: "CPU Usage", unit: "%", color: "var(--success)", dec: 0, domain: [0, 100], data: gen(42, 18, { spike: 0.3, phase: 2, min: 8, max: 92 }) },
];

// Live source per chart: only GPU temp / fan / power / CPU usage are reported by MIT.
// CPU temp, graphics clock and CPU clock have no live feed → null (renders "No Data").
const LIVE_KEY: Record<string, string | null> = {
  gpuTemp: "gpuTemp",
  cpuTemp: null,
  gfxClock: null,
  fan: "fan",
  power: "power",
  cpuClock: null,
  cpuUsage: "cpu",
};

// Pair a rolling series buffer onto the X axis, latest samples right-aligned. `times`
// (live, real epoch-derived labels) is used when present; else the mock TIME window.
function toData(values: number[], dec: number, times?: string[]): { t: string; v: number }[] {
  const axis = times && times.length ? times : TIME;
  const n = Math.min(values.length, axis.length);
  const vals = values.slice(-n);
  const ts = axis.slice(-n);
  const f = Math.pow(10, dec);
  return vals.map((v, i) => ({ t: ts[i], v: Math.round(v * f) / f }));
}

function NoDataCard({ m }: { m: ChartMetric }) {
  return (
    <div className="rounded-xl px-3 pt-2.5 pb-1.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--panel-ink-2)" }}>{m.title}</span>
        <span className="tnum text-[12.5px] font-semibold" style={{ color: "var(--panel-ink-3)" }}>— {m.unit}</span>
      </div>
      <div className="flex items-center justify-center" style={{ height: 112, color: "var(--ink-3)" }}>
        No Data
      </div>
    </div>
  );
}

export function GpuDetail({ series, times }: { series?: Record<string, number[]>; times?: string[] }) {
  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <Activity size={15} strokeWidth={1.85} style={{ color: "var(--c-render)" }} />
        <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
          GPU · host metrics
        </h2>
        <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>nvidia-smi · 5s</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 px-5 pb-4 sm:grid-cols-2 xl:grid-cols-3">
        {METRICS.map((m) => {
          if (!series) return <TimeChart key={m.key} m={m} />;
          const src = LIVE_KEY[m.key];
          const values = src ? series[src] : undefined;
          if (!values || values.length === 0) return <NoDataCard key={m.key} m={m} />;
          return <TimeChart key={m.key} m={{ ...m, data: toData(values, m.dec, times) }} />;
        })}
      </div>
    </section>
  );
}
