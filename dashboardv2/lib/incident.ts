// Pure incident / diagnostic derivations for the MIT console (DESIGN.md §8, Track A).
// These surface data already carried by `MitLive` (lib/live-map) that the components dropped:
// the 9arm gateway plane-fault, the torch allocator bloat, worker-pool saturation, incident age.
// Extracted here so the logic is unit-tested in isolation (bun:test, <1s) and the JSX stays dumb —
// the "extract for testability" north star. No React, type-only imports.

import type { MitLive, MitVram } from "./live-map";

// ── gateway plane-fault localizer ───────────────────────────────────────────────
// A 9arm failure splits into a control plane (is the gateway host reachable — the probe
// timed by `controlMs`) and a data plane (does a translate actually complete — `latencyMs` /
// overall `status`). Which plane is down picks the fix, so we localize it and map the known
// bad states (server/status_snapshot._GATEWAY_BAD) to a concrete recovery action.

export type Plane = "up" | "down" | "unknown";
export interface GatewayDiagnosis {
  control: Plane; // gateway host reachable?
  data: Plane; // does translate work?
  ok: boolean; // both planes healthy
  hint: string | null; // next action when degraded
}

// "down" is the dashboard's generic degraded value; the rest mirror status_snapshot._GATEWAY_BAD.
const GATEWAY_BAD = new Set(["timeout", "unreachable", "auth", "model_missing", "down"]);
const HINTS: Record<string, string> = {
  timeout: "model not responding — check 9arm / reload-models",
  unreachable: "gateway host unreachable — check the tunnel",
  auth: "key rejected — rotate the gateway token",
  model_missing: "translator points at a model 9arm does not serve",
};

export function gatewayDiagnosis(gateway: MitLive["gateway"]): GatewayDiagnosis {
  if (!gateway) return { control: "unknown", data: "unknown", ok: false, hint: null };
  const bad = GATEWAY_BAD.has(gateway.status);
  // The control probe responded (controlMs present) ⇒ host reachable.
  const control: Plane = gateway.controlMs != null ? "up" : bad ? "down" : "unknown";
  // A translate completed (latencyMs present, not a bad state) ⇒ data plane up.
  const data: Plane = bad ? "down" : gateway.latencyMs != null ? "up" : "unknown";
  const ok = !bad && control === "up" && data === "up";
  let hint = HINTS[gateway.status] ?? null;
  if (!hint && bad) hint = control === "up" ? "gateway reachable but translate down — check model / 9arm" : "gateway unreachable — check the tunnel";
  return { control, data, ok, hint };
}

// ── torch VRAM allocator bloat ──────────────────────────────────────────────────
// `reserved` the allocator holds but isn't using. A reserved figure climbing while
// allocated stays flat is the non-release / fragmentation leak the dev hunts by hand
// (server/vram_probe). Both fields are in `m.vram` but the donut only reads `models`.

const BLOAT_GB = 1.0; // held (reserved−allocated) over ~1 GB reads as leaking
export interface VramBloat {
  allocatedGb: number;
  reservedGb: number;
  heldGb: number; // reserved − allocated
  bloated: boolean;
}

export function vramBloat(vram: MitVram | null | undefined): VramBloat | null {
  if (!vram || vram.allocatedMb == null || vram.reservedMb == null) return null;
  const gb = (mb: number) => Math.round((mb / 1024) * 10) / 10;
  const heldGb = Math.round(((vram.reservedMb - vram.allocatedMb) / 1024) * 10) / 10;
  return { allocatedGb: gb(vram.allocatedMb), reservedGb: gb(vram.reservedMb), heldGb, bloated: heldGb >= BLOAT_GB };
}

// ── worker-pool saturation ──────────────────────────────────────────────────────
// free=0 with a backlog means the pipeline itself is the bottleneck (not a one-off).
// `m.workers` is mapped but read nowhere; this drives the Overview KPI.

export interface WorkerSaturation {
  free: number;
  total: number;
  queued: number;
  saturated: boolean;
}

export function workerSaturation(workers: MitLive["workers"], queueSize: number): WorkerSaturation {
  const { free, total } = workers;
  return { free, total, queued: queueSize, saturated: free === 0 && total > 0 && queueSize > 0 };
}

// ── incident age ────────────────────────────────────────────────────────────────
// "11s" / "3m 48s" / "1h 04m" — mono tabular, for the degraded-now banner strip.
export function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) ms = 0;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}
