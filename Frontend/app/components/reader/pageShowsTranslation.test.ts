import { describe, expect, test } from "bun:test";
import { pageShowsTranslation } from "./pageShowsTranslation";

const none = new Map<number, unknown>();
describe("pageShowsTranslation: only a page that is showing a translation can be rated (#826)", () => {
  test("an untranslated page shows no translation, even with the toggle on", () => {
    expect(pageShowsTranslation({ showTranslation: true, page: 0, translatedPages: none, patchedPages: none })).toBe(false);
  });
  test("a page with a translated image or patches shows one", () => {
    expect(pageShowsTranslation({ showTranslation: true, page: 2, translatedPages: new Map([[2, "x"]]), patchedPages: none })).toBe(true);
    expect(pageShowsTranslation({ showTranslation: true, page: 1, translatedPages: none, patchedPages: new Map([[1, []]]) })).toBe(true);
  });
  test("the original view (toggle off) shows none, and another page's translation does not count", () => {
    expect(pageShowsTranslation({ showTranslation: false, page: 2, translatedPages: new Map([[2, "x"]]), patchedPages: none })).toBe(false);
    expect(pageShowsTranslation({ showTranslation: true, page: 0, translatedPages: new Map([[2, "x"]]), patchedPages: none })).toBe(false);
  });
});
