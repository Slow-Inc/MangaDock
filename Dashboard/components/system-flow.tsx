"use client";

import { motion } from "motion/react";
import { useLang } from "@/components/lang-provider";
import { SERVICES, SERVICE_STATUS_COLOR, type ServiceStatus } from "@/lib/services";

function Flow({ healthy }: { healthy: boolean }) {
  return (
    <div className="relative mx-1.5 hidden h-px min-w-8 flex-1 self-center sm:block" style={{ background: "var(--panel-hairline)" }}>
      <motion.span
        className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
        style={{
          background: healthy ? "var(--success)" : "var(--error)",
          boxShadow: `0 0 10px ${healthy ? "var(--success)" : "var(--error)"}`,
        }}
        animate={healthy ? { left: ["0%", "100%"], opacity: [0, 1, 0] } : { left: "42%", opacity: [0.3, 1, 0.3] }}
        transition={{ duration: healthy ? 1.8 : 1.1, repeat: Infinity, ease: healthy ? "easeInOut" : "easeOut" }}
      />
    </div>
  );
}

export function SystemFlow({
  selected,
  onSelect,
  mitLive,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  /** Live MIT override (real /status data) for the MIT node; others stay mock. */
  mitLive?: { status: ServiceStatus; metric: string; errors: number };
}) {
  const { t } = useLang();
  const eff = (s: (typeof SERVICES)[number]) =>
    s.id === "mit" && mitLive ? { status: mitLive.status, metric: mitLive.metric, errors: mitLive.errors } : { status: s.status, metric: s.metric, errors: s.errors };
  return (
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>
          {t("flow.title")}
        </h2>
        <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
          browser → frontend → backend → mit
        </span>
      </div>

      <div className="flex items-stretch px-5 py-5">
        {SERVICES.map((s, i) => {
          const isSel = selected === s.id;
          const e = eff(s);
          const isDown = e.status === "down";
          return (
            <div key={s.id} className="flex flex-1 items-stretch">
              {i > 0 && <Flow healthy={eff(SERVICES[i - 1]).status === "up" && e.status === "up"} />}
              <button
                onClick={() => onSelect(s.id)}
                className="group relative flex w-full flex-col gap-2.5 rounded-xl px-4 py-3.5 text-left transition-colors"
                style={{
                  background: isSel ? "color-mix(in oklch, var(--panel-ink) 6%, var(--panel-2))" : "var(--panel-2)",
                  border: `1px solid ${isDown ? "color-mix(in oklch, var(--error) 38%, transparent)" : isSel ? "var(--hairline-strong)" : "var(--panel-hairline)"}`,
                }}
              >
                {isDown && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: "0 0 0 1px color-mix(in oklch, var(--error) 50%, transparent)" }}
                    animate={{ opacity: [0.3, 0.85, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: `color-mix(in oklch, ${s.color} 14%, transparent)` }}>
                    <s.Icon size={16} strokeWidth={1.85} style={{ color: s.color }} />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SERVICE_STATUS_COLOR[e.status] }} />
                    <span className="text-[10.5px] font-medium uppercase tracking-wide" style={{ color: SERVICE_STATUS_COLOR[e.status] }}>
                      {e.status}
                    </span>
                  </span>
                </div>
                <div>
                  <div className="text-[14px] font-semibold leading-tight" style={{ color: "var(--panel-ink)" }}>
                    {s.name}
                  </div>
                  <div className="tnum mt-0.5 text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
                    {s.tech}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px]" style={{ color: isDown ? "var(--error)" : "var(--panel-ink-2)" }}>
                    {e.metric}
                  </span>
                  {e.errors > 0 && (
                    <span className="tnum rounded-full px-1.5 py-px text-[10px] font-semibold" style={{ background: "color-mix(in oklch, var(--error) 16%, transparent)", color: "var(--error)" }}>
                      {e.errors} err
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-5 pb-4 pt-0.5 text-[11.5px]" style={{ color: "var(--panel-ink-2)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--error)" }} />
        {t("flow.breakPre")} <b style={{ color: "var(--panel-ink)" }}>MIT</b> {t("flow.breakPost")}
      </div>
    </section>
  );
}
