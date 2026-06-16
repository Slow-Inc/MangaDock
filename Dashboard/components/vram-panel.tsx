"use client";

import { motion } from "motion/react";
import { Microchip } from "lucide-react";
import { summarizeVram, type VramModel } from "@/lib/vram";
import type { MitVram } from "@/lib/live-map";

const EASE = [0.16, 1, 0.3, 1] as const; // ease-out-expo

const mb2gb = (mb: number | null | undefined): number =>
  mb == null ? 0 : Math.round((mb / 1024) * 10) / 10;

export function VramPanel({ models, totalGb, live }: { models: VramModel[]; totalGb: number; live?: MitVram | null }) {
  if (live !== undefined) return <VramPanelLive live={live} />;

  const s = summarizeVram(models, totalGb);

  return (
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <Microchip size={15} strokeWidth={1.85} style={{ color: "var(--c-inpaint)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            VRAM · by model
          </h2>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="tnum text-[15px] font-semibold" style={{ color: "var(--panel-ink)" }}>
            {s.usedGb}
            <span className="text-[12px] font-medium" style={{ color: "var(--panel-ink-3)" }}> / {s.totalGb} GB</span>
          </span>
          <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
            · {s.usedPct}%
          </span>
        </div>
      </div>

      {/* stacked allocation bar */}
      <div className="px-5">
        <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
          {s.rows
            .filter((r) => r.pct > 0)
            .map((r) => (
              <motion.div
                key={r.id}
                initial={{ width: 0 }}
                animate={{ width: `${r.pct}%` }}
                transition={{ duration: 0.7, ease: EASE }}
                style={{ background: r.color }}
                title={`${r.label} · ${r.gb} GB`}
              />
            ))}
        </div>
      </div>

      {/* per-model legend */}
      <div className="grid grid-cols-1 gap-px px-5 pb-4 pt-3.5 sm:grid-cols-2">
        {s.rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 py-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{
                background: r.remote ? "transparent" : r.color,
                border: r.remote ? "1px dashed var(--panel-ink-3)" : "none",
              }}
            />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-medium" style={{ color: "var(--panel-ink)" }}>
                {r.label}
              </div>
              <div className="tnum truncate text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
                {r.sublabel}
              </div>
            </div>
            {r.remote ? (
              <span
                className="rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide"
                style={{ background: "color-mix(in oklch, var(--idle) 16%, transparent)", color: "var(--panel-ink-2)" }}
              >
                remote
              </span>
            ) : (
              <div className="text-right leading-tight">
                <div className="tnum text-[12px] font-semibold" style={{ color: "var(--panel-ink)" }}>
                  {r.gb} GB
                </div>
                <div className="tnum text-[10px]" style={{ color: "var(--panel-ink-3)" }}>
                  {r.pct}%
                </div>
              </div>
            )}
          </div>
        ))}

        {/* free */}
        <div className="flex items-center gap-2.5 py-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ border: "1px solid var(--panel-hairline)" }} />
          <div className="min-w-0 flex-1 text-[12px] font-medium" style={{ color: "var(--panel-ink-2)" }}>
            Free
          </div>
          <div className="tnum text-[12px] font-semibold" style={{ color: "var(--panel-ink-2)" }}>
            {s.freeGb} GB
          </div>
        </div>
      </div>
    </section>
  );
}

/** Live VRAM from worker telemetry (#279). Renders per-model footprint, flags leaks, and shows
 * the global allocated/reserved in the header. Empty model list → "No Data" placeholder. */
function VramPanelLive({ live }: { live: MitVram | null }) {
  const allocGb = mb2gb(live?.allocatedMb);
  const resvGb = mb2gb(live?.reservedMb);
  const hasGlobal = live != null && (live.allocatedMb != null || live.reservedMb != null);
  const rows = (live?.models ?? []).map((m) => ({ ...m, gb: mb2gb(m.footprintMb) }));
  const totalGb = rows.reduce((sum, r) => sum + r.gb, 0);

  return (
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <Microchip size={15} strokeWidth={1.85} style={{ color: "var(--c-inpaint)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            VRAM · by model
          </h2>
        </div>
        {hasGlobal && (
          <div className="flex items-baseline gap-1.5">
            <span className="tnum text-[15px] font-semibold" style={{ color: "var(--panel-ink)" }}>
              {allocGb}
              <span className="text-[12px] font-medium" style={{ color: "var(--panel-ink-3)" }}> alloc</span>
            </span>
            <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
              · {resvGb} GB resv
            </span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center px-5 pb-4 pt-3.5" style={{ minHeight: 124, color: "var(--ink-3)" }}>
          No Data
        </div>
      ) : (
        <>
          {/* stacked allocation bar */}
          <div className="px-5">
            <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
              {rows
                .filter((r) => r.gb > 0)
                .map((r) => (
                  <motion.div
                    key={r.model}
                    initial={{ width: 0 }}
                    animate={{ width: `${totalGb > 0 ? Math.round((r.gb / totalGb) * 1000) / 10 : 0}%` }}
                    transition={{ duration: 0.7, ease: EASE }}
                    style={{ background: r.leaked ? "var(--error)" : "var(--c-inpaint)" }}
                    title={`${r.model} · ${r.gb} GB${r.leaked ? " · LEAK" : ""}`}
                  />
                ))}
            </div>
          </div>

          {/* per-model legend */}
          <div className="grid grid-cols-1 gap-px px-5 pb-4 pt-3.5 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.model} className="flex items-center gap-2.5 py-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: r.leaked ? "var(--error)" : "var(--c-inpaint)" }}
                />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium" style={{ color: r.leaked ? "var(--error)" : "var(--panel-ink)" }}>
                      {r.model}
                    </span>
                    {r.leaked && (
                      <span
                        className="rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide"
                        style={{ background: "color-mix(in oklch, var(--error) 16%, transparent)", color: "var(--error)" }}
                      >
                        Leak
                      </span>
                    )}
                  </div>
                  {r.freedMb != null && (
                    <div className="tnum truncate text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
                      freed {mb2gb(r.freedMb)} GB
                    </div>
                  )}
                </div>
                <div className="tnum text-[12px] font-semibold" style={{ color: r.leaked ? "var(--error)" : "var(--panel-ink)" }}>
                  {r.gb} GB
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
