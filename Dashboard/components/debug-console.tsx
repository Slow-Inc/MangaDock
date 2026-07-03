"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Bug, X, Trash2, Copy } from "lucide-react";
import { getLogs, subscribeLogs, clearLogs, type DebugLevel } from "@/lib/debug-log";
import { SERVICES } from "@/lib/services";
import { useLang } from "@/components/lang-provider";

// Unified debug console: the dashboard's own live client events (auth / OAuth
// link / the /api/live status) PLUS each service's logs (Frontend / Backend /
// MIT). The client + MIT-stream entries are real-time; the per-service rows are
// the current snapshot. A dev opens this to see why something (e.g. an OAuth
// link) failed, without the browser devtools. PRD #279.

interface Row {
  time: string;
  level: DebugLevel;
  group: string; // Dashboard | Frontend | Backend | MIT
  source: string;
  msg: string;
  live: boolean;
}

const LEVEL_COLOR: Record<DebugLevel, string> = {
  debug: "var(--ink-3)",
  info: "var(--ink-2)",
  warn: "var(--processing)",
  error: "var(--error)",
};

const hhmmss = (t: number) => new Date(t).toTimeString().slice(0, 8);
const groupOf = (source: string) => (source === "mit" ? "MIT" : "Dashboard");

function useDebugEntries() {
  return useSyncExternalStore(subscribeLogs, getLogs, getLogs);
}

export function DebugConsole() {
  const { lang } = useLang();
  const th = lang === "th";
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const store = useDebugEntries();

  // Live client + MIT-stream events (newest first), then each service's snapshot logs.
  const rows: Row[] = useMemo(() => {
    const live: Row[] = [...store].reverse().map((e) => ({ time: hhmmss(e.t), level: e.level, group: groupOf(e.source), source: e.source, msg: e.msg, live: true }));
    const service: Row[] = SERVICES.flatMap((s) =>
      s.logs.map((l) => ({ time: l.t, level: (l.level as DebugLevel) ?? "info", group: s.name, source: l.src, msg: l.msg, live: false })),
    );
    return [...live, ...service];
  }, [store]);

  const groups = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.group)))], [rows]);
  const shown = filter === "All" ? rows : rows.filter((r) => r.group === filter);

  const copy = () => navigator.clipboard?.writeText(shown.map((r) => `${r.time} [${r.group}:${r.source}] ${r.level.toUpperCase()} ${r.msg}`).join("\n"));

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Open debug console"
        className="fixed bottom-5 left-5 z-40 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink-2)" }}>
        <Bug size={17} />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-[42vh] flex-col" style={{ background: "var(--surface)", borderTop: "1px solid var(--hairline)", boxShadow: "0 -8px 24px color-mix(in oklch, black 18%, transparent)" }}>
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--hairline)" }}>
        <Bug size={14} style={{ color: "var(--ink-2)" }} />
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>{th ? "คอนโซลดีบัก" : "Debug console"}</span>
        <div className="ml-2 flex flex-wrap gap-1">
          {groups.map((g) => (
            <button key={g} onClick={() => setFilter(g)}
              className="rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors"
              style={filter === g ? { background: "var(--ink)", color: "var(--bg)" } : { background: "color-mix(in oklch, var(--ink) 7%, transparent)", color: "var(--ink-2)" }}>
              {g}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[10.5px] tnum" style={{ color: "var(--ink-3)" }}>{shown.length}</span>
          <button onClick={copy} title="Copy" className="rounded p-1 hover:opacity-80"><Copy size={13} style={{ color: "var(--ink-3)" }} /></button>
          <button onClick={() => clearLogs()} title="Clear live" className="rounded p-1 hover:opacity-80"><Trash2 size={13} style={{ color: "var(--ink-3)" }} /></button>
          <button onClick={() => setOpen(false)} title="Close" className="rounded p-1 hover:opacity-80"><X size={14} style={{ color: "var(--ink-2)" }} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
        {shown.length === 0 ? (
          <div className="py-6 text-center text-[11.5px]" style={{ color: "var(--ink-3)" }}>{th ? "ยังไม่มี log" : "no logs yet"}</div>
        ) : (
          shown.map((r, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap">
              <span className="tnum shrink-0" style={{ color: "var(--ink-3)" }}>{r.time}</span>
              <span className="shrink-0" style={{ color: r.live ? "var(--success)" : "var(--ink-3)" }}>{r.group}:{r.source}</span>
              <span style={{ color: LEVEL_COLOR[r.level] }}>{r.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
