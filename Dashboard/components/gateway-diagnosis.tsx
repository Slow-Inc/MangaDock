"use client";

import { Split, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { diagnoseGateway, type GatewayProbe } from "@/lib/gateway";
import { useLang } from "@/components/lang-provider";

const PLANE_COLOR = { healthy: "var(--success)", "control-plane": "var(--error)", "data-plane": "var(--error)" } as const;

export interface FailureMeta {
  stage: string;
  translator: string;
  endpoint: string;
  model: string;
}

export function GatewayDiagnosis({ probe, meta }: { probe: GatewayProbe; meta: FailureMeta }) {
  const { t } = useLang();
  const d = diagnoseGateway(probe);
  const controlOk = probe.controlOk;
  const dataOk = probe.dataState === "ok";
  const pc = PLANE_COLOR[d.plane];

  const Plane = ({ label, sub, ok, value }: { label: string; sub: string; ok: boolean; value: string }) => (
    <div className="flex-1 rounded-xl px-3.5 py-3" style={{ background: "var(--panel-2)", border: `1px solid ${ok ? "color-mix(in oklch, var(--success) 32%, transparent)" : "color-mix(in oklch, var(--error) 38%, transparent)"}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{label}</span>
        {ok ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> : <XCircle size={14} style={{ color: "var(--error)" }} />}
      </div>
      <div className="tnum mt-1 text-[13px] font-semibold" style={{ color: ok ? "var(--success)" : "var(--error)" }}>{value}</div>
      <div className="tnum mt-0.5 text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>{sub}</div>
    </div>
  );

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <Split size={15} strokeWidth={1.85} style={{ color: "var(--c-translate)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            {t("gateway.title")}
          </h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5" style={{ background: `color-mix(in oklch, ${pc} 14%, transparent)` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: pc }} />
          <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: pc }}>
            {d.plane === "healthy" ? "healthy" : `${d.plane} fault`}
          </span>
        </span>
      </div>

      {/* control plane → data plane */}
      <div className="flex items-center gap-2 px-5">
        <Plane label="Control plane" sub="GET /models" ok={controlOk} value={controlOk ? `up · ${(probe.controlMs / 1000).toFixed(2)}s` : "unreachable"} />
        <ArrowRight size={16} style={{ color: "var(--panel-ink-3)" }} />
        <Plane label="Data plane" sub="chat completion" ok={dataOk} value={dataOk ? `ok · ${(probe.dataMs / 1000).toFixed(1)}s` : `${probe.dataState} · ${(probe.dataMs / 1000).toFixed(0)}s`} />
      </div>

      {/* structured failure */}
      <div className="mx-5 mt-3 flex flex-wrap items-center gap-1.5">
        {[meta.stage, meta.translator, meta.endpoint, meta.model, d.cause].map((v, i) => (
          <span key={i} className="tnum rounded-md px-2 py-1 text-[10.5px]" style={{ background: "var(--panel-2)", color: i === 4 ? pc : "var(--panel-ink-2)", border: "1px solid var(--panel-hairline)" }}>
            {v}
          </span>
        ))}
      </div>

      {/* hint */}
      <div className="mx-5 mb-4 mt-3 rounded-xl px-3.5 py-3 text-[11.5px] leading-relaxed" style={{ background: `color-mix(in oklch, ${pc} 7%, transparent)`, border: `1px solid color-mix(in oklch, ${pc} 22%, transparent)`, color: "var(--panel-ink)" }}>
        {d.hint}
      </div>
    </section>
  );
}
