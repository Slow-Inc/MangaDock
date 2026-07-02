/** Deterministic time-series generator + shared time axis (no Date / Math.random → SSR-safe).
 *  Used by every live chart so they share one 10-minute window. */

const N = 30;
const STEP = 20; // seconds between points
const BASE = 10 * 3600 + 25 * 60; // 10:25:00
const pad = (n: number) => String(n).padStart(2, "0");

export const TIME = Array.from({ length: N }, (_, i) => {
  const s = BASE + i * STEP;
  return `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}`;
});

export const X_TICKS = [TIME[0], TIME[Math.floor(N / 2)], TIME[N - 1]];

export interface GenOpts {
  phase?: number;
  spike?: number;
  trend?: number;
  dec?: number;
  min?: number;
  max?: number;
}

export function gen(base: number, amp: number, o: GenOpts = {}): { t: string; v: number }[] {
  const { phase = 0, spike = 0, trend = 0, dec = 0, min, max } = o;
  const f = Math.pow(10, dec);
  return TIME.map((t, i) => {
    let v = base + amp * Math.sin(i / 2.2 + phase) + spike * amp * Math.sin(i / 0.6 + phase) + trend * i;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return { t, v: Math.round(v * f) / f };
  });
}

/** Stable per-id phase offset so each node's charts look distinct but deterministic. */
export function seedOf(id: string): number {
  return id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 7;
}
