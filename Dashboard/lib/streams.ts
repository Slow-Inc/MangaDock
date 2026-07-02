/** Per-service /status/stream connection health (the aggregator's own data plane).
 *  Pure — unit-tested in streams.test.ts. Per ADR 016 §Decision4: streams re-validate
 *  every ~60s and close on token expiry, so a stale revalidation is a zero-trust risk. */

export type StreamState = "connected" | "reconnecting" | "expired" | "down";

export interface StreamConn {
  service: string;
  state: StreamState;
  lastEventMs: number; // epoch of last received message
  revalidatedMs: number; // epoch of last JWT re-validation
}

export interface StreamStatus extends StreamConn {
  sinceEventMs: number;
  sinceRevalidateMs: number;
  expirySoon: boolean; // re-validation window almost elapsed
}

export interface StreamSummary {
  streams: StreamStatus[];
  connected: number;
  total: number;
  overall: "healthy" | "degraded" | "down";
}

export const REVALIDATE_MS = 60000;
const EXPIRY_SOON_FRACTION = 0.8;

export function summarizeStreams(streams: StreamConn[], now: number): StreamSummary {
  const out: StreamStatus[] = streams.map((s) => ({
    ...s,
    sinceEventMs: now - s.lastEventMs,
    sinceRevalidateMs: now - s.revalidatedMs,
    expirySoon: s.state === "connected" && now - s.revalidatedMs > REVALIDATE_MS * EXPIRY_SOON_FRACTION,
  }));

  const connected = out.filter((s) => s.state === "connected").length;
  const total = out.length;
  const overall: StreamSummary["overall"] = connected === 0 ? "down" : connected < total ? "degraded" : "healthy";

  return { streams: out, connected, total, overall };
}
