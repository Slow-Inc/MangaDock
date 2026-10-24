/** Pure helpers for the Studio ECharts components (#789) — no echarts import, so they test in isolation. */
import type { BreakdownDatum } from "../../lib/dashboardAnalytics";

export type Tone = NonNullable<BreakdownDatum["tone"]>;

/** Data tones (kept by the analytics layer) → a design token and how strongly to apply it. */
export const TONE_COLOR: Record<Tone, { token: string; alpha: number }> = {
  indigo: { token: "--accent", alpha: 1 },
  emerald: { token: "--ok", alpha: 1 },
  amber: { token: "--coin", alpha: 1 },
  rose: { token: "--danger", alpha: 1 },
  sky: { token: "--accent", alpha: 0.55 },
  violet: { token: "--ink-3", alpha: 1 },
  slate: { token: "--ink-3", alpha: 1 },
};

/** The same tone as a CSS colour, for legend dots drawn in HTML; no tone means the accent. */
export function toneCss(tone: Tone | undefined): string {
  const { token, alpha } = TONE_COLOR[tone ?? "indigo"];
  return alpha === 1 ? `var(${token})` : `color-mix(in srgb, var(${token}) ${Math.round(alpha * 100)}%, transparent)`;
}

/** Whole-number shares of the total that add up to 100 (largest remainder); all zero when the total is zero. */
export function percentages(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, v) => sum + v, 0);
  const byRemainder = exact.map((v, i) => ({ i, r: v - floors[i] })).sort((a, b) => b.r - a.r);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/** False when there is nothing to draw (no values, or only zeros). */
export function hasValues(values: number[]): boolean {
  return values.some((v) => v !== 0);
}

const ROW = 36;
const FRAME = 24;
/** Height of the horizontal bar chart: one row per item plus the frame, never below 120 px. */
export function breakdownChartHeight(rows: number): number {
  return Math.max(120, rows * ROW + FRAME);
}
