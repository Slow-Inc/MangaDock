import { expect, test, describe } from "bun:test";
import { resolveReaderPages, buildOtherLangNextMap } from "./readerPages";
import type { ChapterPageItem } from "../hooks/useChapters";

describe("resolveReaderPages", () => {
  test("passes through already-proxied /api/ URLs unchanged", () => {
    expect(resolveReaderPages(["/api/img-proxy?url=x"], undefined, "http://be:3001")).toEqual(["/api/img-proxy?url=x"]);
  });

  test("prefers a local /img-cache path prefixed with the api base", () => {
    expect(resolveReaderPages(["https://cdn/x.jpg"], ["/img-cache/a.jpg"], "http://be:3001"))
      .toEqual(["http://be:3001/img-cache/a.jpg"]);
  });

  test("routes a remote URL through the img-proxy, encoded", () => {
    expect(resolveReaderPages(["https://cdn/x y.jpg"], undefined, "http://be:3001"))
      .toEqual(["/api/img-proxy?url=https%3A%2F%2Fcdn%2Fx%20y.jpg"]);
  });
});

describe("buildOtherLangNextMap", () => {
  const item = (id: string, lang: string, num: string | null): ChapterPageItem =>
    ({ id, translatedLanguage: lang, chapterNumber: num } as ChapterPageItem);

  test("returns one higher-numbered chapter per other language, excluding current lang", () => {
    const list = [
      item("c1", "en", "10"),  // current (idx 0)
      item("c2", "th", "11"),
      item("c3", "ja", "9"),   // lower → skipped
      item("c4", "th", "12"),  // dup lang → first (c2) wins
    ];
    const map = buildOtherLangNextMap(list, 0, "10", "en");
    expect(map.get("th")?.id).toBe("c2");
    expect(map.has("ja")).toBe(false);
    expect(map.has("en")).toBe(false);
  });

  test("returns an empty map when currentIdx < 0", () => {
    expect(buildOtherLangNextMap([], -1, null, "en").size).toBe(0);
  });
});
