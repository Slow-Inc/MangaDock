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

export interface MitLive {
  status: string; // up | degraded | down
  ts: number;
  gpu: MitGpu | null;
  host: { cpuPct: number; ramUsedGb: number; ramTotalGb: number; diskUsedPct: number };
  gateway: { status: string; detail: string; latencyMs: number | null; controlMs: number | null } | null;
  queueSize: number;
  workers: { alive: number; total: number; free: number };
  translator: string;
}

interface MetricFrame {
  ts?: number;
  status?: string;
  host?: { cpu_pct?: number; ram_used_mb?: number; ram_total_mb?: number; disk_used_pct?: number };
  gpus?: Array<{ util_pct?: number | null; temp_c?: number | null; power_w?: number | null; fan_pct?: number | null; vram_used_mb?: number | null; vram_total_mb?: number | null }>;
  gateway?: { status: string; detail: string; latency_ms?: number | null; control_ms?: number | null } | null;
  queue?: { size?: number };
  workers?: { alive?: number; total?: number; free?: number };
  translator?: string;
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
  };
}
