"use client";

import { LEVEL_COLOR } from "@/lib/log";
import { SERVICE_STATUS_COLOR, type Service } from "@/lib/services";

export function ServiceTicker({ service }: { service: Service }) {
  const sc = SERVICE_STATUS_COLOR[service.status];

  return (
    <>
      {/* health summary */}
      <div className="mb-4 rounded-xl px-3.5 py-3" style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
            Health
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc }} />
            <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: sc }}>
              {service.status}
            </span>
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {service.stats.slice(0, 2).map((st) => (
            <div key={st.label}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                {st.label}
              </div>
              <div className="tnum mt-0.5 text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>
                {st.value}
              </div>
            </div>
          ))}
        </div>
        {service.errors > 0 && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "color-mix(in oklch, var(--error) 10%, transparent)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--error)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--error)" }}>
              {service.errors} active error
            </span>
          </div>
        )}
      </div>

      {/* live log feed */}
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: sc, opacity: 0.6 }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: sc }} />
        </span>
        <h2 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-2)" }}>
          {service.name} feed
        </h2>
      </div>
      <div className="-mr-1 flex flex-col gap-0.5 overflow-y-auto pr-1">
        {service.logs.map((l, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[l.level] }} />
            <div className="min-w-0 flex-1">
              <span className="text-[12px] leading-snug" style={{ color: "var(--ink)" }}>
                {l.msg}
              </span>
              <span className="tnum ml-1.5 text-[10px]" style={{ color: "var(--ink-3)" }}>
                {l.src}
              </span>
            </div>
            <span className="tnum mt-px text-[10px]" style={{ color: "var(--ink-3)" }}>
              {l.t}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
