"use client";

import { useEffect, useRef, useState } from "react";
import { parseSseFrames } from "@/lib/live";
import { mapMitSnapshot, type MitLive } from "@/lib/live-map";
import { reduce, initialState, type State, type Message } from "@/lib/snapshot";
import { pushLog } from "@/lib/debug-log";

/** Surface a MIT stream frame in the debug console (its own log/event/error lines). */
function logMitFrame(m: Message): void {
  const a = m as { type?: string; kind?: string; subsystem?: string; status?: string; detail?: string };
  if (a.type === "event") pushLog(a.kind === "error" ? "error" : "info", "mit", `${a.kind}${a.detail ? `: ${a.detail}` : ""}`);
  else if (a.type === "status") pushLog(a.status === "ok" ? "info" : "warn", "mit", `${a.subsystem}: ${a.status}${a.detail ? ` · ${a.detail}` : ""}`);
}

// Subscribes to the authenticated `/api/live` proxy (which forwards the dev's
// token to MIT's `/status/stream`), parses the SSE frames, folds them through
// the snapshot reducer, and exposes the latest MIT view + event feed. Degrades
// to "offline" (caller falls back to mock) on any disconnect, with backoff
// reconnect. PRD #279, ADR 016.

export type LiveStatus = "connecting" | "live" | "offline";

export interface Live {
  status: LiveStatus;
  mit: MitLive | null;
  events: Message[];
  error?: string;
}

function isMitMetric(m: Message): boolean {
  return (m as { type?: string }).type === "metric" && (m as { service?: string }).service === "mit";
}

export function useLiveSnapshot(token: string | null): Live {
  const [live, setLive] = useState<Live>({ status: "connecting", mit: null, events: [] });
  const stateRef = useRef<State>(initialState());

  useEffect(() => {
    if (!token) {
      setLive({ status: "offline", mit: null, events: [], error: "no-session" });
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    let retry: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      if (cancelled) return;
      setLive((p) => ({ ...p, status: "connecting" }));
      try {
        const res = await fetch("/api/live", { headers: { Authorization: `Bearer ${token}` }, signal: ac.signal });
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          pushLog(res.status === 403 ? "warn" : "error", "live", `GET /api/live → ${res.status}${detail ? ` · ${detail.slice(0, 80)}` : ""}`);
          throw new Error(`live-${res.status}`);
        }
        pushLog("info", "live", "MIT stream connected");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const { messages, rest } = parseSseFrames(buf);
          buf = rest;
          if (!messages.length) continue;
          const now = Date.now();
          for (const m of messages) {
            stateRef.current = reduce(stateRef.current, m, now);
            logMitFrame(m);
          }
          const metric = [...messages].reverse().find(isMitMetric);
          const events = stateRef.current.events.slice(0, 50) as Message[];
          setLive((p) => ({ status: "live", mit: metric ? mapMitSnapshot(metric as never) : p.mit, events }));
        }
        throw new Error("stream-ended");
      } catch (e) {
        if (cancelled) return;
        pushLog("warn", "live", `stream offline: ${String(e)}`);
        setLive((p) => ({ status: "offline", mit: p.mit, events: p.events, error: String(e) }));
        retry = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      cancelled = true;
      ac.abort();
      if (retry) clearTimeout(retry);
    };
  }, [token]);

  return live;
}
