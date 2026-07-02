// Maps a MIT live `metric` frame (the full status snapshot from
// `server/status_snapshot.py::to_messages`) into the values the dashboard UI
// renders. Pure — unit-tested in live-map.test.ts. Keeps the snapshot's MB-based
// wire units out of the components (GB for VRAM/RAM, the human unit on the cards).

const gb = (mb: number | null | undefined): number =>
  mb == null ? 0 : Math.round((mb / 1024) * 10) / 10;

export interface MitGpu {
  utilPct: number | null;
  tempC: number | null;
  powerW: number | null;
  fanPct: number | null;
  vramUsedGb: number;
  vramTotalGb: number;
}

export interface MitStage { id: string; label: string; liveMs: number }
export interface MitVramModel { model: string; footprintMb: number; freedMb: number | null; leaked: boolean }
export interface MitVram { allocatedMb: number | null; reservedMb: number | null; models: MitVramModel[] }
export interface MitJob { id: string; taskType: string; taskId: string | null; pageIndex: number | null; state: string; waitingMs: number | null }
export interface MitWorkerDetail { ip: string; port: number; pid: number | null; busy: boolean; uptimeS: number | null }

export interface MitLive {
  status: string; // up | degraded | down
  ts: number;
  gpu: MitGpu | null;
  host: { cpuPct: number; ramUsedGb: number; ramTotalGb: number; diskUsedPct: number };
  gateway: { status: string; detail: string; latencyMs: number | null; controlMs: number | null } | null;
  queueSize: number;
  workers: { alive: number; total: number; free: number };
  translator: string;
  // Worker-reported telemetry (#279, 2026-06-16) — optional: empty/null/absent until a
  // GPU worker translates, so callers read `?? []` / null-check and show "No Data".
  stages?: MitStage[];
  vram?: MitVram | null;
  queueJobs?: MitJob[];
  workersDetail?: MitWorkerDetail[];
}

interface MetricFrame {
  ts?: number;
  status?: string;
  host?: { cpu_pct?: number; ram_used_mb?: number; ram_total_mb?: number; disk_used_pct?: number };
  gpus?: Array<{ util_pct?: number | null; temp_c?: number | null; power_w?: number | null; fan_pct?: number | null; vram_used_mb?: number | null; vram_total_mb?: number | null }>;
  gateway?: { status: string; detail: string; latency_ms?: number | null; control_ms?: number | null } | null;
  queue?: { size?: number; jobs?: Array<{ id: string; task_type?: string; task_id?: string | null; page_index?: number | null; state?: string; waiting_ms?: number | null }> };
  workers?: { alive?: number; total?: number; free?: number; detail?: Array<{ ip: string; port: number; pid?: number | null; busy?: boolean; uptime_s?: number | null }> };
  translator?: string;
  stages?: Array<{ id: string; label: string; live_ms: number }>;
  vram?: { allocated_mb?: number | null; reserved_mb?: number | null; models?: Array<{ model: string; footprint_mb?: number; freed_mb?: number | null; leaked?: boolean }> } | null;
}

export function mapMitSnapshot(frame: MetricFrame): MitLive {
  const g = frame.gpus?.[0];
  const h = frame.host ?? {};
  return {
    status: frame.status ?? "down",
    ts: frame.ts ?? 0,
    gpu: g
      ? {
          utilPct: g.util_pct ?? null,
          tempC: g.temp_c ?? null,
          powerW: g.power_w ?? null,
          fanPct: g.fan_pct ?? null,
          vramUsedGb: gb(g.vram_used_mb),
          vramTotalGb: gb(g.vram_total_mb),
        }
      : null,
    host: {
      cpuPct: h.cpu_pct ?? 0,
      ramUsedGb: gb(h.ram_used_mb),
      ramTotalGb: gb(h.ram_total_mb),
      diskUsedPct: h.disk_used_pct ?? 0,
    },
    gateway: frame.gateway ? { status: frame.gateway.status, detail: frame.gateway.detail, latencyMs: frame.gateway.latency_ms ?? null, controlMs: frame.gateway.control_ms ?? null } : null,
    queueSize: frame.queue?.size ?? 0,
    workers: { alive: frame.workers?.alive ?? 0, total: frame.workers?.total ?? 0, free: frame.workers?.free ?? 0 },
    translator: frame.translator ?? "—",
    stages: (frame.stages ?? []).map((s) => ({ id: s.id, label: s.label, liveMs: s.live_ms })),
    vram: frame.vram
      ? {
          allocatedMb: frame.vram.allocated_mb ?? null,
          reservedMb: frame.vram.reserved_mb ?? null,
          models: (frame.vram.models ?? []).map((m) => ({ model: m.model, footprintMb: m.footprint_mb ?? 0, freedMb: m.freed_mb ?? null, leaked: !!m.leaked })),
        }
      : null,
    queueJobs: (frame.queue?.jobs ?? []).map((j) => ({ id: j.id, taskType: j.task_type ?? "translate", taskId: j.task_id ?? null, pageIndex: j.page_index ?? null, state: j.state ?? "queued", waitingMs: j.waiting_ms ?? null })),
    workersDetail: (frame.workers?.detail ?? []).map((w) => ({ ip: w.ip, port: w.port, pid: w.pid ?? null, busy: !!w.busy, uptimeS: w.uptime_s ?? null })),
  };
}
