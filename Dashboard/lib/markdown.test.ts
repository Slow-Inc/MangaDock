import { test, expect } from "bun:test";
import { tokenizeInline } from "./markdown";

test("bold runs are extracted", () => {
  expect(tokenizeInline("**hi** there")).toEqual([
    { type: "bold", value: "hi" },
    { type: "text", value: " there" },
  ]);
});

test("inline code is extracted", () => {
  expect(tokenizeInline("run `npm i` now")).toEqual([
    { type: "text", value: "run " },
    { type: "code", value: "npm i" },
    { type: "text", value: " now" },
  ]);
});

test("plain text is one token", () => {
  expect(tokenizeInline("just text")).toEqual([{ type: "text", value: "just text" }]);
});

test("bold and code mix", () => {
  expect(tokenizeInline("**A** uses `x`")).toEqual([
    { type: "bold", value: "A" },
    { type: "text", value: " uses " },
    { type: "code", value: "x" },
  ]);
});

test("a log line with inline code keeps the bracketed timestamp intact", () => {
  expect(tokenizeInline("Log: `[16:10:14] ERROR translate: timeout`")).toEqual([
    { type: "text", value: "Log: " },
    { type: "code", value: "[16:10:14] ERROR translate: timeout" },
  ]);
});
