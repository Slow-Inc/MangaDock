import { test, expect } from "bun:test";
import { summarizeQueue, type QueueJob } from "./queue";

const NOW = 1_000_000;

const jobs: QueueJob[] = [
  { id: "j1", user: "xeno", manga: "One-Punch", chapter: "ch1", page: 3, state: "running", stage: "translate", queuedMs: NOW - 95000, startedMs: NOW - 90000 },
  { id: "j2", user: "mira", manga: "Gal Yome", chapter: "ch2", page: 1, state: "queued", queuedMs: NOW - 12000 },
  { id: "j3", user: "ken", manga: "Berserk", chapter: "ch3", page: 7, state: "queued", queuedMs: NOW - 4000 },
  { id: "j4", user: "xeno", manga: "One-Punch", chapter: "ch1", page: 2, state: "done", queuedMs: NOW - 120000, startedMs: NOW - 118000 },
];

test("jobs are counted by state", () => {
  const q = summarizeQueue(jobs, NOW);
  expect(q.running).toBe(1);
  expect(q.queued).toBe(2);
  expect(q.done).toBe(1);
});

test("a job running past the stuck threshold is flagged", () => {
  const q = summarizeQueue(jobs, NOW);
  expect(q.stuckCount).toBe(1);
  expect(q.jobs.find((j) => j.id === "j1")!.stuck).toBe(true);
});

test("oldest wait reflects the longest-waiting queued job", () => {
  expect(summarizeQueue(jobs, NOW).oldestWaitMs).toBe(12000);
});

test("a running job reports time spent waiting before it started", () => {
  expect(summarizeQueue(jobs, NOW).jobs.find((j) => j.id === "j1")!.waitMs).toBe(5000);
});
