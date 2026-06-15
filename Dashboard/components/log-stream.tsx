"use client";

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { filterLogs, LEVEL_COLOR, type LogEntry, type LogLevel } from "@/lib/log";

const FILTERS: { id: LogLevel; label: string }[] = [
  { id: "debug", label: "All" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

export function LogStream({ logs }: { logs: LogEntry[] }) {
  const [min, setMin] = useState<LogLevel>("debug");
  const visible = useMemo(() => filterLogs(logs, min), [logs, min]);

  return (
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* header + level filter */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid var(--panel-hairline)" }}>
        <div className="flex items-center gap-2">
          <ScrollText size={14} style={{ color: "var(--panel-ink-3)" }} />
          <span className="text-[12px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            Logs
          </span>
        </div>
        <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
          {FILTERS.map((f) => {
            const on = min === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setMin(f.id)}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors"
                style={{ background: on ? "var(--panel-3)" : "transparent", color: on ? "var(--panel-ink)" : "var(--panel-ink-3)" }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* rows */}
      <div className="divide-y" style={{ borderColor: "var(--panel-hairline)" }}>
        {visible.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--panel-ink-3)" }}>
            No entries at this level.
          </div>
        ) : (
          visible.map((l, i) => (
            <div key={i} className="flex items-baseline gap-3 px-4 py-2">
              <span className="tnum w-[58px] shrink-0 text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
                {l.t}
              </span>
              <span
                className="w-[46px] shrink-0 rounded px-1.5 py-px text-center text-[9.5px] font-bold uppercase tracking-wide"
                style={{ background: `color-mix(in oklch, ${LEVEL_COLOR[l.level]} 16%, transparent)`, color: LEVEL_COLOR[l.level] }}
              >
                {l.level}
              </span>
              <span className="tnum w-[68px] shrink-0 truncate text-[11px]" style={{ color: "var(--panel-ink-2)" }}>
                {l.src}
              </span>
              <span className="flex-1 text-[12px] leading-snug" style={{ color: "var(--panel-ink)" }}>
                {l.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
