import { describe, expect, test } from "bun:test";
import { isAdultRating, isCatalogUrl, levelKey } from "./contentLevel";

describe("contentLevel helpers (#1102)", () => {
  test("levelKey: off keeps today's cache keys; 18+ levels get their own", () => {
    expect(levelKey("off")).toBe("");
    expect(levelKey("erotica")).toBe(":r=erotica");
    expect(levelKey("all")).toBe(":r=all");
  });

  test("isCatalogUrl: only the reads whose results depend on the level", () => {
    for (const u of [
      "/api/proxy/books/search?q=a",
      "/api/proxy/books/genre/romance?page=1",
      "/api/proxy/books/new-releases?page=1",
      "/api/proxy/books/manga/abc/chapters",
      "/api/proxy/books/manga/abc/chapters?forceLocal=true",
      "/api/proxy/books/manga/abc/preview",
    ]) expect(isCatalogUrl(u)).toBe(true);
    for (const u of [
      "/api/proxy/books/landing",
      "/api/proxy/books/manga/abc",
      "/api/proxy/books/chapters/c1/pages",
      "/api/proxy/users/me",
      "/api/img-proxy?url=https%3A%2F%2Fexample.com%2Fbooks%2Fsearch",
    ]) expect(isCatalogUrl(u)).toBe(false);
  });

  test("isAdultRating: erotica and pornographic are 18+", () => {
    expect(isAdultRating("erotica")).toBe(true);
    expect(isAdultRating("pornographic")).toBe(true);
    expect(isAdultRating("suggestive")).toBe(false);
    expect(isAdultRating(undefined)).toBe(false);
  });
});
