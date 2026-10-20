import test from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../src/catalog.ts";
test("chapter choices retain original source and creator names for otherwise identical versions", async () => {
  const catalog = createCatalog({
    apiOrigin: "https://api.example.test",
    deviceId: "native-test",
    fetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.startsWith("/versions/"))
        return Response.json(
          ["Creator A", "Creator B"].map((translatorName, index) => ({
            versionId: `v-${index}`,
            chapterNumber: "1",
            chapterTitle: "One",
            language: "en",
            priceCoins: 0,
            status: "published",
            translatorName,
          })),
        );
      if (path.endsWith("/chapters"))
        return Response.json([
          {
            id: "original",
            chapterNumber: "1",
            title: "One",
            translatedLanguage: "en",
          },
        ]);
      return Response.json({
        id: "manga-1",
        authors: [],
        genres: [],
        covers: [],
      });
    },
  });
  await catalog.openBook("manga-1");
  assert.deepEqual(
    catalog
      .snapshot()
      .chapters.map((chapter) => [chapter.source, chapter.translatorName]),
    [
      ["mangadex", undefined],
      ["studio", "Creator A"],
      ["studio", "Creator B"],
    ],
  );
});

test("a reader searches existing Backend titles and sees the results in native catalog state", async () => {
  const book = {
    id: "manga-1",
    title: "เรื่องราว",
    thumbnail: "https://images.example.test/cover.jpg",
  };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.example.test");
    if (
      url.pathname === "/books/search" &&
      url.searchParams.get("q") === "เรื่องราว" &&
      new Headers(init?.headers).get("x-hardware-id") === "mdock_native_test"
    )
      return Response.json({ items: [book], total: 1 });
    return Response.json({ message: "Unknown request" }, { status: 404 });
  };
  const catalog = createCatalog({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
  });
  await catalog.search("เรื่องราว");
  assert.deepEqual(catalog.snapshot().results, [book]);
  assert.equal(catalog.snapshot().total, 1);
});

test("opening a title exposes its Backend details and chapters to native navigation", async () => {
  const book = {
    id: "manga-1",
    title: "เรื่องราว",
    authors: ["Author"],
    genres: ["Drama"],
    covers: [],
  };
  const chapter = {
    id: "chapter-1",
    chapterNumber: "1",
    title: "เริ่มต้น",
    translatedLanguage: "ja",
  };
  const fetch: typeof globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/books/manga/manga-1") return Response.json(book);
    if (path.startsWith("/versions/title/")) return Response.json([]);
    if (path === "/books/manga/manga-1/chapters")
      return Response.json([chapter]);
    return Response.json({ message: "Unknown request" }, { status: 404 });
  };
  const catalog = createCatalog({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
  });
  await catalog.openBook("manga-1");
  assert.deepEqual(catalog.snapshot().book, book);
  assert.deepEqual(catalog.snapshot().chapters, [
    { ...chapter, source: "mangadex" },
  ]);
});

test("an older search result cannot replace the readers latest query", async () => {
  let release!: (response: Response) => void;
  const oldResult = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fetch: typeof globalThis.fetch = async (input) =>
    new URL(String(input)).searchParams.get("q") === "old"
      ? oldResult
      : Response.json({
          items: [{ id: "latest", title: "Latest", thumbnail: "" }],
          total: 1,
        });
  const catalog = createCatalog({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
  });
  const oldSearch = catalog.search("old");
  await catalog.search("latest");
  release(
    Response.json({
      items: [{ id: "old", title: "Old", thumbnail: "" }],
      total: 1,
    }),
  );
  await oldSearch;
  assert.equal(catalog.snapshot().query, "latest");
  assert.equal(catalog.snapshot().results[0].id, "latest");
});

test("native navigation receives catalog changes and can return from details to results", async () => {
  const fetch: typeof globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/chapters")) return Response.json([]);
    if (path.startsWith("/versions/title/")) return Response.json([]);
    if (path.endsWith("/manga-1"))
      return Response.json({
        id: "manga-1",
        title: "Title",
        authors: [],
        genres: [],
        covers: [],
      });
    return Response.json({
      items: [{ id: "manga-1", title: "Title", thumbnail: "" }],
      total: 1,
    });
  };
  const catalog = createCatalog({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
  });
  const titles: Array<string | null> = [];
  const unsubscribe = catalog.subscribe(() =>
    titles.push(catalog.snapshot().book?.id ?? null),
  );
  await catalog.search("Title");
  await catalog.openBook("manga-1");
  catalog.closeBook();
  unsubscribe();
  assert.deepEqual(titles, [null, "manga-1", null]);
  assert.equal(catalog.snapshot().results[0].id, "manga-1");
});

test("native chapter selection includes published Studio versions in chapter order", async () => {
  const chapter = {
    id: "chapter-2",
    chapterNumber: "2",
    title: "Original",
    translatedLanguage: "ja",
  };
  const fetch: typeof globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.startsWith("/versions/title/"))
      return Response.json([
        {
          versionId: "version-1",
          chapterNumber: "1",
          chapterTitle: "ฉบับแปล",
          language: "th",
          priceCoins: 5,
          status: "published",
        },
        {
          versionId: "unavailable",
          chapterNumber: "3",
          status: "published",
          backendAvailable: false,
        },
        { versionId: "draft", chapterNumber: "4", status: "draft" },
      ]);
    if (path.endsWith("/chapters")) return Response.json([chapter]);
    return Response.json({
      id: "manga-1",
      title: "Title",
      authors: [],
      genres: [],
      covers: [],
    });
  };
  const catalog = createCatalog({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
  });
  await catalog.openBook("manga-1");
  assert.deepEqual(catalog.snapshot().chapters, [
    {
      id: "ver:version-1",
      chapterNumber: "1",
      title: "ฉบับแปล",
      translatedLanguage: "th",
      priceCoins: 5,
      source: "studio",
      translatorName: undefined,
    },
    { ...chapter, source: "mangadex" },
  ]);
});

test("search pagination makes titles beyond the first result page reachable", async () => {
  const requests: number[] = [];
  const catalog = createCatalog({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async (input) => {
      const offset = Number(new URL(String(input)).searchParams.get("offset"));
      requests.push(offset);
      return Response.json({
        items: Array.from({ length: offset ? 1 : 30 }, (_, index) => ({
          id: `manga-${offset + index}`,
          title: "Title",
          thumbnail: "",
        })),
        total: 31,
      });
    },
  });
  await catalog.search("Title");
  await catalog.loadMore();
  await catalog.loadMore();
  assert.equal(catalog.snapshot().results[30].id, "manga-30");
  assert.deepEqual(requests, [0, 30]);
});
