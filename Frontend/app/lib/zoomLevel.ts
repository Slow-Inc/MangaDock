/**
 * Reader zoom-level math (#302) — the pure clamp/step logic extracted from
 * MangaReader's zoom buttons so it can be unit-tested. The `.toFixed(2)` round
 * is load-bearing: it keeps repeated ±0.25 steps from drifting (e.g. 1.35 + 0.25
 * = 1.5999999999999999) before clamping.
 */
export const ZOOM_STEP = 0.25;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

/** Next zoom level when zooming in: one step up, rounded to 2dp, clamped to max. */
export function zoomInLevel(z: number): number {
  return Math.min(+(z + ZOOM_STEP).toFixed(2), ZOOM_MAX);
}

/** Next zoom level when zooming out: one step down, rounded to 2dp, clamped to min. */
export function zoomOutLevel(z: number): number {
  return Math.max(+(z - ZOOM_STEP).toFixed(2), ZOOM_MIN);
}
