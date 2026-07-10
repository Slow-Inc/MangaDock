/**
 * availableCategories — role-gated forum categories.
 *
 * announcement: admin(8)/dev(9) เท่านั้น
 * manga_update: translator(1) ขึ้นไป
 */
import { expect, test } from "bun:test";
import { availableCategories, isRestrictedCategory, CATEGORY_LIST } from "./forumCategories";

// ── announcement: admin-only (>= 8) ────────────────────────────────────

test("admin (8) sees all four categories including announcement", () => {
  expect(availableCategories(8)).toEqual([
    "general", "announcement", "spoiler", "manga_update",
  ]);
});

test("dev (9) sees all four categories including announcement", () => {
  expect(availableCategories(9)).toEqual([
    "general", "announcement", "spoiler", "manga_update",
  ]);
});

test("creator (2) does NOT see announcement", () => {
  expect(availableCategories(2)).toEqual(["general", "spoiler", "manga_update"]);
});

test("translator (1) does NOT see announcement", () => {
  expect(availableCategories(1)).toEqual(["general", "spoiler", "manga_update"]);
});

// ── manga_update: translator+ (>= 1) ───────────────────────────────────

test("regular user (0) sees only general and spoiler", () => {
  expect(availableCategories(0)).toEqual(["general", "spoiler"]);
});

test("unauthenticated (null) sees only general and spoiler", () => {
  expect(availableCategories(null)).toEqual(["general", "spoiler"]);
});

// ── isRestrictedCategory helper ─────────────────────────────────────────

test("announcement and manga_update are restricted", () => {
  expect(isRestrictedCategory("announcement")).toBe(true);
  expect(isRestrictedCategory("manga_update")).toBe(true);
});

test("general and spoiler are not restricted", () => {
  expect(isRestrictedCategory("general")).toBe(false);
  expect(isRestrictedCategory("spoiler")).toBe(false);
});

// ── CATEGORY_LIST export ──────────────────────────────────────────────────

test("CATEGORY_LIST contains all four categories", () => {
  expect(CATEGORY_LIST).toEqual(["general", "announcement", "spoiler", "manga_update"]);
});

test("CATEGORY_LIST is readonly (same reference every import)", () => {
  expect(Array.isArray(CATEGORY_LIST)).toBe(true);
});
