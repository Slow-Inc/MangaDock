import { describe, expect, test } from "bun:test";
import { chapterAccess } from "./chapterAccess";
import type { MangaChapter } from "./types/manga";

const base = (over: Partial<MangaChapter> = {}): MangaChapter => ({
  id: "c1",
  chapterNumber: "1",
  title: null,
  translatedLanguage: "th",
  uploadedAt: "",
  pageCount: 5,
  source: "mangadex",
  ...over,
});

const ctx = (unlocked: string[] = []) => ({
  unlockedVersions: new Set(unlocked),
});

describe("chapterAccess — coinLocked", () => {
  test("mangadex chapter is never coin-locked", () => {
    expect(chapterAccess(base({ source: "mangadex" }), ctx()).coinLocked).toBe(false);
  });

  test("user chapter missing in backend is not coin-locked", () => {
    const ch = base({ source: "user", backendAvailable: false, priceCoins: 30, versionId: "v1" });
    expect(chapterAccess(ch, ctx()).coinLocked).toBe(false);
  });

  test("user chapter with no price is not coin-locked", () => {
    expect(chapterAccess(base({ source: "user", priceCoins: 0, versionId: "v1" }), ctx()).coinLocked).toBe(false);
    expect(chapterAccess(base({ source: "user", versionId: "v1" }), ctx()).coinLocked).toBe(false);
  });

  test("priced user chapter without a versionId is not coin-locked", () => {
    expect(chapterAccess(base({ source: "user", priceCoins: 30 }), ctx()).coinLocked).toBe(false);
  });

  test("priced user chapter not yet unlocked IS coin-locked", () => {
    const ch = base({ source: "user", priceCoins: 30, versionId: "v1" });
    expect(chapterAccess(ch, ctx([])).coinLocked).toBe(true);
  });

  test("priced user chapter already unlocked is not coin-locked", () => {
    const ch = base({ source: "user", priceCoins: 30, versionId: "v1" });
    expect(chapterAccess(ch, ctx(["v1"])).coinLocked).toBe(false);
  });
});

describe("chapterAccess — readable", () => {
  test("missing in backend is not readable", () => {
    const ch = base({ source: "user", backendAvailable: false });
    expect(chapterAccess(ch, ctx()).readable).toBe(false);
  });

  test("offline-fallback chapter is readable only when readerAvailable is true", () => {
    expect(chapterAccess(base({ isOfflineFallback: true, readerAvailable: true }), ctx()).readable).toBe(true);
    expect(chapterAccess(base({ isOfflineFallback: true, readerAvailable: false }), ctx()).readable).toBe(false);
    expect(chapterAccess(base({ isOfflineFallback: true }), ctx()).readable).toBe(false);
  });

  test("coin-locked chapter is not readable", () => {
    const ch = base({ source: "user", priceCoins: 30, versionId: "v1", pageCount: 10 });
    expect(chapterAccess(ch, ctx([])).readable).toBe(false);
    expect(chapterAccess(ch, ctx(["v1"])).readable).toBe(true); // unlocked → readable
  });

  test("normal chapter is readable when it has pages", () => {
    expect(chapterAccess(base({ pageCount: 5 }), ctx()).readable).toBe(true);
    expect(chapterAccess(base({ pageCount: 0 }), ctx()).readable).toBe(false);
  });
});

describe("chapterAccess — unavailableLabel", () => {
  test("missing in backend", () => {
    const ch = base({ source: "user", backendAvailable: false });
    expect(chapterAccess(ch, ctx()).unavailableLabel).toBe("ไม่มีใน backend");
  });

  test("offline fallback without a reader copy", () => {
    expect(chapterAccess(base({ isOfflineFallback: true, readerAvailable: false }), ctx()).unavailableLabel).toBe("ไม่ได้สำรอง");
    expect(chapterAccess(base({ isOfflineFallback: true }), ctx()).unavailableLabel).toBe("ไม่ได้สำรอง");
  });

  test("coin-locked shows the coin price", () => {
    const ch = base({ source: "user", priceCoins: 30, versionId: "v1" });
    expect(chapterAccess(ch, ctx([])).unavailableLabel).toBe("🪙 30");
  });

  test("falls back to the generic locked label", () => {
    expect(chapterAccess(base({ pageCount: 0 }), ctx()).unavailableLabel).toBe("ล็อค");
  });
});

describe("chapterAccess — combined", () => {
  test("a coin-locked chapter reports all three fields together", () => {
    const ch = base({ source: "user", priceCoins: 45, versionId: "v9", pageCount: 12 });
    expect(chapterAccess(ch, ctx([]))).toEqual({
      coinLocked: true,
      readable: false,
      unavailableLabel: "🪙 45",
    });
  });

  test("a plain readable chapter", () => {
    expect(chapterAccess(base({ pageCount: 3 }), ctx())).toEqual({
      coinLocked: false,
      readable: true,
      unavailableLabel: "ล็อค",
    });
  });
});
