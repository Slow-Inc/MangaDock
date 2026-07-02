/** Structured log levels + severity filtering. Pure — unit-tested in log.test.ts. */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  t: string;
  level: LogLevel;
  src: string;
  msg: string;
}

/** Ascending severity. Index = severity rank. */
export const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

/** Keep entries at or above `min` severity, preserving order. */
export function filterLogs<T extends { level: LogLevel }>(logs: T[], min: LogLevel): T[] {
  const floor = LOG_LEVELS.indexOf(min);
  return logs.filter((l) => LOG_LEVELS.indexOf(l.level) >= floor);
}

export const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "var(--idle)",
  info: "var(--writing)",
  warn: "var(--processing)",
  error: "var(--error)",
};
