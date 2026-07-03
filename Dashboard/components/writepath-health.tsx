"use client";

import { Save } from "lucide-react";
import { assessWritePath, type WritePathState } from "@/lib/writepath";

const HEALTH_COLOR = { healthy: "var(--success)", degraded: "var(--processing)", down: "var(--error)" } as const;

export function WritePathHealth({ state }: { state: WritePathState }) {
  const a = assessWritePath(state);
  const hc = HEALTH_COLOR[a.health];

  const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{label}</div>
      <div className="tnum mt-0.5 text-[15px] font-semibold" style={{ color: color ?? "var(--panel-ink)" }}>{value}</div>
    </div>
  );

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <Save size={15} strokeWidth={1.85} style={{ color: "var(--backend)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            Write-behind · L3 + Supabase
          </h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5" style={{ background: `color-mix(in oklch, ${hc} 14%, transparent)` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: hc }} />
          <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: hc }}>{a.health}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 px-5 sm:grid-cols-4">
        <Stat label="dirty queue" value={String(state.dirty)} />
        <Stat label="processing" value={String(state.processing)} color={state.processing > 0 ? "var(--processing)" : "var(--success)"} />
        <Stat label="dead-letter" value={String(state.deadLetter)} color={state.deadLetter > 0 ? "var(--error)" : "var(--success)"} />
        <Stat label="last flush" value={`${(state.lastFlushAgeMs / 1000).toFixed(1)}s`} color={a.flushOverdue ? "var(--processing)" : "var(--panel-ink)"} />
      </div>

      <div className="px-5 pb-4 pt-3 text-[11.5px]" style={{ color: "var(--panel-ink-2)" }}>
        {a.reasons.length === 0 ? (
          <span><span style={{ color: "var(--success)" }}>●</span> draining on schedule · flush SLA {(state.slaMs / 1000).toFixed(0)}s · leader-only worker healthy</span>
        ) : (
          <span><span style={{ color: hc }}>●</span> {a.reasons.join(" · ")}</span>
        )}
      </div>
    </section>
  );
}
