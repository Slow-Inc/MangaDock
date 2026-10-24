import type { ReactNode } from "react";

/** Strata `.badge` (globals.css 517-539): mono 11 px pill; the tone tints the border via color-mix. */
type Tone = "neutral" | "accent" | "ok" | "danger";

const TONE: Record<Tone, string> = {
  neutral: "border-line text-ink-2",
  accent: "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] text-[color-mix(in_srgb,var(--accent)_80%,var(--ink))]",
  ok: "border-[color-mix(in_srgb,var(--ok)_55%,transparent)] text-[color-mix(in_srgb,var(--ok)_80%,var(--ink))]",
  danger: "border-[color-mix(in_srgb,var(--danger)_55%,transparent)] text-[color-mix(in_srgb,var(--danger)_80%,var(--ink))]",
};

export default function Badge({ tone = "neutral", className = "", children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-px font-mono text-[0.6875rem] tracking-[0.02em] whitespace-nowrap ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
