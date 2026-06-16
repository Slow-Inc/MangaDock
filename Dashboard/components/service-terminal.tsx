"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalSquare } from "lucide-react";
import { runCommand } from "@/lib/console";
import { runMitCommand } from "@/lib/mit-console";
import type { MitLive } from "@/lib/live-map";
import type { Service, TerminalLine, TerminalTone } from "@/lib/services";

const MIT_BANNER: TerminalLine[] = [
  { text: "MIT live console — read-only introspection over the /status stream", tone: "muted" },
  { text: "type 'help' for commands · 'status' for a live snapshot", tone: "muted" },
];

const TONE: Record<TerminalTone, string> = {
  cmd: "var(--panel-ink)",
  muted: "var(--panel-ink-3)",
  ok: "var(--success)",
  warn: "var(--processing)",
  err: "var(--error)",
};

export function ServiceTerminal({ service, mitConsole, mit, events }: {
  service: Service;
  mitConsole?: boolean; // MIT live console (real read-only commands over the status stream)
  mit?: MitLive | null;
  events?: Array<{ kind?: string; detail?: string; at?: number }>;
}) {
  const port = service.tech.split("·").pop()?.trim() ?? service.tech;
  const [lines, setLines] = useState<TerminalLine[]>(mitConsole ? MIT_BANNER : service.terminal);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function submit() {
    const cmd = input;
    const echo: TerminalLine = { text: `$ ${cmd}`, tone: "cmd" };
    const result = mitConsole ? runMitCommand(cmd, mit ?? null, events ?? []) : runCommand(cmd, service);
    setLines((prev) => (result.clear ? [] : [...prev, echo, ...result.lines]));
    if (cmd.trim()) setHistory((h) => [...h, cmd]);
    setInput("");
    setHistIdx(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(history[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(null);
        setInput("");
      } else {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    }
  }

  return (
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* title bar */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--panel-hairline)", background: "var(--panel-2)" }}>
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--error)" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--processing)" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--success)" }} />
          </span>
          <span className="tnum ml-1 text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
            {service.id}@console · {port}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TerminalSquare size={13} style={{ color: "var(--panel-ink-3)" }} />
          <span className="text-[10.5px] font-medium uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>
            Terminal · type{" "}
            <span style={{ color: "var(--panel-ink-2)" }}>help</span>
          </span>
        </div>
      </div>

      {/* output + input — click anywhere focuses the prompt */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="max-h-[340px] cursor-text overflow-y-auto px-4 py-3.5"
      >
        {lines.map((l, i) => (
          <div key={i} className="tnum whitespace-pre-wrap break-all text-[11.5px] leading-[1.7]" style={{ color: TONE[l.tone ?? "muted"] }}>
            {l.text}
          </div>
        ))}
        {/* prompt */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-1.5"
        >
          <span className="tnum shrink-0 text-[11.5px]" style={{ color: "var(--success)" }}>
            $
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={`${service.name} console input`}
            className="tnum w-full bg-transparent text-[11.5px] leading-[1.7] outline-none"
            style={{ color: "var(--panel-ink)", caretColor: "var(--success)" }}
          />
        </form>
      </div>
    </section>
  );
}
