/**
 * Translate menu model (#162).
 *
 * One decision drives both the desktop dropdown and the mobile sheet: which
 * translate-related items the menu shows. A fully-translated chapter must
 * offer a single view toggle instead of translate buttons that silently
 * do nothing.
 */
import { expect, test } from "bun:test";

import { buildTranslateMenu } from "./translateMenu";

test("fully translated + viewing translation → no translate buttons, toggle reads ดูต้นฉบับ", () => {
  const menu = buildTranslateMenu({
    totalPages: 4,
    completedCount: 4,
    hasAnyTranslation: true,
    showTranslation: true,
  });
  expect(menu.showTranslateButtons).toBe(false);
  expect(menu.viewToggleLabel).toBe("ดูต้นฉบับ");
});

test("fully translated + viewing original → toggle reads ดูฉบับแปล (the one-tap way back)", () => {
  const menu = buildTranslateMenu({
    totalPages: 4,
    completedCount: 4,
    hasAnyTranslation: true,
    showTranslation: false,
  });
  expect(menu.showTranslateButtons).toBe(false);
  expect(menu.viewToggleLabel).toBe("ดูฉบับแปล");
});

test("partially translated + viewing translation → translate buttons plus ดูต้นฉบับ", () => {
  const menu = buildTranslateMenu({
    totalPages: 4,
    completedCount: 2,
    hasAnyTranslation: true,
    showTranslation: true,
  });
  expect(menu.showTranslateButtons).toBe(true);
  expect(menu.viewToggleLabel).toBe("ดูต้นฉบับ");
});

test("partially translated + viewing original → no toggle; the translate buttons are the way back", () => {
  const menu = buildTranslateMenu({
    totalPages: 4,
    completedCount: 2,
    hasAnyTranslation: true,
    showTranslation: false,
  });
  expect(menu.showTranslateButtons).toBe(true);
  expect(menu.viewToggleLabel).toBeNull();
});

test("nothing translated yet → translate buttons only, even before pages load", () => {
  expect(
    buildTranslateMenu({ totalPages: 4, completedCount: 0, hasAnyTranslation: false, showTranslation: true }),
  ).toEqual({ showTranslateButtons: true, viewToggleLabel: null });
  // totalPages 0 (chapter still loading) must never count as "fully translated"
  expect(
    buildTranslateMenu({ totalPages: 0, completedCount: 0, hasAnyTranslation: false, showTranslation: true }),
  ).toEqual({ showTranslateButtons: true, viewToggleLabel: null });
});
