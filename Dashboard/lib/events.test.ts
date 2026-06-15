import { test, expect } from "bun:test";
import { filterEvents } from "./events";

const EVENTS = [
  { kind: "error", text: "Translate timeout", t: "16:10:14" },
  { kind: "processing", text: "translating", t: "16:08:44" },
  { kind: "success", text: "ocr 8 lines", t: "16:08:42" },
  { kind: "writing", text: "Gal Yome · ch1 p3", t: "16:08:41" },
  { kind: "success", text: "cache L1 hit", t: "16:08:40" },
];

test("'all' returns every event unchanged", () => {
  expect(filterEvents(EVENTS, "all")).toEqual(EVENTS);
});

test("'major' keeps only error/warning/job-milestone events", () => {
  const major = filterEvents(EVENTS, "major");
  expect(major.map((e) => e.kind)).toEqual(["error", "writing"]);
});

test("'major' preserves newest-first order", () => {
  const major = filterEvents(EVENTS, "major");
  expect(major[0].text).toBe("Translate timeout");
});

test("filtering an empty feed yields an empty feed", () => {
  expect(filterEvents([], "major")).toEqual([]);
});
