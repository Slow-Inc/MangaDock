/** Translate queue / batch-job summary. Pure — unit-tested in queue.test.ts.
 *  Per ADR 016 §Decision3: the queue carries the manga + requesting user; a job
 *  running past STUCK_MS is "stuck on stage". */

export type JobState = "queued" | "running" | "done" | "failed";

export interface QueueJob {
  id: string;
  user: string;
  manga: string;
  chapter: string;
  page: number;
  state: JobState;
  stage?: string; // current pipeline stage if running
  queuedMs: number; // epoch when enqueued
  startedMs?: number; // epoch when it began running
}

export interface QueueJobStatus extends QueueJob {
  waitMs: number; // time spent waiting before running (or so far, if still queued)
  runMs: number; // time spent running (0 if not running)
  stuck: boolean;
}

export interface QueueSummary {
  jobs: QueueJobStatus[];
  queued: number;
  running: number;
  done: number;
  failed: number;
  oldestWaitMs: number; // longest current wait among queued jobs
  stuckCount: number;
}

export const STUCK_MS = 60000; // running longer than this is presumed stuck

export function summarizeQueue(jobs: QueueJob[], now: number): QueueSummary {
  const out: QueueJobStatus[] = jobs.map((j) => {
    const waitMs = (j.startedMs ?? now) - j.queuedMs;
    const runMs = j.state === "running" && j.startedMs != null ? now - j.startedMs : 0;
    return { ...j, waitMs, runMs, stuck: j.state === "running" && runMs > STUCK_MS };
  });

  const count = (s: JobState) => out.filter((j) => j.state === s).length;
  const oldestWaitMs = out.filter((j) => j.state === "queued").reduce((m, j) => Math.max(m, j.waitMs), 0);

  return {
    jobs: out,
    queued: count("queued"),
    running: count("running"),
    done: count("done"),
    failed: count("failed"),
    oldestWaitMs,
    stuckCount: out.filter((j) => j.stuck).length,
  };
}
