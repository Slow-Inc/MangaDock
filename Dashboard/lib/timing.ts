/** Per-stage timing vs baseline + regression detection. Pure — unit-tested in timing.test.ts. */

export interface StageTiming {
  id: string;
  label: string;
  baselineMs: number;
  liveMs: number;
}

export interface StageTimingResult extends StageTiming {
  deltaPct: number; // (live - baseline) / baseline * 100, rounded
  regressed: boolean;
}

export interface TimingSummary {
  stages: StageTimingResult[];
  regressedCount: number;
  totalBaselineMs: number;
  totalLiveMs: number;
}

export const REGRESSION_PCT = 25; // a stage ≥25% slower than baseline is flagged

export function assessTiming(stages: StageTiming[]): TimingSummary {
  const out: StageTimingResult[] = stages.map((s) => {
    const deltaPct = s.baselineMs === 0 ? 0 : Math.round(((s.liveMs - s.baselineMs) / s.baselineMs) * 100);
    return { ...s, deltaPct, regressed: deltaPct >= REGRESSION_PCT };
  });
  return {
    stages: out,
    regressedCount: out.filter((s) => s.regressed).length,
    totalBaselineMs: stages.reduce((t, s) => t + s.baselineMs, 0),
    totalLiveMs: stages.reduce((t, s) => t + s.liveMs, 0),
  };
}
