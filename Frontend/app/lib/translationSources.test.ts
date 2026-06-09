/**
 * Tests for translation source selection (#156).
 *
 * The Reader must translate the SAME image derivative it displays — patches
 * generated from a different encode of the page sit in a visibly different
 * screentone tone (the 2026-06-07 "background color changed around patches"
 * report). Runs with `bun test`.
 */
import { expect, test } from "bun:test";

import { buildTranslationSources } from "./translationSources";

const CDN = (n: number) => `https://uploads.mangadex.org/data/hash/${n}.jpg`;
const CDN_DS = (n: number) => `https://uploads.mangadex.org/data-saver/hash/${n}.jpg`;

test("HD mode without local cache translates the raw HD pages", () => {
  const data = { pages: [CDN(1), CDN(2)], dataSaverPages: [CDN_DS(1), CDN_DS(2)] };

  const { sources, derivative } = buildTranslationSources(data, false);

  expect(sources).toEqual([CDN(1), CDN(2)]);
  expect(derivative).toBe("hd");
});

test("HD mode prefers the locally-cached copy the Reader displays", () => {
  const data = {
    pages: [CDN(1), CDN(2)],
    // localPagePaths() returns a MIXED array: cached pages become /img-cache
    // paths, uncached ones fall back to the external URL.
    localPages: ["/img-cache/_chapters/chapters/ch1/p0.jpg", CDN(2)],
  };

  const { sources, derivative } = buildTranslationSources(data, false);

  expect(sources).toEqual(["/img-cache/_chapters/chapters/ch1/p0.jpg", CDN(2)]);
  expect(derivative).toBe("hd");
});

test("Data Saver mode translates the saver derivative the Reader displays", () => {
  const data = {
    pages: [CDN(1), CDN(2)],
    dataSaverPages: [CDN_DS(1), CDN_DS(2)],
    localPages: ["/img-cache/_chapters/chapters/ch1/p0.jpg", CDN(2)],
    localDataSaverPages: ["/img-cache/_chapters/chapters/ch1/ds0.jpg", CDN_DS(2)],
  };

  const { sources, derivative } = buildTranslationSources(data, true);

  expect(sources).toEqual(["/img-cache/_chapters/chapters/ch1/ds0.jpg", CDN_DS(2)]);
  expect(derivative).toBe("saver");
});

test("missing data yields no sources", () => {
  expect(buildTranslationSources(null, false)).toEqual({ sources: [], derivative: "hd" });
  expect(buildTranslationSources({}, true)).toEqual({ sources: [], derivative: "saver" });
});
