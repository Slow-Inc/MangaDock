// Honest Overview signals derived from the live MitLive frame — keeps fabricated/mock values off the
// live path (the "live-native: real data or No Data, never fake" contract). Pure + unit-tested so the
// JSX just renders the result.

export interface StageLike {
  id: string;
  label: string;
  liveMs: number;
}

// Pipeline panel header. Returns null when there are no stages (render nothing) instead of a hardcoded
// "total 95.0s · translate stalled". A stage at ≥30s reads as stalled (same threshold as the spine).
export function pipelineHeaderSummary(stages: StageLike[] | undefined): string | null {
  if (!stages || stages.length === 0) return null;
  const totalMs = stages.reduce((sum, st) => sum + (st.liveMs || 0), 0);
  const total = `total ${(totalMs / 1000).toFixed(1)}s`;
  const stalled = stages.find((st) => st.liveMs >= 30000);
  return stalled ? `${total} · ${stalled.label.toLowerCase()} stalled` : total;
}

// Trend badge for a metric, computed from its rolling series (first → last) instead of a hardcoded
// "−11.4%". Returns null when there is nothing real to compare (no series / single point / 0 baseline).
export function pctDelta(series: number[] | undefined): { label: string; up: boolean } | null {
  if (!series || series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0) return null;
  const change = ((last - first) / first) * 100;
  const up = change >= 0;
  return { label: `${up ? "+" : "−"}${Math.abs(change).toFixed(1)}%`, up };
}
