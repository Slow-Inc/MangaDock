"use client";

import { useState, useRef, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Cpu, MemoryStick, AlertTriangle, Wifi, WifiOff, Loader2, HardDrive } from "lucide-react";
import { useDevAuth } from "@/components/auth-gate";
import { useLiveSnapshot } from "@/components/use-live-snapshot";
import { applyMitSubsystems, mitTranslateStage } from "@/lib/live-panels";
import { Shell } from "@/components/shell";
import { SystemFlow } from "@/components/system-flow";
import { PipelinePanel, type StageDetail } from "@/components/pipeline-panel";
import { MetricCard } from "@/components/metric-card";
import { VramPanel } from "@/components/vram-panel";
import { ServiceModal } from "@/components/service-modal";
import { LiveActivity } from "@/components/live-activity";
import { SubsystemBoard } from "@/components/subsystem-board";
import { StreamHealth } from "@/components/stream-health";
import { IncidentSummary } from "@/components/incident-summary";
import { TrafficPanel } from "@/components/traffic-panel";
import { useLang } from "@/components/lang-provider";
import { getService, MIT_VRAM_MODELS, MIT_HOST_VRAM_TOTAL_GB, SUBSYSTEMS, STREAMS, CLUSTER_NOW, USERS, BANDWIDTH_SERVICES, BANDWIDTH_NODES, type ServiceStatus } from "@/lib/services";

function wave(base: number, amp: number, n = 28, phase = 0) {
  return Array.from({ length: n }, (_, i) => Math.round((base + amp * Math.sin(i / 2.6 + phase)) * 10) / 10);
}

const STATUSES: Record<string, StageDetail> = {
  detection: { status: "success", elapsedMs: 820, detail: "8 text regions", log: ["AnimeText YOLO · 8 regions · 0.82s"] },
  ocr: { status: "success", elapsedMs: 1240, detail: "8 lines + 1 SFX rescued", log: ["manga-ocr · 8 lines · 1.24s", "VLM SFX rescue · ぬ → “SLURP”"] },
  translate: {
    status: "error",
    elapsedMs: 90000,
    detail: "model not responding",
    log: [
      "custom_openai → gateway.9arm.co / qwen3.6-35b-a3b",
      "GET /models → 200 OK (0.19s) · control plane up",
      "POST /chat/completions → timeout ×3 (40 / 60 / 80s)",
      "Exception: ollama servers did not respond quickly enough",
    ],
  },
  inpaint: { status: "idle" },
  render: { status: "idle" },
};

function ConnChip({ conn, lang }: { conn: "connecting" | "live" | "offline"; lang: string }) {
  const th = lang === "th";
  if (conn === "connecting")
    return (
      <span className="flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[12px] font-medium"
        style={{ background: "color-mix(in oklch, var(--ink) 7%, transparent)", color: "var(--ink-2)" }}>
        <Loader2 size={12} className="animate-spin" /> {th ? "กำลังเชื่อมต่อ…" : "connecting…"}
      </span>
    );
  if (conn === "offline")
    return (
      <span className="flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[12px] font-medium"
        style={{ background: "color-mix(in oklch, var(--ink) 7%, transparent)", color: "var(--ink-3)" }}>
        <WifiOff size={12} /> {th ? "ออฟไลน์ · mock" : "offline · mock"}
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[12px] font-medium"
      style={{ background: "color-mix(in oklch, var(--success) 14%, var(--surface))", color: "var(--ink)", border: "1px solid color-mix(in oklch, var(--success) 30%, transparent)" }}>
      <Wifi size={12} style={{ color: "var(--success)" }} /> {th ? "ข้อมูลสด · MIT" : "live · MIT"}
    </span>
  );
}

function MitChip({ status, lang }: { status: string; lang: string }) {
  const th = lang === "th";
  const map: Record<string, { c: string; en: string; th: string }> = {
    up: { c: "var(--success)", en: "all systems nominal", th: "ระบบปกติ" },
    degraded: { c: "var(--processing)", en: "translate degraded", th: "แปลมีปัญหา" },
    down: { c: "var(--error)", en: "MIT down", th: "MIT ล่ม" },
  };
  const s = map[status] ?? map.up;
  return (
    <span className="flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3 text-[12px] font-medium"
      style={{ background: `color-mix(in oklch, ${s.c} 12%, var(--surface))`, border: `1px solid color-mix(in oklch, ${s.c} 28%, transparent)`, color: "var(--ink)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.c }} />
      {th ? s.th : s.en}
    </span>
  );
}

export default function Page() {
  const router = useRouter();
  const { t, lang } = useLang();
  const [modalId, setModalId] = useState<string | null>(null);
  const modalService = modalId ? getService(modalId) ?? null : null;

  // Live MIT telemetry via the authenticated /api/live proxy (PRD #279, ADR 016);
  // falls back to the mock values below when offline / signed out.
  const { token } = useDevAuth();
  const live = useLiveSnapshot(token);
  const m = live.mit;
  const series = useRef<{ gpu: number[]; cpu: number[]; ram: number[] }>({ gpu: [], cpu: [], ram: [] });
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!m) return;
    const push = (a: number[], v: number) => { a.push(v); if (a.length > 28) a.shift(); };
    push(series.current.gpu, m.gpu?.utilPct ?? 0);
    push(series.current.cpu, m.host.cpuPct);
    push(series.current.ram, m.host.ramUsedGb);
    bump();
  }, [m]);
  const liveOn = live.status === "live" && !!m;

  // Real MIT data → panels (only what MIT actually reports; the rest stays mock).
  const subsystems = liveOn ? applyMitSubsystems(SUBSYSTEMS, m!) : SUBSYSTEMS;
  const liveTranslate = liveOn ? mitTranslateStage(m!) : null;
  const statuses = liveTranslate ? { ...STATUSES, translate: { ...STATUSES.translate, ...liveTranslate } } : STATUSES;
  const mitFlow = liveOn
    ? {
        status: (m!.status === "degraded" ? "stale" : m!.status) as ServiceStatus,
        metric:
          m!.status === "down" ? "translate failing"
          : m!.status === "degraded" ? "translate degraded"
          : `${m!.gpu?.utilPct ?? 0}% GPU · ${m!.queueSize} queued`,
        errors: m!.status === "up" ? 0 : 1,
      }
    : undefined;

  return (
    <Shell right={<LiveActivity />}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
            {t("overview.title")}
          </h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            {t("overview.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnChip conn={live.status} lang={lang} />
          {liveOn ? (
            <MitChip status={m!.status} lang={lang} />
          ) : (
            <div
              className="flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3"
              style={{ background: "color-mix(in oklch, var(--error) 12%, var(--surface))", border: "1px solid color-mix(in oklch, var(--error) 28%, transparent)" }}
            >
              <AlertTriangle size={13} style={{ color: "var(--error)" }} />
              <span className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>
                {t("overview.mitDown")}
              </span>
            </div>
          )}
        </div>
      </div>

      <SystemFlow selected={modalId} onSelect={setModalId} mitLive={mitFlow} />

      <div className="mt-5">
        <SubsystemBoard subsystems={subsystems} />
      </div>

      <div className="mt-5">
        <IncidentSummary />
      </div>

      <div className="mt-5">
        <PipelinePanel statuses={statuses} activeId="translate" />
      </div>

      <div className="mt-5 mb-2.5 text-[11.5px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
        {t("overview.telemetry")}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="GPU util"
          value={liveOn ? (m!.gpu?.utilPct ?? 0) : 65}
          unit="%"
          Icon={Gauge}
          color="var(--c-render)"
          domain={[0, 100]}
          data={liveOn && series.current.gpu.length >= 2 ? series.current.gpu : wave(58, 12)}
          sub={liveOn && m!.gpu ? `${m!.gpu.vramUsedGb}/${m!.gpu.vramTotalGb} GB · ${m!.gpu.tempC ?? "—"}°C · ${m!.gpu.powerW ?? "—"}W` : "RTX 4070 SUPER"}
        />
        <MetricCard
          label="CPU"
          value={liveOn ? Math.round(m!.host.cpuPct) : 42}
          unit="%"
          Icon={Cpu}
          color="var(--c-detect)"
          domain={[0, 100]}
          data={liveOn && series.current.cpu.length >= 2 ? series.current.cpu : wave(38, 14, 28, 1)}
          sub={liveOn ? `disk ${m!.host.diskUsedPct}% used` : "16 cores"}
        />
        <MetricCard
          label="RAM"
          value={liveOn ? m!.host.ramUsedGb : 9.8}
          unit="GB"
          Icon={liveOn ? HardDrive : MemoryStick}
          color="var(--c-ocr)"
          data={liveOn && series.current.ram.length >= 2 ? series.current.ram : wave(9.5, 1.2, 28, 2)}
          sub={liveOn ? `/ ${m!.host.ramTotalGb} GB` : "/ 32 GB"}
        />
      </div>

      <div className="mt-3">
        <VramPanel models={MIT_VRAM_MODELS} totalGb={liveOn && m!.gpu ? m!.gpu.vramTotalGb : MIT_HOST_VRAM_TOTAL_GB} />
      </div>

      <div className="mt-3">
        <TrafficPanel users={USERS} services={BANDWIDTH_SERVICES} nodes={BANDWIDTH_NODES} />
      </div>

      <div className="mt-3">
        <StreamHealth streams={STREAMS} now={CLUSTER_NOW} />
      </div>

      <ServiceModal
        service={modalService}
        onClose={() => setModalId(null)}
        onViewDetails={(sid) => {
          setModalId(null);
          router.push(`/service/${sid}`);
        }}
      />
    </Shell>
  );
}
