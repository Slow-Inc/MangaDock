import { beforeEach, describe, expect, test } from "bun:test";
import { loadMangaDetail } from "./mangaDetail";
import { isNotFound } from "./httpError";

/** The book popup and the direct-link route that opens it both load the manga detail; the
 *  second caller must be a cache hit, and a bad response must never be cached. */

const good = (id: string) => ({ id, title: "T", authors: ["a"], artists: ["b"], covers: [], genres: [] });

let urls: string[];
let respond: (url: string) => Response;
const store = new Map<string, string>();
let n = 0;
const freshId = () => `manga-${++n}`; // apiCache is a module singleton: one id per test

beforeEach(() => {
  urls = [];
  store.clear();
  respond = (url) => new Response(JSON.stringify(good(url.split("/books/manga/")[1].split("?")[0])), { status: 200 });
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    fetch: async (url: string) => {
      urls.push(url);
      return respond(url);
    },
  });
});

describe("loadMangaDetail", () => {
  test("loads the detail, and a second call for the same manga is a cache hit", async () => {
    const id = freshId();
    const first = await loadMangaDetail(id);
    const second = await loadMangaDetail(id);

    expect(first.id).toBe(id);
    expect(second).toEqual(first);
    expect(urls).toEqual([`/api/proxy/books/manga/${id}`]);
  });

  test("a non-OK response rejects", async () => {
    respond = () => new Response("nope", { status: 502 });
    await expect(loadMangaDetail(freshId())).rejects.toThrow();
  });

  test("the rejection carries the status, so a direct /book link can tell 'not found' from 'failed' (#919)", async () => {
    respond = () => new Response("gone", { status: 404 });
    expect(isNotFound(await loadMangaDetail(freshId()).catch((e) => e))).toBe(true);
    respond = () => new Response("down", { status: 503 });
    expect(isNotFound(await loadMangaDetail(freshId()).catch((e) => e))).toBe(false);
  });

  test("a 200 with the wrong shape rejects and is not cached (it would crash every reopen for the whole TTL)", async () => {
    const id = freshId();
    respond = () => new Response(JSON.stringify({ id, title: "T" }), { status: 200 }); // no authors/artists
    await expect(loadMangaDetail(id)).rejects.toThrow();

    respond = (url) => new Response(JSON.stringify(good(id)), { status: 200 });
    await expect(loadMangaDetail(id)).resolves.toMatchObject({ id });
    expect(urls.length).toBe(2); // the bad response did not poison the cache
  });

  test("force-local mode asks for local covers and is cached apart from the normal detail", async () => {
    const id = freshId();
    store.set("imgCacheForceLocal", "1");
    await loadMangaDetail(id);
    expect(urls).toEqual([`/api/proxy/books/manga/${id}?forceLocal=true`]);

    store.delete("imgCacheForceLocal");
    await loadMangaDetail(id);
    expect(urls).toEqual([
      `/api/proxy/books/manga/${id}?forceLocal=true`,
      `/api/proxy/books/manga/${id}`,
    ]);
  });
});
