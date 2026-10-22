/**
 * An integer query param, clamped to its bounds (#958). Missing or not a number → `fallback`, so `?limit=abc` can no
 * longer reach an upstream as NaN, and `?limit=100000` or `?page=-1` as an unbounded or negative value.
 */
export function queryInt(
  value: string | undefined,
  fallback: number,
  { min, max }: { min: number; max?: number },
): number {
  const n =
    value === undefined || value === '' ? NaN : Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max ?? Number.MAX_SAFE_INTEGER);
}
