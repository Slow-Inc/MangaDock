/** Real, read-only MIT console — answers a curated command set from the LIVE status
 *  snapshot the dashboard already streams (no extra fetch, no arbitrary shell). Mutating/
 *  control actions are deliberately absent: the MIT worker is RCE-by-design and never
 *  driven from the browser console. Pure — unit-tested in mit-console.test.ts. */

import type { ConsoleResult } from "./console";
import type { MitLive } from "./live-map";
import type { TerminalLine, TerminalTone } from "./services";

const L = (text: string, tone: TerminalTone = "muted"): TerminalLine => ({ text, tone });
const n = (v: number | null | undefined, d = "—") => (v == null ? d : String(v));

const HELP: TerminalLine[] = [
  L("MIT live console (read-only) — commands:"),
  L("  status     overall · gpu · gateway · queue · workers"),
  L("  gpu        GPU util / temp / power / fan / VRAM"),
  L("  host       CPU / RAM / disk"),
  L("  vram       per-model VRAM footprint + leak flags (torch alloc/reserved)"),
  L("  gateway    9arm gateway control-plane vs data-plane probe"),
  L("  queue      translate queue + jobs"),
  L("  workers    registered workers (pid / uptime)"),
  L("  stages     last per-stage durations"),
  L("  logs       recent pipeline events"),
  L("  clear      clear the screen"),
  L("  help       this list"),
];

const STATUS_TONE = (s: string): TerminalTone => (s === "up" ? "ok" : s === "degraded" ? "warn" : "err");
const fmtUptime = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);

type EventLike = { kind?: string; detail?: string; at?: number };

export function runMitCommand(raw: string, mit: MitLive | null, events: EventLike[] = []): ConsoleResult {
  const input = raw.trim();
  if (!input) return { lines: [] };
  const c = input.split(/\s+/)[0].toLowerCase();

  if (c === "help") return { lines: HELP };
  if (c === "clear") return { lines: [], clear: true };
  if (!mit) return { lines: [L("not connected to MIT — sign in / stream offline", "err")] };

  const g = mit.gpu;
  const h = mit.host;
  const gw = mit.gateway;

  switch (c) {
    case "status":
      return {
        lines: [
          L(`MIT  ● ${mit.status} · ${mit.translator}`, STATUS_TONE(mit.status)),
          L(`gpu       ${g ? `${n(g.utilPct)}% · ${g.vramUsedGb}/${g.vramTotalGb} GB · ${n(g.tempC)}°C` : "—"}`),
          L(`host      cpu ${n(h.cpuPct)}% · ram ${h.ramUsedGb}/${h.ramTotalGb} GB · disk ${n(h.diskUsedPct)}%`),
          L(`gateway   ${gw ? `${gw.status} · ctrl ${n(gw.controlMs)}ms · data ${n(gw.latencyMs)}ms` : "unprobed"}`, gw ? STATUS_TONE(gw.status === "ok" ? "up" : gw.status === "slow" ? "degraded" : "down") : "muted"),
          L(`queue     ${mit.queueSize} · workers ${mit.workers.alive}/${mit.workers.total} (free ${mit.workers.free})`),
        ],
      };

    case "gpu":
      return g
        ? { lines: [L(`util ${n(g.utilPct)}% · temp ${n(g.tempC)}°C · power ${n(g.powerW)}W · fan ${n(g.fanPct)}% · VRAM ${g.vramUsedGb}/${g.vramTotalGb} GB`)] }
        : { lines: [L("no GPU on this worker", "muted")] };

    case "host":
      return { lines: [L(`cpu ${n(h.cpuPct)}% · ram ${h.ramUsedGb}/${h.ramTotalGb} GB · disk ${n(h.diskUsedPct)}%`)] };

    case "vram": {
      const v = mit.vram;
      if (!v || v.models.length === 0) return { lines: [L("no per-model VRAM yet — translate a page to populate", "muted")] };
      return {
        lines: [
          L(`torch alloc ${n(v.allocatedMb)} MB · reserved ${n(v.reservedMb)} MB`),
          ...v.models.map((m) =>
            L(`  ${m.model.padEnd(10)} ${String(m.footprintMb).padStart(5)} MB${m.leaked ? `  ⚠ LEAK (freed ${n(m.freedMb)} MB)` : m.freedMb != null ? `  freed ${m.freedMb} MB` : ""}`, m.leaked ? "err" : "muted")
          ),
        ],
      };
    }

    case "gateway":
      return gw
        ? {
            lines: [
              L(`control-plane (GET /models)   ${gw.status === "auth" || gw.status === "unreachable" ? "DOWN" : "up"} · ${n(gw.controlMs)}ms`, gw.status === "auth" || gw.status === "unreachable" ? "err" : "ok"),
              L(`data-plane (chat completion)  ${gw.status === "ok" ? "ok" : gw.status} · ${n(gw.latencyMs)}ms`, gw.status === "ok" ? "ok" : "warn"),
              L(`  ${gw.detail}`),
            ],
          }
        : { lines: [L("gateway not probed (MIT_DIAG_* unset)", "muted")] };

    case "queue": {
      const jobs = mit.queueJobs ?? [];
      if (jobs.length === 0) return { lines: [L(`queue empty · ${mit.queueSize} pending`, "muted")] };
      return {
        lines: [
          L(`${jobs.length} job(s):`),
          ...jobs.map((j) => L(`  ${j.id.padEnd(8)} ${j.taskType} p${n(j.pageIndex)} · ${j.state} · wait ${n(j.waitingMs)}ms`)),
        ],
      };
    }

    case "workers": {
      const ws = mit.workersDetail ?? [];
      return {
        lines: [
          L(`${mit.workers.alive}/${mit.workers.total} alive · ${mit.workers.free} free`, mit.workers.alive ? "ok" : "err"),
          ...ws.map((w) => L(`  pid ${n(w.pid)} · ${w.ip}:${w.port} · up ${fmtUptime(w.uptimeS)}${w.busy ? " · busy" : ""}`)),
          ...(ws.length === 0 ? [L("  (no worker registered)", "muted")] : []),
        ],
      };
    }

    case "stages": {
      const st = mit.stages ?? [];
      if (st.length === 0) return { lines: [L("no stage timings yet — translate a page", "muted")] };
      return { lines: st.map((s) => L(`  ${s.label.padEnd(10)} ${s.liveMs} ms`)) };
    }

    case "logs":
    case "tail": {
      if (events.length === 0) return { lines: [L("no events yet", "muted")] };
      return {
        lines: events.slice(0, 10).map((e) =>
          L(`  ${e.at ? new Date(e.at).toTimeString().slice(0, 8) : "--:--:--"} ${(e.kind ?? "event").padEnd(10)} ${e.detail ?? ""}`, e.kind === "error" ? "err" : "muted")
        ),
      };
    }

    default:
      return { lines: [L(`command not found: ${input.split(/\s+/)[0]} · type 'help' (read-only console)`, "err")] };
  }
}
