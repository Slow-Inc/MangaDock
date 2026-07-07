import { test, expect } from "bun:test";
import { assessWritePath, type WritePathState } from "./writepath";

const base: WritePathState = { dirty: 12, processing: 0, deadLetter: 0, lastFlushAgeMs: 2000, slaMs: 5000, leaderHealthy: true };

test("a draining queue with a healthy leader is healthy", () => {
  const a = assessWritePath(base);
  expect(a.health).toBe("healthy");
  expect(a.reasons).toHaveLength(0);
});

test("dead-letter entries make the write path down", () => {
  expect(assessWritePath({ ...base, deadLetter: 2 }).health).toBe("down");
});

test("keys stuck in processing degrade the write path", () => {
  const a = assessWritePath({ ...base, processing: 4 });
  expect(a.health).toBe("degraded");
  expect(a.reasons.join(" ")).toContain("processing");
});

test("a flush past its SLA is overdue and degraded", () => {
  const a = assessWritePath({ ...base, lastFlushAgeMs: 9000 });
  expect(a.flushOverdue).toBe(true);
  expect(a.health).toBe("degraded");
});

test("a missing leader takes the write path down (flush is leader-only)", () => {
  expect(assessWritePath({ ...base, leaderHealthy: false }).health).toBe("down");
});
