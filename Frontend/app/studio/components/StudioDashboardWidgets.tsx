"use client";

import type { ReactNode } from "react";

// Tone keys are kept for the data layer; each maps onto a design token. Chart colours live in charts/chartMath.ts.
const TONE_STYLES = {
  indigo: {
    text: "text-accent",
    border: "border-accent/20",
    bg: "bg-accent/10",
  },
  emerald: {
    text: "text-ok",
    border: "border-ok/20",
    bg: "bg-ok/10",
  },
  amber: {
    text: "text-coin",
    border: "border-coin/20",
    bg: "bg-coin/10",
  },
  rose: {
    text: "text-danger",
    border: "border-danger/20",
    bg: "bg-danger/10",
  },
  sky: {
    text: "text-ink-2",
    border: "border-line",
    bg: "bg-fill",
  },
  violet: {
    text: "text-ink-2",
    border: "border-line",
    bg: "bg-fill",
  },
  slate: {
    text: "text-ink-2",
    border: "border-line",
    bg: "bg-fill",
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
