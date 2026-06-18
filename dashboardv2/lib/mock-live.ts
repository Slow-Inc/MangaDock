// Representative MIT snapshot for mock mode (lib/mock-mode). Same shape the real `/status` stream
// produces (lib/live-map MitLive) so every panel renders mock and real through one path. The scene
// mirrors the design prototype: GPU busy, translate stalled at the 9arm gateway, a VRAM leak on the
// render fonts, a small queue. Pure data — no Date/random (the hook stamps wall-clock at use).

import type { MitLive } from "./live-map";
import type { SeriesMap } from "./live-series";

export const MOCK_MIT: MitLive = {
  status: "degraded",
  ts: 0,
  gpu: { utilPct: 64, tempC: 67, powerW: 182, fanPct: 55, vramUsedGb: 5.8, vramTotalGb: 12.3 },
  host: { cpuPct: 42, ramUsedGb: 9.8, ramTotalGb: 32, diskUsedPct: 61 },
  gateway: { status: "down", detail: "qwen3.6-35b-a3b — model not responding (timeout ×3)", latencyMs: null, controlMs: 190 },
  queueSize: 3,
  workers: { alive: 1, total: 1, free: 0 },
  translator: "custom_openai",
  stages: [
    { id: "detect", label: "Detection", liveMs: 840 },
    { id: "ocr", label: "OCR", liveMs: 1290 },
    { id: "translate", label: "Translate", liveMs: 90000 },
    { id: "inpaint", label: "Inpaint", liveMs: 0 },
    { id: "render", label: "Render", liveMs: 0 },
  ],
  vram: {
    allocatedMb: 5940,
    reservedMb: 6300,
    models: [
      { model: "manga-ocr", footprintMb: 3174, freedMb: 3174, leaked: false },
      { model: "comic-text-detector", footprintMb: 410, freedMb: 410, leaked: false },
      { model: "render-fonts", footprintMb: 920, freedMb: null, leaked: true },
    ],
  },
  queueJobs: [
    { id: "j1", taskType: "translate", taskId: "one-punch-162", pageIndex: 9, state: "running", waitingMs: 90000 },
    { id: "j2", taskType: "render", taskId: "one-punch-162", pageIndex: 8, state: "queued", waitingMs: 12000 },
    { id: "j3", taskType: "ocr", taskId: "berserk-041", pageIndex: 2, state: "queued", waitingMs: 4000 },
  ],
  workersDetail: [{ ip: "127.0.0.1", port: 5014, pid: 24180, busy: true, uptimeS: 15120 }],
};

const wave = (base: number, amp: number, n = 30, phase = 0): number[] =>
  Array.from({ length: n }, (_, i) => Math.round((base + amp * Math.sin(i / 2.6 + phase)) * 10) / 10);

export const MOCK_SERIES: SeriesMap = {
  gpuUtil: wave(60, 12),
  vram: wave(5.6, 0.6, 30, 1),
  gpuTemp: wave(66, 4, 30, 0.5),
  power: wave(175, 25, 30, 1.5),
  cpu: wave(40, 14, 30, 2),
  ram: wave(9.5, 1.2, 30, 0.5),
  queue: wave(2.5, 1.5, 30, 1.5).map((v) => Math.max(0, Math.round(v))),
};

// Feed events, newest first; `agoS` = seconds ago (the hook converts to a wall-clock `at`).
export const MOCK_EVENTS: Array<{ kind: string; detail: string; agoS: number }> = [
  { kind: "error", detail: "translate timeout — 9arm gateway model not responding", agoS: 6 },
  { kind: "ocr", detail: "ocr · 8 lines + 1 SFX rescued (ぬ → SLURP)", agoS: 98 },
  { kind: "stage", detail: "detection · 8 regions · 0.84s", agoS: 99 },
  { kind: "translate_triggered", detail: "queued one-punch ch.162 p9", agoS: 140 },
  { kind: "info", detail: "worker pid 24180 · up 4h 12m", agoS: 320 },
];
