"use client";

import { ShieldCheck, KeyRound, Bot, FileUp, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Edge security + realtime signals (ADR 012/013/014 + forum SSE). Mock-first.
interface Stat {
  Icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  color: string;
}
const STATS: Stat[] = [
  { Icon: KeyRound, label: "JWT auth", value: "0 fail", sub: "/ 2.5k req", color: "var(--success)" },
  { Icon: Bot, label: "Turnstile", value: "98% pass", sub: "bot-gated", color: "var(--success)" },
  { Icon: FileUp, label: "upload reject", value: "2", sub: "magic-byte MIME", color: "var(--processing)" },
  { Icon: Radio, label: "forum SSE", value: "41 clients", sub: "6 ev/s · forum:events", color: "var(--writing)" },
];

export function EdgeRealtime() {
  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <ShieldCheck size={15} strokeWidth={1.85} style={{ color: "var(--backend)" }} />
        <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
          Edge security · realtime
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 px-5 pb-4 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl px-3 py-2.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
            <div className="flex items-center gap-1.5">
              <s.Icon size={12} strokeWidth={1.85} style={{ color: s.color }} />
              <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{s.label}</span>
            </div>
            <div className="tnum mt-1 text-[14px] font-semibold" style={{ color: "var(--panel-ink)" }}>{s.value}</div>
            <div className="text-[10px]" style={{ color: "var(--panel-ink-3)" }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
