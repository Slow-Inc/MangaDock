/**
 * The check-in "day" as the server sees it. CheckinService keys rows by
 * `new Date().toISOString().slice(0, 10)` — the UTC calendar day — so the
 * modal must use the same key or it reopens/hides on the wrong day for
 * users outside UTC (#665).
 */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
