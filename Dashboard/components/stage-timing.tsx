"use client";

import { Timer, AlertTriangle } from "lucide-react";
import { assessTiming, REGRESSION_PCT, type StageTiming } from "@/lib/timing";
import { useLang } from "@/components/lang-provider";

export function StageTimingPanel({ stages }: { stages: StageTiming[] }) {
  const { t } = useLang();
  const r = assessTiming(stages);
  const th = "px-2 py-2 text-[10px] font-medium uppercase tracking-wide";
  const td = "px-2 py-2.5 text-[12px]";

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Timer size={15} strokeWidth={1.85} style={{ color: "var(--c-render)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            {t("timing.title")}
          </h2>
        </div>
        {r.regressedCount > 0 ? (
          <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "color-mix(in oklch, var(--error) 16%, transparent)", color: "var(--error)" }}>
            <AlertTriangle size={10} /> {r.regressedCount} regressed
          </span>
        ) : (
          <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--success)" }}>within baseline</span>
        )}
      </div>

      {stages.length === 0 ? (
        <div className="flex items-center justify-center px-5 pb-4" style={{ minHeight: 180, color: "var(--ink-3)" }}>
          No Data
        </div>
      ) : (
      <>
      <div className="overflow-x-auto px-5 pb-3">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--panel-hairline)", color: "var(--panel-ink-3)" }}>
              <th className={`${th} text-left`}>Stage</th>
              <th className={`${th} text-right`}>baseline</th>
              <th className={`${th} text-right`}>live</th>
              <th className={`${th} text-right`}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {r.stages.map((st, i) => {
              const color = st.regressed ? "var(--error)" : st.deltaPct <= 5 ? "var(--success)" : "var(--processing)";
              return (
                <tr key={st.id} style={{ borderBottom: i < r.stages.length - 1 ? "1px solid var(--panel-hairline)" : "none" }}>
                  <td className={`${td} font-medium`} style={{ color: "var(--panel-ink)" }}>{st.label}</td>
                  <td className={`${td} tnum text-right`} style={{ color: "var(--panel-ink-3)" }}>{(st.baselineMs / 1000).toFixed(1)}s</td>
                  <td className={`${td} tnum text-right`} style={{ color: "var(--panel-ink-2)" }}>{(st.liveMs / 1000).toFixed(1)}s</td>
                  <td className={`${td} tnum text-right font-semibold`} style={{ color }}>{st.deltaPct >= 0 ? "+" : ""}{st.deltaPct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 pb-4 text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
        total <span className="tnum" style={{ color: "var(--panel-ink-2)" }}>{(r.totalLiveMs / 1000).toFixed(1)}s</span> vs {(r.totalBaselineMs / 1000).toFixed(1)}s baseline · flag at ≥{REGRESSION_PCT}%
      </div>
      </>
      )}
    </section>
  );
}
