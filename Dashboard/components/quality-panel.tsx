"use client";

import { SlidersHorizontal } from "lucide-react";
import { useLang } from "@/components/lang-provider";

// Per-run translation-quality telemetry (ADR 016 Tier C) — mock-first.
const RUN = [
  { label: "detection regions", value: "8" },
  { label: "OCR lines", value: "8" },
  { label: "SFX rescued", value: "1 / 1" },
  { label: "inpainter", value: "LaMa" },
];
const KNOBS = ["EN_UPPERCASE", "BUBBLE_SEG", "BUBBLE_AREA_FIT", "SUPERSAMPLING=4", "FONT_MAX=0.5", "CLEAN_LAYOUT"];
const PARITY = 92;
const CONFIG_HASH = "a3f0c1e9b2";
const TRANSLATION = [
  { label: "retries", value: "2", warn: false },
  { label: "lang-ratio fail", value: "0", warn: false },
  { label: "tokens spent", value: "1.2k", warn: false },
];

export function QualityPanel() {
  const { t } = useLang();
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="px-5 py-3" style={{ borderTop: "1px solid var(--panel-hairline)" }}>
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{title}</div>
      {children}
    </div>
  );
  const Stat = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
    <div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{label}</div>
      <div className="tnum mt-0.5 text-[14px] font-semibold" style={{ color: warn ? "var(--processing)" : "var(--panel-ink)" }}>{value}</div>
    </div>
  );

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <SlidersHorizontal size={15} strokeWidth={1.85} style={{ color: "var(--c-ocr)" }} />
        <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
          {t("quality.title")}
        </h2>
      </div>

      <Section title="per run · One-Punch ch1 p3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{RUN.map((r) => <Stat key={r.label} {...r} />)}</div>
      </Section>

      <Section title="render config in effect">
        <div className="flex flex-wrap items-center gap-1.5">
          {KNOBS.map((k) => (
            <span key={k} className="tnum rounded-md px-1.5 py-1 text-[10px]" style={{ background: "var(--panel-2)", color: "var(--panel-ink-2)", border: "1px solid var(--panel-hairline)" }}>{k}</span>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-[11.5px]" style={{ color: "var(--panel-ink-2)" }}>
          <span>parity <b style={{ color: "var(--success)" }}>{PARITY}%</b></span>
          <span className="tnum" style={{ color: "var(--panel-ink-3)" }}>config #{CONFIG_HASH}</span>
        </div>
      </Section>

      <Section title="post-translation checks">
        <div className="grid grid-cols-3 gap-3">{TRANSLATION.map((t) => <Stat key={t.label} {...t} />)}</div>
      </Section>
    </section>
  );
}
