// Client-side debug log store for the dashboard's debug console. Captures auth /
// link / live-stream events as they happen so a dev can see what the dashboard is
// doing (and why an OAuth link failed) without the browser devtools. The pure
// `appendCapped` is unit-tested; the singleton store wraps it + a subscribe API.

export type DebugLevel = "debug" | "info" | "warn" | "error";

export interface DebugEntry {
  t: number; // epoch ms
  level: DebugLevel;
  source: string; // e.g. "auth", "live", "github-link", "mit", "backend"
  msg: string;
}

/** Append `item`, keeping only the last `max` entries. Pure — never mutates `list`. */
export function appendCapped(list: DebugEntry[], item: DebugEntry, max: number): DebugEntry[] {
  const next = [...list, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

const MAX = 300;
let entries: DebugEntry[] = [];
const subs = new Set<() => void>();

export function pushLog(level: DebugLevel, source: string, msg: string): void {
  // Date.now is fine here — debug logs are client-only, never SSR-rendered.
  entries = appendCapped(entries, { t: Date.now(), level, source, msg }, MAX);
  subs.forEach((s) => s());
}

export function getLogs(): DebugEntry[] {
  return entries;
}

export function clearLogs(): void {
  entries = [];
  subs.forEach((s) => s());
}

export function subscribeLogs(cb: () => void): () => void {
  subs.add(cb);
  return () => void subs.delete(cb);
}
