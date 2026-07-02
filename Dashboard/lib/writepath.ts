/** Cache write-behind health (BatchSyncWorker). Pure — unit-tested in writepath.test.ts.
 *  Per ADR 011: a leader-only worker drains the dirty queue → L3 + Supabase; the processing
 *  queue should be ~0, a non-empty dead-letter or an overdue flush is a durability risk. */

export interface WritePathState {
  dirty: number; // keys pending flush
  processing: number; // in-flight (should settle to 0)
  deadLetter: number; // failed permanently
  lastFlushAgeMs: number; // since the last successful flush
  slaMs: number; // flush SLA
  leaderHealthy: boolean;
}

export interface WritePathAssessment {
  health: "healthy" | "degraded" | "down";
  reasons: string[];
  flushOverdue: boolean;
}

export function assessWritePath(s: WritePathState): WritePathAssessment {
  const reasons: string[] = [];
  const flushOverdue = s.lastFlushAgeMs > s.slaMs;

  if (!s.leaderHealthy) reasons.push("no healthy leader — flush is leader-only");
  if (s.deadLetter > 0) reasons.push(`${s.deadLetter} key(s) in dead-letter`);
  if (s.processing > 0) reasons.push(`${s.processing} key(s) stuck in processing (should be 0)`);
  if (flushOverdue) reasons.push(`flush overdue (${(s.lastFlushAgeMs / 1000).toFixed(1)}s > ${(s.slaMs / 1000).toFixed(0)}s SLA)`);

  const health: WritePathAssessment["health"] =
    !s.leaderHealthy || s.deadLetter > 0 ? "down" : s.processing > 0 || flushOverdue ? "degraded" : "healthy";

  return { health, reasons, flushOverdue };
}
