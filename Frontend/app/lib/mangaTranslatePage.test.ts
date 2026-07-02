/**
 * Tests for the batch-translate SSE client (2026-06-06 incident).
 *
 * Runs with `bun test` — fetch is stubbed, no network. The incident: MIT's
 * worker died, every page event carried an `error`, and the client reported
 * them all as successfully translated pages.
 */
import { afterEach, expect, test } from "bun:test";

import {
  isCaptchaExpiredError,
  translateMangaChapterBatchPatches,
  translateMangaPagePatches,
} from "./mangaTranslatePage";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetchSse(events: object[]) {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  globalThis.fetch = (async () =>
    new Response(body, { status: 200 })) as typeof fetch;
}

async function collectPageEvents(events: object[]) {
  stubFetchSse(events);
  const received: Array<{ pageIndex: number; patches: unknown[]; error?: string }> = [];
  await translateMangaChapterBatchPatches(
    "chapter-1",
    [{ pageIndex: 0, pageUrl: "http://example.com/0.jpg" }],
    (pageIndex, patches, error) => received.push({ pageIndex, patches, error }),
  );
  return received;
}

test("page event carrying an error reaches the callback as an error, not a success", async () => {
  const received = await collectPageEvents([
    {
      pageIndex: 1,
      patches: [],
      error: "Translation service is starting up, please wait a moment and try again.",
    },
  ]);

  expect(received).toEqual([
    {
      pageIndex: 1,
      patches: [],
      error: "Translation service is starting up, please wait a moment and try again.",
    },
  ]);
});

test("successful page event delivers patches with backend URLs rewritten to the proxy", async () => {
  const received = await collectPageEvents([
    {
      pageIndex: 0,
      patches: [{ xPct: 0.1, yPct: 0.2, wPct: 0.05, hPct: 0.04, url: "/uploads/patches/p0.png" }],
    },
  ]);

  expect(received).toEqual([
    {
      pageIndex: 0,
      patches: [
        { xPct: 0.1, yPct: 0.2, wPct: 0.05, hPct: 0.04, url: "/api/proxy/uploads/patches/p0.png" },
      ],
      error: undefined,
    },
  ]);
});

test("progress events reach onPageProgress without touching onPageDone", async () => {
  stubFetchSse([
    { type: "progress", pageIndex: 0, stage: "translating" },
    { pageIndex: 0, patches: [] },
  ]);
  const progress: Array<{ pageIndex: number; stage: string }> = [];
  const done: number[] = [];
  await translateMangaChapterBatchPatches(
    "chapter-1",
    [{ pageIndex: 0, pageUrl: "http://example.com/0.jpg" }],
    (pageIndex) => done.push(pageIndex),
    undefined,
    undefined,
    (pageIndex, stage) => progress.push({ pageIndex, stage }),
  );

  expect(progress).toEqual([{ pageIndex: 0, stage: "translating" }]);
  expect(done).toEqual([0]); // progress event did NOT count as a completed page
});

test("non-OK batch response throws instead of resolving silently", async () => {
  globalThis.fetch = (async () =>
    new Response("MIT not ready", { status: 500 })) as typeof fetch;

  expect(
    translateMangaChapterBatchPatches(
      "chapter-1",
      [{ pageIndex: 0, pageUrl: "http://example.com/0.jpg" }],
      () => {},
    ),
  ).rejects.toThrow("Batch translate failed (500)");
});

// ─── Captcha-expiry detection (#227): a 401 must re-prompt the Turnstile ─────
// The translate endpoints are gated only by the captcha TurnstileGuard, so a
// 401 from them always means the HWID-bound clearance token expired — the UI
// must re-show the captcha instead of dead-ending on an error toast.

test("isCaptchaExpiredError is true for the single-page 401 throw", () => {
  const err = new Error(
    'Manga page patch translation failed (401): {"statusCode":401,"message":"Captcha clearance token is invalid, expired"}',
  );
  expect(isCaptchaExpiredError(err)).toBe(true);
});

test("isCaptchaExpiredError is true for the batch 401 throw", () => {
  expect(isCaptchaExpiredError(new Error("Batch translate failed (401): unauthorized"))).toBe(true);
});

test("isCaptchaExpiredError is false for a 500 (service error, not captcha)", () => {
  expect(isCaptchaExpiredError(new Error("Batch translate failed (500): MIT not ready"))).toBe(false);
});

test("isCaptchaExpiredError is false for a network error and for non-Error input", () => {
  expect(isCaptchaExpiredError(new Error("Failed to fetch"))).toBe(false);
  expect(isCaptchaExpiredError("some string")).toBe(false);
  expect(isCaptchaExpiredError(null)).toBe(false);
});

// ─── Series context (#157): mangaId rides the translate requests ─────────────

test("batch request body carries mangaId when provided", async () => {
  let sentBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    return new Response("", { status: 200 });
  }) as typeof fetch;

  await translateMangaChapterBatchPatches(
    "chapter-1",
    [{ pageIndex: 0, pageUrl: "http://example.com/0.jpg" }],
    () => {},
    undefined,
    { mangaId: "manga-123" },
  );

  expect(sentBody.mangaId).toBe("manga-123");
});

test("single-page request body carries mangaId when provided", async () => {
  let sentBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ patches: [] }), { status: 200 });
  }) as typeof fetch;

  await translateMangaPagePatches("chapter-1", 0, "http://example.com/0.jpg", undefined, {
    mangaId: "manga-123",
  });

  expect(sentBody.mangaId).toBe("manga-123");
});
