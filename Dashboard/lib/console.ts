/** Curated operator-console command runner. Pure — unit-tested in console.test.ts.
 *  An allow-list of ops commands; output is simulated today, mapped to real MIT
 *  control endpoints later. No arbitrary shell execution by design. */

import type { Service, TerminalLine, TerminalTone } from "./services";

export interface ConsoleResult {
  lines: TerminalLine[];
  clear?: boolean;
}

const HELP: TerminalLine[] = [
  { text: "commands:", tone: "muted" },
  { text: "  status            service health snapshot", tone: "muted" },
  { text: "  restart [stage]   requeue / restart the worker", tone: "muted" },
  { text: "  tail              last log lines", tone: "muted" },
  { text: "  reload-models     reload resident GPU models (MIT)", tone: "muted" },
  { text: "  clear             clear the screen", tone: "muted" },
  { text: "  help              this list", tone: "muted" },
];

const NOTE = (text: string): TerminalLine => ({ text: `  note: ${text}`, tone: "muted" });
const SIMULATED = NOTE("simulated — no live process attached");

export function runCommand(raw: string, service: Service): ConsoleResult {
  const input = raw.trim();
  if (!input) return { lines: [] };

  const [cmd, ...args] = input.split(/\s+/);
  const isMit = service.id === "mit";

  switch (cmd.toLowerCase()) {
    case "help":
      return { lines: HELP };

    case "clear":
      return { lines: [], clear: true };

    case "status": {
      const dot = service.status === "up" ? "● up" : service.status === "down" ? "● down" : "● stale";
      const tone: TerminalTone = service.status === "up" ? "ok" : service.status === "down" ? "err" : "warn";
      return {
        lines: [
          { text: `${service.name}  ${dot} · ${service.detail}`, tone },
          ...service.stats.map((s) => ({ text: `${s.label.padEnd(16)} ${s.value}`, tone: "muted" as TerminalTone })),
          ...(service.errors > 0
            ? [{ text: `${service.errors} active error · type 'tail' for detail`, tone: "warn" as TerminalTone }]
            : []),
        ],
      };
    }

    case "tail":
      return {
        lines: service.logs.slice(0, 5).map((l) => ({
          text: `${l.t}  ${l.level.toUpperCase().padEnd(5)} ${l.src.padEnd(9)} ${l.msg}`,
          tone: (l.level === "error" ? "err" : l.level === "warn" ? "warn" : "muted") as TerminalTone,
        })),
      };

    case "restart":
      return {
        lines: [
          { text: args[0] ? `↻ restart stage '${args[0]}' …` : `↻ restart ${service.name} worker …`, tone: "warn" },
          ...(isMit ? [{ text: "  requeue One-Punch ch1 p3 → queued", tone: "ok" as TerminalTone }] : []),
          SIMULATED,
        ],
      };

    case "reload-models":
      if (!isMit) return { lines: [{ text: `no GPU models on ${service.name}`, tone: "muted" }] };
      return {
        lines: [
          { text: "↻ reloading resident models …", tone: "warn" },
          { text: "  detection(AnimeText) · ocr(manga-ocr) · inpaint(LaMa)", tone: "muted" },
          { text: "✓ 3 models resident · 5.8 GB VRAM", tone: "ok" },
          SIMULATED,
        ],
      };

    default:
      return { lines: [{ text: `command not found: ${cmd} · type 'help'`, tone: "err" }] };
  }
}
