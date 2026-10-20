/** Small, pure helpers for the Studio shell and overview (Epic C #788). */

/** Sidebar width limits, as in the Dashboard Shell docs the dev supplied (resizable 180–400 px). */
export const SIDEBAR = { min: 180, max: 400, initial: 220, step: 10 } as const;

export function clampSidebarWidth(w: number): number {
  if (!Number.isFinite(w)) return SIDEBAR.initial;
  return Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, Math.round(w)));
}

/** SVG polyline points for a sparkline in a w × h box; the highest value sits at the top. */
export function sparklinePoints(values: number[], w: number, h: number, pad = 2): string {
  if (values.length === 0) return "";
  const mid = Math.round(h / 2);
  if (values.length === 1) return `${pad},${mid} ${w - pad},${mid}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = Math.round(pad + i * step);
      const y = span === 0 ? mid : Math.round(h - pad - ((v - min) / span) * (h - pad * 2));
      return `${x},${y}`;
    })
    .join(" ");
}
