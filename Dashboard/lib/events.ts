/** Live-activity event filtering. Pure — unit-tested in events.test.ts. */

export type ActivityFilter = "all" | "major";

/** Kinds an operator must not miss: failures and job-level milestones. */
export const MAJOR_KINDS = new Set(["error", "warning", "writing"]);

export function filterEvents<T extends { kind: string }>(events: T[], mode: ActivityFilter): T[] {
  if (mode === "all") return events;
  return events.filter((e) => MAJOR_KINDS.has(e.kind));
}
