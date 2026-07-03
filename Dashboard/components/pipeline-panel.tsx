"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Radio } from "lucide-react";
import { STAGES, STATUS_COLOR, STATUS_LABEL, type StageStatus } from "@/lib/pipeline";
import { useLang } from "@/components/lang-provider";
import { cn } from "@/lib/utils";

export interface StageDetail {
  status: StageStatus;
  elapsedMs?: number;
  detail?: string;
  log?: string[];
}

const EASE = [0.16, 1, 0.3, 1] as const; // ease-out-expo

function StatusDot({ status, size = 7 }: { status: StageStatus; size?: number }) {
  const color = STATUS_COLOR[status];
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {status === "processing" && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className="relative rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

function Connector({ flowing }: { flowing: boolean }) {
  return (
    <div className="relative mx-1 hidden h-px flex-1 self-center sm:block" style={{ background: "var(--panel-hairline)" }}>
      {flowing && (
        <motion.span
          className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full"
          style={{ background: "var(--processing)", boxShadow: "0 0 8px var(--processing)" }}
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

export function PipelinePanel({
  statuses,
  activeId,
}: {
  statuses: Record<string, StageDetail>;
  activeId: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(activeId);
  const { t } = useLang();

  return (
    <section
      className="overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--panel-hairline)" }}>
        <div className="flex items-center gap-2.5">
          <Radio size={15} style={{ color: "var(--processing)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            {t("pipeline.title")}
          </h2>
          <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
            One-Punch · ch1 · p3
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--processing)" }} />
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--panel-ink-2)" }}>
            Live
          </span>
        </div>
      </div>

      {/* stage row */}
      <div className="flex items-stretch gap-0 px-5 py-5">
        {STAGES.map((stage, i) => {
          const st = statuses[stage.id] ?? { status: "idle" as StageStatus };
          const isActive = stage.id === activeId;
          const isError = st.status === "error";
          // amber "active" highlight only on a non-errored stage; an errored stage gets the
          // red slow-pulse warning instead (matching the Request-flow MIT-down node).
          const showActive = isActive && !isError;
          const accent = isError ? "var(--error)" : showActive ? "var(--processing)" : null;
          const isOpen = expanded === stage.id;
          const prev = i > 0 ? statuses[STAGES[i - 1].id]?.status : undefined;
          const flowing = prev === "success" && st.status === "processing";
          return (
            <div key={stage.id} className="flex flex-1 items-stretch">
              {i > 0 && <Connector flowing={flowing} />}
              <button
                onClick={() => setExpanded(isOpen ? null : stage.id)}
                className={cn(
                  "group relative flex w-full flex-col items-start gap-2 rounded-xl px-3.5 py-3 text-left transition-colors",
                )}
                style={{
                  background: accent ? `color-mix(in oklch, ${accent} ${isError ? 8 : 9}%, var(--panel-2))` : "var(--panel-2)",
                  border: `1px solid ${accent ? `color-mix(in oklch, ${accent} 45%, transparent)` : isOpen ? "var(--panel-hairline)" : "transparent"}`,
                }}
              >
                {accent && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: `0 0 0 1px color-mix(in oklch, ${accent} 55%, transparent)` }}
                    animate={{ opacity: isError ? [0.3, 0.85, 0.3] : [0.35, 0.9, 0.35] }}
                    transition={{ duration: isError ? 2 : 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <div className="flex w-full items-center justify-between">
                  <stage.Icon size={16} style={{ color: stage.color }} strokeWidth={1.75} />
                  <StatusDot status={st.status} />
                </div>
                <div>
                  <div className="text-[12.5px] font-semibold leading-tight" style={{ color: "var(--panel-ink)" }}>
                    {stage.label}
                  </div>
                  <div className="tnum mt-0.5 text-[10.5px] leading-tight" style={{ color: "var(--panel-ink-3)" }}>
                    {stage.sublabel}
                  </div>
                </div>
                <div className="flex w-full items-center justify-between">
                  <span className="text-[10.5px] font-medium" style={{ color: STATUS_COLOR[st.status] }}>
                    {STATUS_LABEL[st.status]}
                  </span>
                  {st.elapsedMs != null && (
                    <span className="tnum text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
                      {(st.elapsedMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* expandable detail */}
      <AnimatePresence initial={false}>
        {expanded && statuses[expanded] && (
          <motion.div
            key={expanded}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
            style={{ borderTop: "1px solid var(--panel-hairline)" }}
          >
            <div className="px-5 py-4">
              {(() => {
                const stage = STAGES.find((s) => s.id === expanded)!;
                const d = statuses[expanded];
                return (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[12px] font-semibold" style={{ color: "var(--panel-ink)" }}>
                        {stage.label}
                      </span>
                      <span className="text-[11px]" style={{ color: STATUS_COLOR[d.status] }}>
                        — {d.detail ?? STATUS_LABEL[d.status]}
                      </span>
                    </div>
                    {d.log && d.log.length > 0 && (
                      <div
                        className="rounded-lg px-3 py-2.5"
                        style={{ background: "var(--panel)", border: "1px solid var(--panel-hairline)" }}
                      >
                        {d.log.map((line, i) => (
                          <div key={i} className="tnum text-[11px] leading-relaxed" style={{ color: "var(--panel-ink-2)" }}>
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer: current step + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4" style={{ borderTop: "1px solid var(--panel-hairline)" }}>
        <div className="flex items-center gap-2 pt-3">
          <ChevronRight size={13} style={{ color: "var(--processing)" }} />
          <span className="text-[12px]" style={{ color: "var(--panel-ink-2)" }}>
            {activeId
              ? `${t("pipeline.stuck")} ${STAGES.find((s) => s.id === activeId)?.label} — ${statuses[activeId]?.detail ?? ""}`
              : t("pipeline.idle")}
          </span>
        </div>
        <div className="flex items-center gap-3 pt-3">
          {(["processing", "success", "error", "idle"] as StageStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
              <span className="text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
                {STATUS_LABEL[s]}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
