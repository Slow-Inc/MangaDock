/**
 * Tests for MIT stage → user-facing Thai label mapping (translation UX).
 * Stage ids come from MIT's _report_progress; unknown ids must degrade
 * gracefully (generic label) instead of breaking the indicator.
 */
import { expect, test } from "bun:test";

import { formatEta, stageLabel } from "./translationStages";

test("maps the patch-pipeline stages to ordered Thai labels", () => {
  expect(stageLabel("detection")).toEqual({ text: "ตรวจหาข้อความ", step: 1, total: 5 });
  expect(stageLabel("ocr")).toEqual({ text: "อ่านข้อความ", step: 2, total: 5 });
  expect(stageLabel("textline_merge")).toEqual({ text: "อ่านข้อความ", step: 2, total: 5 });
  expect(stageLabel("translating")).toEqual({ text: "แปลด้วย AI", step: 3, total: 5 });
  expect(stageLabel("mask-generation")).toEqual({ text: "ลบข้อความเดิม", step: 4, total: 5 });
  expect(stageLabel("inpainting")).toEqual({ text: "ลบข้อความเดิม", step: 4, total: 5 });
  expect(stageLabel("rendering")).toEqual({ text: "วาดข้อความแปล", step: 5, total: 5 });
});

test("started marks the page as queued at step 1", () => {
  expect(stageLabel("started")).toEqual({ text: "ตรวจหาข้อความ", step: 1, total: 5 });
});

test("formats ETA seconds into Thai-friendly text", () => {
  expect(formatEta(8)).toBe("~8 วิ");
  expect(formatEta(59)).toBe("~59 วิ");
  expect(formatEta(60)).toBe("~1 นาที");
  expect(formatEta(150)).toBe("~3 นาที"); // rounds up — never promise less time than likely
  expect(formatEta(0)).toBe("อีกครู่เดียว");
});

test("unknown or bookkeeping stages return null (UI falls back to generic text)", () => {
  expect(stageLabel("after-translating")).toBeNull();
  expect(stageLabel("running_pre_translation_hooks")).toBeNull();
  expect(stageLabel("definitely-not-a-stage")).toBeNull();
  expect(stageLabel(null)).toBeNull();
});
