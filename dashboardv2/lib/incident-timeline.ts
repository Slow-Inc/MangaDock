// Client-side incident timeline — a ring buffer of health ticks the Overview renders as a punch-card
// rail (recent history at a glance: when did MIT go degraded, for how long). MIT's snapshot is a point
// in time; the dashboard accumulates it. Pure (append + cap + derive), unit-tested; the component holds
// the buffer in a ref and pushes one tick per frame.

import type { MitLive } from "./live-map";

export interface TimelineTick {
  at: number; // epoch ms
  status: string; // up | degraded | down | …
  ok: boolean; // healthy (up/ok) — drives the rail colour
}

const HEALTHY = new Set(["up", "ok"]);

export function tickFromLive(m: MitLive | null, at: number): TimelineTick | null {
  if (!m) return null;
  return { at, status: m.status, ok: HEALTHY.has(m.status) };
}

// Append a tick, keeping at most `cap` (oldest dropped). Skips a duplicate when status is unchanged AND
// within `minGapMs` of the last tick — so a 1s poll doesn't flood the rail; a real transition always lands.
export function pushTick(buf: TimelineTick[], tick: TimelineTick, cap = 60, minGapMs = 5000): TimelineTick[] {
  const last = buf[buf.length - 1];
  if (last && last.status === tick.status && tick.at - last.at < minGapMs) return buf;
  return [...buf, tick].slice(-cap);
}

export interface TimelineSummary {
  total: number;
  degraded: number; // count of non-ok ticks
  okPct: number; // share healthy, 0–100
}

export function summarize(buf: TimelineTick[]): TimelineSummary {
  const total = buf.length;
  const degraded = buf.filter((t) => !t.ok).length;
  return { total, degraded, okPct: total ? Math.round(((total - degraded) / total) * 100) : 100 };
}
