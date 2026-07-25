/**
 * Small, dependency-free helpers for turning untrusted query-string input into
 * values that are safe to hand to PostgREST. Kept out of any service so they
 * can be unit-tested without a Supabase mock.
 */

/**
 * Parse a raw query value into an integer clamped to `[min, max]`.
 *
 * Missing / non-numeric input falls back to `fallback` instead of reaching
 * PostgREST as `NaN` (`.limit(NaN)` / `.range(0, NaN)` → 500), and negatives
 * are floored instead of producing an invalid range (#657).
 */
export function clampInt(
  raw: string | number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof raw === 'number' ? raw : parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/**
 * Quote a value for use inside a PostgREST `.or()` filter expression.
 *
 * `.or()` takes a comma-separated list of `column.op.value` clauses, so raw
 * user input containing `,` `.` `(` `)` can inject an extra top-level clause
 * (e.g. `q=a,title_id.not.is.null` returning the whole catalog). PostgREST
 * treats a double-quoted value as a literal, so quoting + escaping `"` and `\`
 * keeps the search term intact while making injection impossible (#660).
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
