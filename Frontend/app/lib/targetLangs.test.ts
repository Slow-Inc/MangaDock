/**
 * Translate target languages (#163).
 *
 * The Reader offers five targets — TH, EN, ZH, JA, KO — and must never keep
 * the target equal to the chapter's source language (a JA chapter must not
 * sit on → JA as a dead choice).
 */
import { expect, test } from "bun:test";

import { TARGET_LANG_OPTIONS, fallbackTarget } from "./targetLangs";

test("offers TH, EN, ZH, JA, KO as translate targets", () => {
  expect(TARGET_LANG_OPTIONS.map((l) => l.code)).toEqual(["th", "en", "zh", "ja", "ko"]);
  expect(TARGET_LANG_OPTIONS.map((l) => l.label)).toEqual(["→ TH", "→ EN", "→ ZH", "→ JA", "→ KO"]);
});

test("reading a JA chapter never keeps → JA active — falls back to the first non-source option", () => {
  expect(fallbackTarget("ja", "ja")).toBe("th");
  expect(fallbackTarget("JA", "ja")).toBe("th"); // chapter metadata may be uppercase
  expect(fallbackTarget("ko", "ko")).toBe("th");
  expect(fallbackTarget("th", "th")).toBe("en"); // th source skips th itself
});

test("a target that already differs from the source is left alone", () => {
  expect(fallbackTarget("ja", "th")).toBeUndefined();
  expect(fallbackTarget("en", "ko")).toBeUndefined();
  expect(fallbackTarget(null, "th")).toBeUndefined(); // source unknown → no opinion
});
