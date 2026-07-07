"use client";

import { Power, CheckCircle2 } from "lucide-react";
import type { MitWorkerDetail } from "@/lib/live-map";

// MIT worker lifecycle (ADR 016 / #193) — /ready is the canary; a hung worker stalls silently.
const READY = true;
const PID = 24180;
const UPTIME = "4h 12m";
const RESTART_TRIGGER = "none";

// seconds → "Xh Ym" (drops the hour segment when under an hour).
const fmtUptime = (s: number | null): string => {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export function WorkerLifecycle({ workers }: { workers?: MitWorkerDetail[] }) {
  const Cell = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{label}</div>
      <div className="tnum mt-0.5 text-[13px] font-semibold" style={{ color: color ?? "var(--panel-ink)" }}>{value}</div>
    </div>
  );

  const live = workers !== undefined;
  const ready = live ? workers.length > 0 : READY;

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
          <CheckCircle2 size={13} style={{ color: ready ? "var(--success)" : "var(--error)" }} />
          <span className="tnum text-[11px] font-semibold" style={{ color: ready ? "var(--success)" : "var(--error)" }}>
            /ready {ready ? "200" : "503"}
          </span>
        </span>
      </div>
      {!live ? (
        <div className="grid grid-cols-3 gap-3 px-5 pb-4">
          <Cell label="PID" value={String(PID)} />
          <Cell label="uptime" value={UPTIME} />
          <Cell label="restart trigger" value={RESTART_TRIGGER} color={RESTART_TRIGGER === "none" ? "var(--success)" : "var(--processing)"} />
        </div>
      ) : workers.length === 0 ? (
        <div className="flex items-center justify-center px-5 pb-4" style={{ minHeight: 64, color: "var(--ink-3)" }}>
          No worker registered
        </div>
      ) : (
        <div className="px-5 pb-4">
          {workers.map((w, i) => (
            <div key={`${w.ip}:${w.port}`} className="grid grid-cols-4 gap-3 py-2" style={{ borderTop: i > 0 ? "1px solid var(--panel-hairline)" : "none" }}>
              <Cell label="worker" value={`${w.ip}:${w.port}`} />
              <Cell label="PID" value={w.pid == null ? "—" : String(w.pid)} />
              <Cell label="uptime" value={fmtUptime(w.uptimeS)} />
              <Cell label="state" value={w.busy ? "busy" : "idle"} color={w.busy ? "var(--processing)" : "var(--success)"} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
