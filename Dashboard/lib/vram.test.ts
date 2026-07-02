import { test, expect } from "bun:test";
import { summarizeVram, type VramModel } from "./vram";

const MODELS: VramModel[] = [
  { id: "detect", label: "Detection", sublabel: "AnimeText YOLO", gb: 1.1, color: "var(--c-detect)" },
  { id: "ocr", label: "OCR", sublabel: "manga-ocr · VLM", gb: 2.4, color: "var(--c-ocr)" },
  { id: "inpaint", label: "Inpaint", sublabel: "LaMa", gb: 0.8, color: "var(--c-inpaint)" },
  { id: "runtime", label: "Runtime", sublabel: "CUDA context", gb: 1.5, color: "var(--idle)" },
];

test("used VRAM is the sum of model allocations; free is total minus used", () => {
  const s = summarizeVram(MODELS, 12.3);
  expect(s.usedGb).toBe(5.8);
  expect(s.freeGb).toBe(6.5);
  expect(s.totalGb).toBe(12.3);
});

test("each model row carries its share of total as a percentage", () => {
  const s = summarizeVram(MODELS, 12.3);
  const detect = s.rows.find((r) => r.id === "detect")!;
  expect(detect.pct).toBe(8.9);
});

test("used percentage reflects total occupancy", () => {
  const s = summarizeVram(MODELS, 12.3);
  expect(s.usedPct).toBe(47.2);
});

test("a remote model occupies no local VRAM and is flagged", () => {
  const withRemote: VramModel[] = [
    ...MODELS,
    { id: "translate", label: "Translate", sublabel: "9arm gateway", gb: 0, color: "var(--c-translate)", remote: true },
  ];
  const s = summarizeVram(withRemote, 12.3);
  const tr = s.rows.find((r) => r.id === "translate")!;
  expect(tr.remote).toBe(true);
  expect(tr.pct).toBe(0);
  expect(s.usedGb).toBe(5.8); // unchanged — remote adds nothing
});
