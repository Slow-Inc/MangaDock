"use client";

import { Coins, Unlock, ShieldAlert, CreditCard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Economy / unlock signals (ADR domain — wallet, unlock, HWID). Mock-first.
interface Block {
  Icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  color: string;
}
const BLOCKS: Block[] = [
  { Icon: CreditCard, label: "payment · Omise", value: "99.4% ok", sub: "184 txns · ฿42.8k / 24h", color: "var(--success)" },
  { Icon: Coins, label: "coins · 24h", value: "+2.4k / −1.8k", sub: "top-up / spend", color: "var(--processing)" },
  { Icon: Unlock, label: "chapter unlocks", value: "312 · 4 fail", sub: "3 low-balance · 1 HWID", color: "var(--success)" },
  { Icon: ShieldAlert, label: "HWID rejections", value: "7", sub: "zero-trust middleware", color: "var(--error)" },
];

export function EconomyPanel() {
  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <Coins size={15} strokeWidth={1.85} style={{ color: "var(--processing)" }} />
        <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
          Economy · unlock
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-2 px-5 pb-4 sm:grid-cols-2 xl:grid-cols-4">
        {BLOCKS.map((b) => (
          <div key={b.label} className="rounded-xl px-3.5 py-3" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
            <div className="flex items-center gap-1.5">
              <b.Icon size={13} strokeWidth={1.85} style={{ color: b.color }} />
              <span className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{b.label}</span>
            </div>
            <div className="tnum mt-1 text-[15px] font-semibold" style={{ color: "var(--panel-ink)" }}>{b.value}</div>
            <div className="text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>{b.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
