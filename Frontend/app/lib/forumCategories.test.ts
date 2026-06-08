/**
 * availableCategories — role-gated forum categories.
 *
 * ประกาศ (announcement) และ อัปเดตมังงะ (manga_update)
 * ใช้ได้เฉพาะ translator / creator / admin เท่านั้น
 */
import { expect, test } from "bun:test";
import { availableCategories, isRestrictedCategory } from "./forumCategories";

// ── privileged roles ────────────────────────────────────────────────────

test("translator gets all four categories", () => {
  expect(availableCategories("translator")).toEqual([
    "general", "announcement", "spoiler", "manga_update",
  ]);
});

test("admin gets all four categories", () => {
  expect(availableCategories("admin")).toEqual([
    "general", "announcement", "spoiler", "manga_update",
  ]);
});

test("creator gets all four categories", () => {
  expect(availableCategories("creator")).toEqual([
    "general", "announcement", "spoiler", "manga_update",
  ]);
});

// ── unprivileged ────────────────────────────────────────────────────────

test("regular user gets only general and spoiler", () => {
  expect(availableCategories("user")).toEqual(["general", "spoiler"]);
});

test("unauthenticated (null) gets only general and spoiler", () => {
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
