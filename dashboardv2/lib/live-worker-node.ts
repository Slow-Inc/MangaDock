// Build the node-popup model for the REAL MIT worker from live telemetry, instead of the fictional
// `mockNode`. MIT today emits one worker + machine-wide GPU/host, so the popup shows real GPU util /
// VRAM / temp / power / CPU / RAM and worker pid/uptime; fields MIT doesn't emit per-node (clocks,
// per-node bandwidth) stay null → the popup's existing "No Data" renders honestly. Pure + tested.

import type { MitLive, MitWorkerDetail } from "./live-map";
import type { NodeFull } from "./node-debug";

const fmtUptime = (s: number | null): string =>
  s == null ? "?" : s >= 3600 ? `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`;

// `logs` are recent live event detail strings (newest first) the caller pulls from the feed; absent → No Data.
export function liveWorkerNode(m: MitLive, worker: MitWorkerDetail, logs: string[] = []): NodeFull {
  const g = m.gpu;
  const leak = (m.vram?.models ?? []).filter((vm) => vm.leaked);
  const errors = leak.map((vm) => `${vm.model} VRAM not freed — leak ${vm.footprintMb}MB`);
  const id = `w-${worker.port}`;
  return {
    id,
    online: true,
    spec: g ? `GPU worker · ${g.vramTotalGb} GB VRAM` : "worker (no GPU telemetry)",
    gpuUsage: g?.utilPct ?? null,
    cpuUsage: m.host.cpuPct,
    gpuClockMhz: null, // MIT does not emit clocks → No Data (honest)
    cpuClockMhz: null,
    vramUsedGb: g?.vramUsedGb ?? null,
    vramTotalGb: g?.vramTotalGb ?? null,
    ramUsedGb: m.host.ramUsedGb,
    ramTotalGb: m.host.ramTotalGb,
    gpuTempC: g?.tempC ?? null,
    cpuTempC: null,
    fanPct: g?.fanPct ?? null,
    powerW: g?.powerW ?? null,
    bandwidthMbps: null, // not emitted per-node yet (#279)
    errors,
    logs,
    console: [
      `${id}@mit:~$ status`,
      `→ ${g ? `gpu ${g.utilPct ?? "—"}% · vram ${g.vramUsedGb}/${g.vramTotalGb} GB · ${g.tempC ?? "—"}°C` : "no gpu telemetry"} · ${worker.busy ? "busy" : "idle"} · up ${fmtUptime(worker.uptimeS)}`,
      `${id}@mit:~$ pid`,
      `→ ${worker.pid ?? "—"}`,
      `${id}@mit:~$ `,
    ],
  };
}
