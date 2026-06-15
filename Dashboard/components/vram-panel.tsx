"use client";

import { motion } from "motion/react";
import { Microchip } from "lucide-react";
import { summarizeVram, type VramModel } from "@/lib/vram";

const EASE = [0.16, 1, 0.3, 1] as const; // ease-out-expo

export function VramPanel({ models, totalGb }: { models: VramModel[]; totalGb: number }) {
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
