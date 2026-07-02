import { test, expect } from "bun:test";
import { searchSnapshot } from "./search";
import { MOCK_MIT } from "./mock-live";

test("empty / whitespace query → no results", () => {
  expect(searchSnapshot(MOCK_MIT, "")).toEqual([]);
  expect(searchSnapshot(MOCK_MIT, "   ")).toEqual([]);
});

test("null snapshot → no results", () => {
  expect(searchSnapshot(null, "translate")).toEqual([]);
});

test("matches a stage by label, targets the pipeline tab", () => {
  const r = searchSnapshot(MOCK_MIT, "translate");
  const stage = r.find((x) => x.kind === "stage");
  expect(stage?.label).toBe("Translate");
  expect(stage?.target).toEqual({ view: "MIT", tab: "pipeline" });
});

test("matches a job by taskId, targets the queue tab", () => {
  const r = searchSnapshot(MOCK_MIT, "one-punch");
  const job = r.find((x) => x.kind === "job");
  expect(job?.label).toContain("one-punch");
  expect(job?.target).toEqual({ view: "MIT", tab: "queue" });
});

test("matches a worker by id / pid, targets the workers tab", () => {
  const r = searchSnapshot(MOCK_MIT, "5014");
  const w = r.find((x) => x.kind === "worker");
  expect(w?.label).toBe("w-5014");
  expect(w?.target).toEqual({ view: "MIT", tab: "workers" });
});

test("case-insensitive and capped by limit", () => {
  expect(searchSnapshot(MOCK_MIT, "TRANSLATE").length).toBeGreaterThan(0);
  expect(searchSnapshot(MOCK_MIT, "o", 2).length).toBeLessThanOrEqual(2);
});
