import { describe, expect, test } from "bun:test";
import { resolvedThumbnail, proxyImageUrl, toRelativeProxyUrl } from "./imgUrl";

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
