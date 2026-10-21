import test from "node:test";
import assert from "node:assert/strict";
import { createDiscovery } from "../src/discovery.ts";

const book = {
  id: "manga-1",
  title: "เรื่องราว",
  thumbnail: "/img-cache/cover.jpg",
  categories: ["Drama"],
};
const landing = {
  hero: book,
  rows: [{ id: "popular", title: "มังงะยอดนิยม", query: "", items: [book] }],
  updatedAt: "2026-10-03T00:00:00Z",
  fromStaleCache: true,
  staleUpdatedAt: "2026-10-02T00:00:00Z",
};
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "native-discovery-test",
};
test("Home exposes the existing server landing rows and stale-data status to native readers", async () => {
  const discovery = createDiscovery({
    ...options,
    fetch: async (input, init) => {
      assert.equal(String(input), "https://api.example.test/books/landing");
      assert.equal(
        new Headers(init?.headers).get("x-hardware-id"),
        options.deviceId,
      );
      return Response.json(landing);
    },
  });
  let displayed = null;
  const unsubscribe = discovery.subscribe(() => {
    displayed = discovery.snapshot().landing;
  });
  await discovery.home();
  assert.deepEqual(displayed, landing);
  unsubscribe();
});

test("new releases use the existing paginated tag filter and expose only the selected server section", async () => {
  const discovery = createDiscovery({
    ...options,
    fetch: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/books/new-releases");
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(url.searchParams.get("limit"), "28");
      assert.equal(url.searchParams.get("tag"), "Drama");
      return Response.json({
        new: { items: [], total: 0 },
        latest: { items: [], total: 0 },
        popular: { items: [book], total: 57 },
        "top-rated": { items: [], total: 0 },
      });
    },
  });
  await discovery.browse({
    kind: "new",
    tab: "popular",
    tag: "Drama",
    page: 2,
  });
  assert.deepEqual(discovery.snapshot().items, [book]);
  assert.equal(discovery.snapshot().total, 57);
  assert.deepEqual(discovery.snapshot().selection, {
    kind: "new",
    tab: "popular",
    tag: "Drama",
    page: 2,
  });
});

test("a genre uses its existing slug endpoint and page number instead of the release feed", async () => {
  const discovery = createDiscovery({
    ...options,
    fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname !== "/books/genre/sci-fi")
        return Response.json({}, { status: 404 });
      assert.equal(url.searchParams.get("page"), "3");
      assert.equal(url.searchParams.get("limit"), "28");
      return Response.json({ items: [book], total: 80 });
    },
  });
  await discovery.browse({ kind: "genre", slug: "sci-fi", page: 3 });
  assert.deepEqual(discovery.snapshot().items, [book]);
  assert.equal(discovery.snapshot().total, 80);
});

test("changing a genre ignores a delayed response from the previous selection", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const discovery = createDiscovery({
    ...options,
    fetch: async (input) =>
      String(input).includes("/action?")
        ? delayed
        : Response.json({ items: [{ ...book, id: "comedy" }], total: 1 }),
  });
  const previous = discovery.browse({ kind: "genre", slug: "action" });
  await discovery.browse({ kind: "genre", slug: "comedy" });
  release(Response.json({ items: [book], total: 1 }));
  await previous;
  assert.equal(discovery.snapshot().items[0].id, "comedy");
  const selection = discovery.snapshot().selection;
  assert.equal(selection?.kind === "genre" && selection.slug, "comedy");
});

test("a failed filter shows an error for the selected filter instead of displaying the previous genres titles", async () => {
  const discovery = createDiscovery({
    ...options,
    fetch: async (input) =>
      String(input).includes("/comedy?")
        ? Response.json({}, { status: 503 })
        : Response.json({ items: [book], total: 1 }),
  });
  await discovery.browse({ kind: "genre", slug: "action" });
  await discovery.browse({ kind: "genre", slug: "comedy" }).catch(() => {});
  const selection = discovery.snapshot().selection;
  assert.equal(selection?.kind === "genre" && selection.slug, "comedy");
  assert.deepEqual(discovery.snapshot().items, []);
  assert.ok(discovery.snapshot().error);
  assert.equal(discovery.snapshot().loading, false);
});

test("related titles use the existing server recommendations for the selected manga", async () => {
  const discovery = createDiscovery({
    ...options,
    fetch: async (input) => {
      assert.equal(
        String(input),
        "https://api.example.test/books/manga-1/related?limit=10",
      );
      return Response.json([{ ...book, id: "related-1" }]);
    },
  });
  await discovery.related("manga-1");
  assert.equal(discovery.snapshot().related.mangaId, "manga-1");
  assert.equal(discovery.snapshot().related.items[0]?.id, "related-1");
});

test("a slow related response cannot show recommendations for a manga the reader already left", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const discovery = createDiscovery({
    ...options,
    fetch: async (input) =>
      String(input).includes("/first/")
        ? delayed
        : Response.json([{ ...book, id: "latest-related" }]),
  });
  const previous = discovery.related("first");
  await discovery.related("second");
  release(Response.json([book]));
  await previous;
  assert.equal(discovery.snapshot().related.mangaId, "second");
  assert.equal(discovery.snapshot().related.items[0].id, "latest-related");
});

test("a failed related request is a retryable error rather than a successful empty recommendation", async () => {
  let offline = true;
  const discovery = createDiscovery({
    ...options,
    fetch: async () => {
      if (offline) throw new TypeError("Network request failed");
      return Response.json([]);
    },
  });
  await discovery.related("manga-1").catch(() => {});
  assert.equal(discovery.snapshot().related.loading, false);
  assert.ok(discovery.snapshot().related.error);
  offline = false;
  await discovery.related("manga-1");
  assert.equal(discovery.snapshot().related.error, null);
  assert.deepEqual(discovery.snapshot().related.items, []);
});

test("Home keeps previously fetched server rows with a visible connection error and can retry", async () => {
  let offline = false;
  const discovery = createDiscovery({
    ...options,
    fetch: async () => {
      if (offline) throw new TypeError("Network request failed");
      return Response.json(landing);
    },
  });
  await discovery.home();
  offline = true;
  await discovery.home().catch(() => {});
  assert.deepEqual(discovery.snapshot().landing, landing);
  assert.ok(discovery.snapshot().homeError);
  assert.equal(discovery.snapshot().homeLoading, false);
  offline = false;
  await discovery.home();
  assert.equal(discovery.snapshot().homeError, null);
});

test("retrying Home cannot be overwritten by an older response that finishes later", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let attempt = 0;
  const latest = { ...landing, updatedAt: "2026-10-03T01:00:00Z" };
  const discovery = createDiscovery({
    ...options,
    fetch: async () => (++attempt === 1 ? delayed : Response.json(latest)),
  });
  const previous = discovery.home();
  await discovery.home();
  release(Response.json(landing));
  await previous;
  assert.equal(discovery.snapshot().landing?.updatedAt, latest.updatedAt);
});

test("leaving discovery cancels requests without publishing late data and allows a fresh remount", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let signal: AbortSignal | null | undefined;
  let attempt = 0;
  const discovery = createDiscovery({
    ...options,
    fetch: async (_input, init) => {
      signal = init?.signal;
      return ++attempt === 1 ? delayed : Response.json(landing);
    },
  });
  const previous = discovery.home();
  discovery.cancel();
  assert.equal(signal?.aborted, true);
  release(Response.json(landing));
  await previous;
  assert.equal(discovery.snapshot().landing, null);
  assert.equal(discovery.snapshot().homeLoading, false);
  await discovery.home();
  assert.deepEqual(discovery.snapshot().landing, landing);
});
