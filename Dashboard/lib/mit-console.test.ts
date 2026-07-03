import { test, expect } from "bun:test";
import { runMitCommand } from "./mit-console";
import type { MitLive } from "./live-map";

function mit(over: Partial<MitLive> = {}): MitLive {
  return {
    status: "up", ts: 1,
    gpu: { utilPct: 64, tempC: 67, powerW: 120, fanPct: 40, vramUsedGb: 5.8, vramTotalGb: 12.0 },
    host: { cpuPct: 42, ramUsedGb: 9.6, ramTotalGb: 31.3, diskUsedPct: 99 },
    gateway: { status: "ok", detail: "healthy", latencyMs: 120, controlMs: 30 },
    queueSize: 0, workers: { alive: 1, total: 1, free: 1 }, translator: "custom_openai",
    ...over,
  };
}
const txt = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text).join("\n");

test("help lists the read-only commands (no connection needed)", () => {
  expect(txt(runMitCommand("help", null))).toMatch(/status/);
});

test("clear returns the clear flag", () => {
  expect(runMitCommand("clear", mit()).clear).toBe(true);
});

test("a data command without a connection reports offline", () => {
  const r = runMitCommand("status", null);
  expect(r.lines[0].tone).toBe("err");
  expect(r.lines[0].text).toMatch(/not connected/i);
});

test("status shows real overall + gpu + translator", () => {
  const t = txt(runMitCommand("status", mit()));
  expect(t).toMatch(/up/);
  expect(t).toMatch(/64%/);
  expect(t).toMatch(/custom_openai/);
});

test("vram lists per-model footprints and flags a leak in red", () => {
  const r = runMitCommand("vram", mit({ vram: { allocatedMb: 5000, reservedMb: 6000, models: [
    { model: "ocr", footprintMb: 2400, freedMb: 2390, leaked: false },
    { model: "detect", footprintMb: 1100, freedMb: 0, leaked: true },
  ] } }));
  const leak = r.lines.find((l) => /detect/.test(l.text))!;
  expect(leak.text).toMatch(/LEAK/);
  expect(leak.tone).toBe("err");
});

test("vram with no telemetry yet hints to translate", () => {
  expect(txt(runMitCommand("vram", mit({ vram: null })))).toMatch(/translate a page|no .*vram/i);
});

test("gateway shows the control vs data split (real ms)", () => {
  const t = txt(runMitCommand("gateway", mit()));
  expect(t).toMatch(/30/);
  expect(t).toMatch(/120/);
});

test("workers lists real pid + uptime", () => {
  expect(txt(runMitCommand("workers", mit({ workersDetail: [{ ip: "127.0.0.1", port: 5014, pid: 12345, busy: false, uptimeS: 3720 }] })))).toMatch(/12345/);
});

test("logs renders recent events with their kind", () => {
  const ev = [{ kind: "stage", detail: "Translate 3200ms", at: 1700000000000 }];
  expect(txt(runMitCommand("logs", mit(), ev))).toMatch(/Translate 3200ms/);
});

test("an arbitrary/unknown command is rejected (no shell)", () => {
  expect(runMitCommand("rm -rf /", mit()).lines[0].tone).toBe("err");
});
