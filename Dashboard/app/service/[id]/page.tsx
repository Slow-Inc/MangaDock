"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { ServiceTerminal } from "@/components/service-terminal";
import { LogStream } from "@/components/log-stream";
import { ServiceTicker } from "@/components/service-ticker";
import { VramPanel } from "@/components/vram-panel";
import { NodeCluster } from "@/components/node-cluster";
import { CacheTiers } from "@/components/cache-tiers";
import { GatewayDiagnosis } from "@/components/gateway-diagnosis";
import { TranslateQueue } from "@/components/translate-queue";
import { GpuDetail } from "@/components/gpu-detail";
import { WorkerLifecycle } from "@/components/worker-lifecycle";
import { StageTimingPanel } from "@/components/stage-timing";
import { QualityPanel } from "@/components/quality-panel";
import { WritePathHealth } from "@/components/writepath-health";
import { EconomyPanel } from "@/components/economy-panel";
import { EdgeRealtime } from "@/components/edge-realtime";
import { useLang } from "@/components/lang-provider";
import { useDevAuth } from "@/components/auth-gate";
import { useLiveSnapshot } from "@/components/use-live-snapshot";
import { liveGatewayProbe } from "@/lib/live-panels";
import {
  getService, SERVICE_STATUS_COLOR, MIT_VRAM_MODELS, MIT_HOST_VRAM_TOTAL_GB,
  BACKEND_NODES, CLUSTER_NOW, CACHE_TIERS, QUEUE_JOBS, GATEWAY_PROBE, STAGE_TIMINGS, WRITE_PATH,
  type ServiceStatus,
} from "@/lib/services";
import type { StageTiming } from "@/lib/timing";
import type { QueueJob, JobState } from "@/lib/queue";
import type { LogEntry, LogLevel } from "@/lib/log";

const MIT_FAILURE_META = { stage: "translate", translator: "custom_openai", endpoint: "gateway.9arm.co", model: "qwen3.6-35b-a3b" };

export default function ServiceDetail() {
  const { t } = useLang();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const service = id ? getService(id) : undefined;

  // Live MIT data for the MIT detail page (only connect the stream on /service/mit).
  const { token } = useDevAuth();
  const live = useLiveSnapshot(id === "mit" ? token : null);

  if (!service) {
    return (
      <Shell>
        <div className="flex h-full flex-col items-center justify-center gap-3 py-24">
          <p className="text-[14px]" style={{ color: "var(--ink-2)" }}>
            Unknown service: <span className="tnum">{String(id)}</span>
          </p>
          <Link href="/" className="text-[13px] font-medium" style={{ color: "var(--writing)" }}>
            ← Back to overview
          </Link>
        </div>
      </Shell>
    );
  }

  const m = live.mit;
  const liveMit = service.id === "mit" && live.status === "live" && !!m;
  const effStatus: ServiceStatus = liveMit ? ((m!.status === "degraded" ? "stale" : m!.status) as ServiceStatus) : service.status;
  const sc = SERVICE_STATUS_COLOR[effStatus];

  // Override the MIT-real metric values AND sparkline data (accumulated from the live stream)
  // when live; a metric with no MIT source (pages/min) gets an empty series → "No Data".
  const sr = live.series;
  const metrics = liveMit
    ? service.metrics.map((mm) => {
        if (mm.label === "GPU util" && m!.gpu) return { ...mm, value: m!.gpu.utilPct ?? mm.value, sub: `${m!.gpu.tempC ?? "—"}°C · ${m!.gpu.powerW ?? "—"}W`, data: sr["gpuUtil"] ?? [] };
        if (mm.label === "VRAM" && m!.gpu) return { ...mm, value: m!.gpu.vramUsedGb, sub: `/ ${m!.gpu.vramTotalGb} GB`, data: sr["vram"] ?? [] };
        if (mm.label === "queue depth") return { ...mm, value: m!.queueSize, sub: `${m!.workers.alive}/${m!.workers.total} worker`, data: sr["queue"] ?? [] };
        if (mm.label === "pages/min") return { ...mm, value: "—", sub: "no source", data: [] };
        return { ...mm, data: [] };
      })
    : service.metrics;
  const gwProbe = liveMit ? liveGatewayProbe(m!) ?? GATEWAY_PROBE : GATEWAY_PROBE;

  // Map the live MIT telemetry into each panel's shape; empty → the panel shows "No Data".
  const baselineById = new Map(STAGE_TIMINGS.map((s) => [s.id, s.baselineMs]));
  const liveStages: StageTiming[] = (m?.stages ?? []).map((s) => ({ id: s.id, label: s.label, baselineMs: baselineById.get(s.id) ?? 0, liveMs: s.liveMs }));
  const liveJobs: QueueJob[] = (m?.queueJobs ?? []).map((j) => ({
    id: j.id, user: "—", manga: "—", chapter: "—", page: j.pageIndex ?? 0,
    state: (["queued", "running", "done", "failed"].includes(j.state) ? j.state : "queued") as JobState,
    stage: j.taskType, queuedMs: CLUSTER_NOW - (j.waitingMs ?? 0),
  }));
  // Real x-axis time labels for the live graphs (the wall-clock of each accumulated frame).
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const liveTimes = liveMit ? live.seriesT.map((ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }) : undefined;
  const fmtT = (at?: number) => (at ? new Date(at).toTimeString().slice(0, 8) : "");
  const liveLogs: LogEntry[] = (live.events as Array<{ kind?: string; detail?: string; at?: number }>).map((e) => ({
    t: fmtT(e.at),
    level: (e.kind === "error" ? "error" : "info") as LogLevel,
    src: e.kind === "translate_triggered" ? "queue" : e.kind === "stage" ? "stage" : e.kind ?? "mit",
    msg: e.detail ?? e.kind ?? "",
  }));

  return (
    <Shell right={<ServiceTicker service={service} />}>
      {/* header */}
      <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors" style={{ color: "var(--ink-3)" }}>
        <ArrowLeft size={13} />
        {t("nav.overview")}
      </Link>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: `color-mix(in oklch, ${service.color} 16%, transparent)` }}>
            <service.Icon size={21} strokeWidth={1.85} style={{ color: service.color }} />
          </span>
          <div>
            <h1 className="text-[21px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
              {service.name}
            </h1>
            <p className="tnum mt-0.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
              {service.tech} · {service.detail}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3" style={{ background: `color-mix(in oklch, ${sc} 12%, var(--surface))`, border: `1px solid color-mix(in oklch, ${sc} 28%, transparent)` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc }} />
          <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: sc }}>
            {liveMit ? m!.status : service.status}
          </span>
          {liveMit && <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: sc }}>· live</span>}
        </span>
      </div>

      {/* error banner */}
      {service.errors > 0 && service.errorLines && (
        <div className="mb-5 rounded-[var(--radius)] px-4 py-3.5" style={{ background: "color-mix(in oklch, var(--error) 8%, transparent)", border: "1px solid color-mix(in oklch, var(--error) 26%, transparent)" }}>
          <div className="mb-1.5 flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: "var(--error)" }} />
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--error)" }}>
              {service.errors} active error · pipeline stalled at translate
            </span>
          </div>
          {service.errorLines.map((line, i) => (
            <div key={i} className="tnum text-[11px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* telemetry KPIs (sparklines) — kept adjacent to the GPU host charts so all graphs sit together */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((mm) => (
          <MetricCard key={mm.label} label={mm.label} value={mm.value} unit={mm.unit} sub={mm.sub} data={mm.data} color={mm.color} Icon={mm.Icon} domain={mm.domain} times={liveTimes} />
        ))}
      </div>

      {/* MIT: all time-series graphs grouped here (telemetry above → GPU host charts) */}
      {service.id === "mit" && (
        <div className="mt-3"><GpuDetail series={liveMit ? sr : undefined} times={liveTimes} /></div>
      )}

      {/* MIT: diagnostics — gateway · queue · timing · VRAM · quality · worker */}
      {service.id === "mit" && (
        <>
          <div className="mt-3"><GatewayDiagnosis probe={gwProbe} meta={MIT_FAILURE_META} /></div>
          <div className="mt-3"><TranslateQueue jobs={liveMit ? liveJobs : QUEUE_JOBS} now={CLUSTER_NOW} /></div>
          <div className="mt-3"><StageTimingPanel stages={liveMit ? liveStages : STAGE_TIMINGS} /></div>
          <div className="mt-3"><VramPanel models={MIT_VRAM_MODELS} totalGb={liveMit && m!.gpu ? m!.gpu.vramTotalGb : MIT_HOST_VRAM_TOTAL_GB} live={liveMit ? m!.vram : undefined} /></div>
          <div className="mt-3"><QualityPanel live={liveMit} /></div>
          <div className="mt-3"><WorkerLifecycle workers={liveMit ? m!.workersDetail : undefined} /></div>
        </>
      )}

      {/* Backend: node cluster · cache tiers · write-path · economy · edge (from L2/Redis) */}
      {service.id === "backend" && (
        <>
          <div className="mt-3"><NodeCluster nodes={BACKEND_NODES} now={CLUSTER_NOW} /></div>
          <div className="mt-3"><CacheTiers input={CACHE_TIERS} now={CLUSTER_NOW} /></div>
          <div className="mt-3"><WritePathHealth state={WRITE_PATH} /></div>
          <div className="mt-3"><EconomyPanel /></div>
          <div className="mt-3"><EdgeRealtime /></div>
        </>
      )}

      {/* terminal — MIT gets a real read-only live console over the status stream */}
      <div className="mt-5">
        <ServiceTerminal service={service} mitConsole={service.id === "mit"} mit={m} events={live.events as Array<{ kind?: string; detail?: string; at?: number }>} />
      </div>

      {/* logs */}
      <div className="mt-3">
        <LogStream logs={liveMit ? liveLogs : service.logs} />
      </div>
    </Shell>
  );
}
