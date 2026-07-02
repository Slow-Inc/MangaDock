"use client";

// Shared widget primitives ported from Studio Dashboard (MangaDock), adapted to the Speck/CSS-var
// token system used by dashboardv2. No Tailwind tone classes — all color via CSS vars.

import type { ReactNode } from "react";
import type { ServiceStatus } from "@/lib/service-status";

// MetricCard — label + large value + optional unit/sub-line/bottom slot.
// Replaces the recurring inline Panel+metric pattern in dashboard.tsx.
// Pass accent as a CSS var string e.g. "var(--coral)", "var(--accent-violet)".
export function MetricCard({
  label,
  value,
  unit,
  sub,
  accent,
  bottom,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: string;
  accent?: string;
  bottom?: ReactNode;
}) {
  return (
    <section
      className="rounded-[14px] p-4"
      style={{ background: "var(--panel)", border: "1px solid var(--hairline)" }}
    >
      <div className="text-[11.5px] font-medium" style={{ color: "var(--ink-2)" }}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <div
          className="text-[23px] font-semibold leading-none tnum tracking-tight"
          style={{ color: accent ?? "var(--ink)" }}
        >
          {value}
        </div>
        {unit && (
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div className="mt-1 text-[10.5px] tnum" style={{ color: "var(--ink-3)" }}>
          {sub}
        </div>
      )}
      {bottom && <div className="mt-2">{bottom}</div>}
    </section>
  );
}

// BreakdownBar — labelled progress-bar rows (ported from HorizontalBreakdownChart).
// Used for stage timing in MitPipeline; label is ReactNode so callers can embed a <Dot>.
export function BreakdownBar({
  items,
}: {
  items: Array<{
    key: string;
    label: ReactNode;
    pct: number;
    valueLabel: string;
    status?: "ok" | "error" | "idle";
  }>;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <span
            className="flex w-20 shrink-0 items-center gap-1.5 text-[11.5px]"
            style={{ color: item.status === "idle" ? "var(--ink-3)" : "var(--ink)" }}
          >
            {item.label}
          </span>
          <div
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${item.pct}%`,
                background: item.status === "error" ? "var(--coral)" : "var(--ink-2)",
                transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </div>
          <span
            className="w-16 shrink-0 text-right text-[11.5px] tnum"
            style={{ color: item.status === "error" ? "var(--coral)" : "var(--ink-2)" }}
          >
            {item.valueLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

// StatusChip — dot + label + status pill for service health (up / degraded / down).
// Pass status=null while loading (renders a neutral "…" chip).
export function StatusChip({
  status,
  label,
  reason,
}: {
  status: ServiceStatus | null;
  label: string;
  reason?: string;
}) {
  const c =
    status === "up"
      ? "var(--success)"
      : status === "degraded"
        ? "var(--processing)"
        : status === "down"
          ? "var(--coral)"
          : "var(--ink-3)";
  return (
    <span
      title={reason}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium"
      style={{
        background: `color-mix(in oklch, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in oklch, ${c} 26%, transparent)`,
        color: c,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {label} · {status ?? "…"}
    </span>
  );
}
