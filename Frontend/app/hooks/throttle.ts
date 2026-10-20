/**
 * Leading + trailing throttle decision. Given when the value last went out and the time now,
 * returns 0 to emit immediately, or how long to wait before the trailing emit.
 */
export function throttleDelay(lastEmit: number | null, now: number, intervalMs: number): number {
  if (lastEmit === null) return 0;
  const elapsed = now - lastEmit;
  return elapsed >= intervalMs ? 0 : intervalMs - elapsed;
}
