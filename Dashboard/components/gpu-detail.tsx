"use client";

import { Activity } from "lucide-react";
import { gen } from "@/lib/series";
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

export function GpuDetail() {
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
        {METRICS.map((m) => (
          <TimeChart key={m.key} m={m} />
        ))}
      </div>
    </section>
  );
}
