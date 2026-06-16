// Maps live MIT data (MitLive) into the dashboard panels' shapes, overriding ONLY
// the values MIT actually reports (the 9arm gateway probe, the GPU, the translate
// stage) and leaving everything MIT doesn't know (Redis/Supabase/payment/Backend
// nodes/per-model VRAM) as the mock baseline. Pure — unit-tested in live-panels.test.ts.

import type { Subsystem, Health } from "./health";
import type { StageStatus } from "./pipeline";
import type { GatewayProbe, DataState } from "./gateway";
import type { MitLive } from "./live-map";

/** 9arm probe status → subsystem health. ok=up, slow=degraded, everything else (timeout/
 *  auth/unreachable/model_missing) = down. */
export function gatewayHealth(status: string): Health {
  if (status === "ok") return "up";
  if (status === "slow") return "degraded";
  return "down";
}

/** Override the MIT-sourced subsystems (the 9arm gateway + the GPU) with live data;
 *  any subsystem whose live source is absent, and every non-MIT subsystem, is untouched. */
export function applyMitSubsystems(subsystems: Subsystem[], mit: MitLive): Subsystem[] {
  return subsystems.map((s) => {
    if (s.id === "gateway" && mit.gateway) {
      return { ...s, health: gatewayHealth(mit.gateway.status), detail: mit.gateway.detail, latencyMs: mit.gateway.latencyMs ?? s.latencyMs };
    }
    if (s.id === "gpu" && mit.gpu) {
      return {
        ...s,
        health: "up" as Health,
        detail: `${mit.gpu.utilPct ?? "—"}% · ${mit.gpu.vramUsedGb}/${mit.gpu.vramTotalGb} GB · ${mit.gpu.tempC ?? "—"}°C · fan ${mit.gpu.fanPct ?? "—"}%`,
      };
    }
    return s;
  });
}

export interface StageView {
  status: StageStatus;
  detail?: string;
  log?: string[];
}

/** The live translate-stage view derived from the gateway probe — the 2026-06-14
 *  incident signal (control up, model hung). null when the gateway wasn't probed, so
 *  the caller keeps the mock stage. */
export function mitTranslateStage(mit: MitLive): StageView | null {
  const g = mit.gateway;
  if (!g) return null;
  if (g.status === "ok") {
    return { status: "success", detail: "gateway + model healthy", log: [`custom_openai · ${mit.translator}`, g.detail] };
  }
  if (g.status === "slow") {
    return { status: "processing", detail: "model responding slowly", log: [g.detail] };
  }
  return { status: "error", detail: g.detail, log: [`custom_openai · ${mit.translator}`, g.detail, "pipeline stalled at translate"] };
}

/** Canonical pipeline order (MIT stage ids). */
const PIPELINE_ORDER = ["detect", "ocr", "translate", "inpaint", "render"] as const;

export interface LiveStageEntry { status: StageStatus; elapsedMs?: number }

/** The live pipeline panel from MIT's per-stage timings (`mit.stages`) — timing-only,
 *  NO faked per-stage detail (the run-summary source was removed). A stage MIT reported a
 *  timing for is `success` with its `elapsedMs`; `translate` keeps the richer gateway-derived
 *  state (passed in); stages MIT hasn't reported are `idle`. Before the first translate,
 *  `stages` is empty and `translate` is null → every stage is idle (the "No Data" pipeline). */
export function livePipelineStages(
  stages: Array<{ id: string; liveMs: number }>,
  translate: { status: StageStatus } | null,
): Record<string, LiveStageEntry> {
  const ms = new Map(stages.map((s) => [s.id, s.liveMs]));
  const out: Record<string, LiveStageEntry> = {};
  for (const id of PIPELINE_ORDER) {
    if (id === "translate" && translate) {
      out[id] = { status: translate.status };
      continue;
    }
    const t = ms.get(id);
    out[id] = t != null ? { status: "success", elapsedMs: t } : { status: "idle" };
  }
  return out;
}

/** Map the live gateway probe → the GatewayDiagnosis panel's GatewayProbe (control vs
 *  data split is real now MIT reports control_ms). null when unprobed → caller keeps mock. */
export function liveGatewayProbe(mit: MitLive): GatewayProbe | null {
  const g = mit.gateway;
  if (!g) return null;
  const dataState: DataState =
    g.status === "ok" ? "ok" : g.status === "slow" ? "slow" : g.status === "timeout" ? "timeout" : "error";
  return {
    controlOk: g.status !== "unreachable" && g.status !== "auth", // GET /models returned 200
    controlMs: g.controlMs ?? 0,
    dataState,
    dataMs: g.latencyMs ?? 0,
  };
}
