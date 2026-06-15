"use client";

import { Power, CheckCircle2 } from "lucide-react";

// MIT worker lifecycle (ADR 016 / #193) — /ready is the canary; a hung worker stalls silently.
const READY = true;
const PID = 24180;
const UPTIME = "4h 12m";
const RESTART_TRIGGER = "none";

export function WorkerLifecycle() {
  const Cell = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{label}</div>
      <div className="tnum mt-0.5 text-[13px] font-semibold" style={{ color: color ?? "var(--panel-ink)" }}>{value}</div>
    </div>
  );

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Power size={15} strokeWidth={1.85} style={{ color: "var(--mit)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            Worker lifecycle
          </h2>
        </div>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={13} style={{ color: READY ? "var(--success)" : "var(--error)" }} />
          <span className="tnum text-[11px] font-semibold" style={{ color: READY ? "var(--success)" : "var(--error)" }}>
            /ready {READY ? "200" : "503"}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 px-5 pb-4">
        <Cell label="PID" value={String(PID)} />
        <Cell label="uptime" value={UPTIME} />
        <Cell label="restart trigger" value={RESTART_TRIGGER} color={RESTART_TRIGGER === "none" ? "var(--success)" : "var(--processing)"} />
      </div>
    </section>
  );
}
