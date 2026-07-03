import { test, expect } from "bun:test";
import { appendCapped, type DebugEntry } from "./debug-log";

const e = (msg: string): DebugEntry => ({ t: 0, level: "info", source: "test", msg });

test("appends in order", () => {
  const out = appendCapped([e("a")], e("b"), 10);
  expect(out.map((x) => x.msg)).toEqual(["a", "b"]);
});

test("caps to the last N, dropping the oldest", () => {
  let list: DebugEntry[] = [];
  for (const m of ["a", "b", "c", "d"]) list = appendCapped(list, e(m), 3);
  expect(list.map((x) => x.msg)).toEqual(["b", "c", "d"]);
});

test("does not mutate the input list", () => {
  const input = [e("a")];
  appendCapped(input, e("b"), 10);
  expect(input.map((x) => x.msg)).toEqual(["a"]);
});

test("a cap of 1 keeps only the newest", () => {
  let list: DebugEntry[] = [];
  list = appendCapped(list, e("a"), 1);
  list = appendCapped(list, e("b"), 1);
  expect(list.map((x) => x.msg)).toEqual(["b"]);
});
