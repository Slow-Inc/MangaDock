"use client";

import { Radio } from "lucide-react";
import { summarizeStreams, type StreamConn, type StreamState } from "@/lib/streams";

const STATE_COLOR: Record<StreamState, string> = {
  connected: "var(--success)",
  reconnecting: "var(--processing)",
  expired: "var(--error)",
  down: "var(--error)",
};
const OVERALL_COLOR = { healthy: "var(--success)", degraded: "var(--processing)", down: "var(--error)" } as const;

export function StreamHealth({ streams, now }: { streams: StreamConn[]; now: number }) {
  const s = summarizeStreams(streams, now);
  const oc = OVERALL_COLOR[s.overall];

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Radio size={15} strokeWidth={1.85} style={{ color: "var(--panel-ink-2)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            Status streams
          </h2>
        </div>
        <span className="tnum text-[11px]" style={{ color: oc }}>
          {s.connected}/{s.total} connected
        </span>
      </div>
      <div className="px-5 pb-4">
        {s.streams.map((st) => (
          <div key={st.service} className="flex items-center justify-between py-1.5" style={{ borderTop: "1px solid var(--panel-hairline)" }}>
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {st.state === "connected" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: STATE_COLOR[st.state], opacity: 0.5 }} />}
                <span className="relative h-2 w-2 rounded-full" style={{ background: STATE_COLOR[st.state] }} />
              </span>
              <span className="text-[12px] font-medium" style={{ color: "var(--panel-ink)" }}>{st.service}</span>
              <span className="text-[10.5px]" style={{ color: STATE_COLOR[st.state] }}>{st.state}</span>
            </span>
            <span className="tnum text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
              event {(st.sinceEventMs / 1000).toFixed(0)}s ago
              {st.expirySoon && <span style={{ color: "var(--processing)" }}> · revalidate due</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
