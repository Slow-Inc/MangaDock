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

import { allowsAdult, filterByLevel, ratingsFor } from "./contentLevel";

describe("levels mirror the server (#1105)", () => {
  test("ratingsFor: off is safe only; each level adds one rating", () => {
    expect(ratingsFor("off")).toEqual(["safe"]);
    expect(ratingsFor("suggestive")).toEqual(["safe", "suggestive"]);
    expect(ratingsFor("erotica")).toEqual(["safe", "suggestive", "erotica"]);
    expect(ratingsFor("all")).toEqual(["safe", "suggestive", "erotica", "pornographic"]);
  });
  test("allowsAdult: only erotica and all show the 18+ filter", () => {
    expect(["off", "suggestive", "erotica", "all"].map((l) => allowsAdult(l as never))).toEqual([false, false, true, true]);
  });
});

describe("filterByLevel: history hides titles the level does not allow (#1105)", () => {
  const items = [{ id: "s" }, { id: "g" }, { id: "e" }, { id: "studio" }];
  const ratings = { s: "safe", g: "suggestive", e: "erotica" };
  test("off keeps safe and unknown titles (our own Studio uploads are not on MangaDex)", () => {
    expect(filterByLevel(items, ratings, "off").map((b) => b.id)).toEqual(["s", "studio"]);
  });
  test("suggestive also keeps suggestive; erotica keeps everything here", () => {
    expect(filterByLevel(items, ratings, "suggestive").map((b) => b.id)).toEqual(["s", "g", "studio"]);
    expect(filterByLevel(items, ratings, "erotica").map((b) => b.id)).toEqual(["s", "g", "e", "studio"]);
  });
});
