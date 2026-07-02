import { test, expect } from "bun:test";
import { parseSseFrames } from "./live";

test("extracts a single complete data frame", () => {
  const { messages, rest } = parseSseFrames('data: {"type":"metric","service":"mit"}\n\n');
  expect(messages).toEqual([{ type: "metric", service: "mit" }]);
  expect(rest).toBe("");
});

test("extracts two frames in one chunk", () => {
  const { messages } = parseSseFrames('data: {"n":1}\n\ndata: {"n":2}\n\n');
  expect(messages).toEqual([{ n: 1 }, { n: 2 }]);
});

test("holds an incomplete trailing frame in rest", () => {
  const { messages, rest } = parseSseFrames('data: {"n":1}\n\ndata: {"n":2');
  expect(messages).toEqual([{ n: 1 }]);
  expect(rest).toBe('data: {"n":2');
  // feeding the rest + the remainder completes it
  const next = parseSseFrames(rest + "}\n\n");
  expect(next.messages).toEqual([{ n: 2 }]);
});

test("skips a malformed json frame without throwing", () => {
  const { messages } = parseSseFrames("data: not-json\n\ndata: {\"ok\":true}\n\n");
  expect(messages).toEqual([{ ok: true }]);
});

test("ignores non-data lines (comments / heartbeats)", () => {
  const { messages } = parseSseFrames(": keep-alive\n\ndata: {\"n\":1}\n\n");
  expect(messages).toEqual([{ n: 1 }]);
});

test("preserves non-ascii payloads", () => {
  const { messages } = parseSseFrames('data: {"detail":"แปลเสร็จ"}\n\n');
  expect(messages).toEqual([{ detail: "แปลเสร็จ" }]);
});
