// Rolling client-side time-series for the MIT live graphs. MIT reports CURRENT values
// per SSE frame (no history), so the dashboard accumulates each frame's sample into a
// per-metric ring buffer — that's what turns the static mock sparklines into live charts
// that move with real usage. Pure — unit-tested in live-series.test.ts.

export type SeriesMap = Record<string, number[]>;

const DEFAULT_CAP = 40; // ~2 min of history at the 3s sample interval

/** Append one sample (a {metric: value} snapshot) onto each metric's rolling buffer,
 *  capped to the most recent `cap`. null/undefined values are skipped (a missing metric
 *  this frame just doesn't grow — keeps the series gap-tolerant). Returns a new map. */
export function pushSample(
  series: SeriesMap,
  sample: Record<string, number | null | undefined>,
  cap: number = DEFAULT_CAP,
): SeriesMap {
  const next: SeriesMap = { ...series };
  for (const [k, v] of Object.entries(sample)) {
    if (v == null) continue;
    const buf = (next[k] ?? []).concat(v);
    next[k] = buf.length > cap ? buf.slice(buf.length - cap) : buf;
  }
  return next;
}
