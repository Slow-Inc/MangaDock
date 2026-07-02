import { test, expect } from "bun:test";
import { pushSample, type SeriesMap } from "./live-series";

test("pushSample appends a metric's value into its own rolling buffer", () => {
  const s = pushSample({}, { gpuUtil: 65, vram: 5.8 });
  expect(s).toEqual({ gpuUtil: [65], vram: [5.8] });
});

test("successive samples grow each series in order", () => {
  let s: SeriesMap = {};
  s = pushSample(s, { gpuUtil: 65 });
  s = pushSample(s, { gpuUtil: 70 });
  s = pushSample(s, { gpuUtil: 62 });
  expect(s.gpuUtil).toEqual([65, 70, 62]);
});

test("a null/undefined value is skipped, not pushed (gap-tolerant)", () => {
  let s: SeriesMap = { gpuUtil: [65] };
  s = pushSample(s, { gpuUtil: null, vram: undefined });
  expect(s.gpuUtil).toEqual([65]);
  expect(s.vram).toBeUndefined();
});

test("each series is capped to the most recent N samples", () => {
  let s: SeriesMap = {};
  for (let i = 0; i < 50; i++) s = pushSample(s, { q: i }, 40);
  expect(s.q.length).toBe(40);
  expect(s.q[0]).toBe(10); // 0..9 evicted
  expect(s.q[39]).toBe(49);
});

test("does not mutate the input series", () => {
  const a: SeriesMap = { gpuUtil: [65] };
  const b = pushSample(a, { gpuUtil: 70 });
  expect(a.gpuUtil).toEqual([65]);
  expect(b.gpuUtil).toEqual([65, 70]);
});
