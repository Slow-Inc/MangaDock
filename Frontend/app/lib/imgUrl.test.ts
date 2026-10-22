import { describe, expect, test } from "bun:test";
import { resolvedThumbnail, proxyImageUrl, toRelativeProxyUrl, thumbnailFallbackSrc, coverSources } from "./imgUrl";

const MANGADEX_URL =
  "https://uploads.mangadex.org/covers/abc123/cover.jpg";
const GOOGLE_URL =
  "https://books.google.com/books/content?id=xyz&printsec=frontcover";
const LOCAL_PATH = "/img-cache/abc123/thumbnail.jpg";

describe("resolvedThumbnail", () => {
  test("mangadex thumbnail → proxied via /api/img-proxy", () => {
    const book = { thumbnail: MANGADEX_URL };
    expect(resolvedThumbnail(book)).toBe(
      `/api/img-proxy?url=${encodeURIComponent(MANGADEX_URL)}`
    );
  });

  test("thumbnailLocal → returns /api/proxy local cache path", () => {
    const book = { thumbnail: MANGADEX_URL, thumbnailLocal: LOCAL_PATH };
    expect(resolvedThumbnail(book)).toBe(`/api/proxy${LOCAL_PATH}`);
  });

  test("non-mangadex external thumbnail → returned as-is", () => {
    const book = { thumbnail: GOOGLE_URL };
    expect(resolvedThumbnail(book)).toBe(GOOGLE_URL);
  });
});

describe("proxyImageUrl", () => {
  test("mangadex URL → wrapped in /api/img-proxy", () => {
    expect(proxyImageUrl(MANGADEX_URL)).toBe(
      `/api/img-proxy?url=${encodeURIComponent(MANGADEX_URL)}`
    );
  });

  test("non-mangadex URL → returned as-is", () => {
    expect(proxyImageUrl(GOOGLE_URL)).toBe(GOOGLE_URL);
  });
});

describe("toRelativeProxyUrl", () => {
  test("path starting with /img-cache → prefixed with /api/proxy", () => {
    expect(toRelativeProxyUrl(LOCAL_PATH)).toBe(`/api/proxy${LOCAL_PATH}`);
  });

  test("external non-local URL → returned as-is", () => {
    expect(toRelativeProxyUrl(GOOGLE_URL)).toBe(GOOGLE_URL);
  });
});

describe("thumbnailFallbackSrc", () => {
  test("thumbnailLocal present → proxied CDN URL (local cache failed, retry via proxy)", () => {
    const book = { thumbnail: MANGADEX_URL, thumbnailLocal: LOCAL_PATH };
    expect(thumbnailFallbackSrc(book)).toBe(
      `/api/img-proxy?url=${encodeURIComponent(MANGADEX_URL)}`
    );
  });

  test("no thumbnailLocal, MangaDex CDN URL → proxied URL (direct CDN blocked by UA check)", () => {
    expect(thumbnailFallbackSrc({ thumbnail: MANGADEX_URL })).toBe(
      `/api/img-proxy?url=${encodeURIComponent(MANGADEX_URL)}`
    );
  });

  test("no thumbnailLocal, non-MangaDex URL → raw URL (no proxy needed)", () => {
    expect(thumbnailFallbackSrc({ thumbnail: GOOGLE_URL })).toBe(GOOGLE_URL);
  });

  test("missing thumbnail → null", () => {
    expect(thumbnailFallbackSrc({ thumbnailLocal: LOCAL_PATH })).toBeNull();
  });

  test("empty thumbnail string → null", () => {
    expect(thumbnailFallbackSrc({ thumbnail: "" })).toBeNull();
  });
});

describe("coverSources: every cover a card may try, in order, before its placeholder (#921)", () => {
  test("local cache first, then the CDN through the proxy", () => {
    expect(coverSources({ thumbnail: MANGADEX_URL, thumbnailLocal: LOCAL_PATH })).toEqual([
      `/api/proxy${LOCAL_PATH}`,
      `/api/img-proxy?url=${encodeURIComponent(MANGADEX_URL)}`,
    ]);
  });

  test("the same URL is not tried twice (a MangaDex cover without a local copy has one source)", () => {
    expect(coverSources({ thumbnail: MANGADEX_URL })).toEqual([
      `/api/img-proxy?url=${encodeURIComponent(MANGADEX_URL)}`,
    ]);
  });

  test("an external cover is tried as-is", () => {
    expect(coverSources({ thumbnail: GOOGLE_URL })).toEqual([GOOGLE_URL]);
  });

  test("no cover at all → nothing to try (the card shows its placeholder, no third-party image)", () => {
    expect(coverSources({ thumbnail: "" })).toEqual([]);
  });
});
