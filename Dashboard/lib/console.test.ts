import { test, expect } from "bun:test";
import { runCommand } from "./console";
import type { Service } from "./services";

const join = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text).join("\n");

const mit = {
  id: "mit",
  name: "MIT",
  status: "down",
  detail: "9arm model timeout",
  stats: [
    { label: "pipeline", value: "stuck · translate" },
    { label: "GPU", value: "RTX 4070 SUPER" },
  ],
  errors: 1,
  logs: [
    { t: "16:10:14", level: "error", src: "translate", msg: "9arm gateway timeout ×3" },
    { t: "16:08:42", level: "info", src: "ocr", msg: "8 lines + 1 SFX" },
  ],
} as unknown as Service;

const fe = {
  id: "frontend",
  name: "Frontend",
  status: "up",
  detail: "routes nominal",
  stats: [{ label: "p50", value: "12 ms" }],
  errors: 0,
  logs: [{ t: "16:08:39", level: "info", src: "router", msg: "/reader/123 served" }],
} as unknown as Service;

test("help lists the available commands", () => {
  const out = join(runCommand("help", mit));
  expect(out).toContain("status");
  expect(out).toContain("restart");
  expect(out).toContain("reload-models");
});

test("status reports the service name and current status", () => {
  const out = join(runCommand("status", mit));
  expect(out).toContain("MIT");
  expect(out).toContain("down");
});

test("an unknown command is reported, echoing the bad token", () => {
  const out = join(runCommand("foobar", mit));
  expect(out.toLowerCase()).toContain("command not found");
  expect(out).toContain("foobar");
});

test("clear empties the screen", () => {
  const r = runCommand("clear", mit);
  expect(r.clear).toBe(true);
  expect(r.lines).toHaveLength(0);
});

test("an empty line is a no-op (no output, no clear)", () => {
  expect(runCommand("", mit).lines).toHaveLength(0);
  expect(runCommand("   ", mit).clear).toBeFalsy();
});

test("commands are case-insensitive and trimmed", () => {
  expect(join(runCommand("  STATUS  ", mit))).toContain("MIT");
});

test("tail surfaces recent log lines", () => {
  const r = runCommand("tail", mit);
  expect(r.lines.length).toBeGreaterThan(0);
  expect(r.lines.length).toBeLessThanOrEqual(5);
  expect(join(r)).toContain("9arm gateway timeout");
});

test("reload-models is MIT-only", () => {
  expect(join(runCommand("reload-models", fe)).toLowerCase()).toContain("no gpu models");
  expect(join(runCommand("reload-models", mit))).toContain("5.8 GB");
});
