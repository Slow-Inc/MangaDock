"use client";

import { useEffect, useRef, useState } from "react";
import { parseSseFrames } from "@/lib/live";
import { mapMitSnapshot, type MitLive } from "@/lib/live-map";
import { pushSample, type SeriesMap } from "@/lib/live-series";
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
  series: SeriesMap; // rolling per-metric history accumulated from the stream (live graphs)
  seriesT: number[]; // epoch ms of each accumulated frame — the real x-axis for the graphs
  error?: string;
}

const SERIES_CAP = 40; // keep the time axis aligned with pushSample's default cap

/** The numeric metrics worth charting, pulled from one snapshot — what the live
 *  graphs accumulate. Keys match the components' series lookups. */
function sampleFrom(mit: MitLive): Record<string, number | null> {
  return {
    gpuUtil: mit.gpu?.utilPct ?? null,
    vram: mit.gpu?.vramUsedGb ?? null,
    gpuTemp: mit.gpu?.tempC ?? null,
    power: mit.gpu?.powerW ?? null,
    fan: mit.gpu?.fanPct ?? null,
    cpu: mit.host.cpuPct,
    ram: mit.host.ramUsedGb,
    queue: mit.queueSize,
  };
}

function isMitMetric(m: Message): boolean {
  return (m as { type?: string }).type === "metric" && (m as { service?: string }).service === "mit";
}

export function useLiveSnapshot(token: string | null): Live {
  const [live, setLive] = useState<Live>({ status: "connecting", mit: null, events: [], series: {}, seriesT: [] });
  const stateRef = useRef<State>(initialState());
  const seriesRef = useRef<SeriesMap>({});
  const seriesTRef = useRef<number[]>([]);

  useEffect(() => {
    if (!token) {
      setLive({ status: "offline", mit: null, events: [], series: seriesRef.current, seriesT: seriesTRef.current, error: "no-session" });
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
          const mit = metric ? mapMitSnapshot(metric as never) : null;
          if (mit) {
            seriesRef.current = pushSample(seriesRef.current, sampleFrom(mit));
            seriesTRef.current = [...seriesTRef.current, now].slice(-SERIES_CAP);
          }
          const events = stateRef.current.events.slice(0, 50) as Message[];
          setLive((p) => ({ status: "live", mit: mit ?? p.mit, events, series: seriesRef.current, seriesT: seriesTRef.current }));
        }
        throw new Error("stream-ended");
      } catch (e) {
        if (cancelled) return;
        pushLog("warn", "live", `stream offline: ${String(e)}`);
        setLive((p) => ({ status: "offline", mit: p.mit, events: p.events, series: p.series, seriesT: p.seriesT, error: String(e) }));
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
