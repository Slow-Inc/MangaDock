import { test, expect } from "bun:test";
import { filterLogs, type LogEntry } from "./log";

const LOGS: LogEntry[] = [
  { t: "16:10:14", level: "error", src: "translate", msg: "9arm timeout ×3" },
  { t: "16:10:10", level: "warn", src: "translate", msg: "retry 3/3" },
  { t: "16:08:42", level: "info", src: "ocr", msg: "8 lines" },
  { t: "16:08:40", level: "debug", src: "http", msg: "GET /models 200" },
];

test("'debug' shows every level", () => {
  expect(filterLogs(LOGS, "debug")).toHaveLength(4);
});

test("'warn' keeps only warn and error", () => {
  expect(filterLogs(LOGS, "warn").map((l) => l.level)).toEqual(["error", "warn"]);
});

test("'error' keeps only error", () => {
  expect(filterLogs(LOGS, "error").map((l) => l.level)).toEqual(["error"]);
});

test("filtering preserves order", () => {
  expect(filterLogs(LOGS, "info")[0].msg).toBe("9arm timeout ×3");
});

test("filtering an empty log set yields empty", () => {
  expect(filterLogs([], "warn")).toEqual([]);
});
