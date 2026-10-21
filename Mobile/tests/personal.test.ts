import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createPersonal } from "../src/personal.ts";
import { createCatalog } from "../src/catalog.ts";
import { createReader } from "../src/reader.ts";
import { resumeHistoryReading } from "../src/recovery.ts";

const history = {
  id: "manga-1",
  title: "เรื่องราว",
  thumbnail: "/img-cache/cover.jpg",
  lastReadAt: 100,
  lastChapterId: "chapter-1",
  lastPage: 7,
};
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};

test("saving and removing a favorite uses the existing account collection and changes the visible library after acknowledgement", async () => {
  const requests: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push(`${init?.method ?? "GET"} ${path}`);
      assert.ok(
        new Headers(init?.headers).get("authorization")?.startsWith("Bearer "),
      );
      if (!init?.method) return Response.json([]);
      if (init.method === "POST")
        assert.equal(JSON.parse(String(init.body)).id, history.id);
      return new Response(null, { status: 204 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await personal.load("favorites");
  assert.equal(await personal.setCollection("favorites", history, true), true);
  assert.equal(personal.snapshot().items[0]?.id, history.id);
  await personal.setCollection("favorites", history, false);
  assert.deepEqual(personal.snapshot().items, []);
  assert.deepEqual(requests, [
    "GET /users/me/favorites",
    "POST /users/me/favorites",
    "DELETE /users/me/favorites/manga-1",
  ]);
});

test("manga detail loads its existing favorite/follow/like membership without replacing the selected library tab", async () => {
  const auth = fixture({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/favorites")) return Response.json([history]);
      if (path.endsWith("/follows")) return Response.json([]);
      if (path.endsWith("/liked")) return Response.json([history.id]);
      throw new Error("Unexpected membership request");
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await personal.loadMembership(history.id);
  assert.equal(personal.snapshot().tab, "favorites");
  assert.deepEqual(personal.snapshot().membership, {
    id: history.id,
    favorites: true,
    follows: false,
    liked: true,
    loading: false,
    error: null,
  });
});

test("a delayed favorite read cannot hide a favorite added after that read started", async () => {
  let release!: (response: Response) => void;
  const auth = fixture({
    externalFetch: async (_input, init) =>
      init?.method === "POST"
        ? new Response(null, { status: 204 })
        : new Promise<Response>((resolve) => {
            release = resolve;
          }),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const loading = personal.load("favorites");
  await new Promise((resolve) => setImmediate(resolve));
  await personal.setCollection("favorites", history, true);
  release(Response.json([]));
  await loading;
  assert.equal(personal.snapshot().items[0]?.id, history.id);
});

test("clearing history waits for an in-flight page save so that the save cannot recreate cleared server history", async () => {
  let release!: () => void;
  const methods: string[] = [];
  const auth = fixture({
    externalFetch: async (_input, init) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "POST")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return new Response(null, { status: 204 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const save = personal.recordProgress(history);
  await new Promise((resolve) => setImmediate(resolve));
  const clearing = personal.removeHistory();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(methods, ["POST"]);
  release();
  await Promise.all([save, clearing]);
  assert.deepEqual(methods, ["POST", "DELETE"]);
  assert.deepEqual(personal.snapshot().history, []);
});

for (const id of [undefined, history.id])
  test(`an old history response cannot restore records after ${id ? "removing a title" : "clearing history"}`, async () => {
    let release!: (response: Response) => void;
    const auth = fixture({
      externalFetch: async (_input, init) =>
        init?.method === "DELETE"
          ? new Response(null, { status: 204 })
          : new Promise<Response>((resolve) => {
              release = resolve;
            }),
    });
    await auth.app.signIn("reader@example.test", "correct-test-password");
    const personal = createPersonal({
      ...options,
      fetch: auth.fetch,
      session: auth.app,
    });
    const loading = personal.load("history");
    await new Promise((resolve) => setImmediate(resolve));
    await personal.removeHistory(id);
    release(Response.json([history]));
    await loading;
    assert.deepEqual(personal.snapshot().history, []);
  });

test("history export returns the existing server CSV with authentication rather than reconstructing incomplete local records", async () => {
  const csv = 'title,last_page\n"เรื่องราว",7\n';
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/users/me/history/export");
      assert.ok(
        new Headers(init?.headers).get("authorization")?.startsWith("Bearer "),
      );
      return new Response(csv, { headers: { "content-type": "text/csv" } });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  assert.equal(await personal.exportHistory(), csv);
});

test("a history CSV arriving after sign-out is discarded before native export can share it", async () => {
  let release!: (response: Response) => void;
  const auth = fixture({
    externalFetch: () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const exporting = personal.exportHistory();
  await new Promise((resolve) => setImmediate(resolve));
  await auth.app.signOut();
  release(new Response("private-history"));
  assert.equal(await exporting, null);
});
test("a signed-in reader sees existing account history and its Chapter/Page through the real auth adapter", async () => {
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/users/me/history");
      assert.ok(
        new Headers(init?.headers).get("authorization")?.startsWith("Bearer "),
      );
      return Response.json([history]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await personal.load("history");
  assert.deepEqual(personal.snapshot().items, [history]);
  assert.deepEqual(personal.snapshot().history, [history]);
  assert.equal(personal.snapshot().loginRequired, false);
});

test("sign-out clears private library immediately and a delayed history response cannot restore it or issue a delete", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      requests.push(init?.method ?? "GET");
      return delayed;
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const loading = personal.load("history");
  await new Promise((resolve) => setImmediate(resolve));
  await auth.app.signOut();
  release(Response.json([history]));
  await loading;
  assert.deepEqual(personal.snapshot().items, []);
  assert.deepEqual(personal.snapshot().history, []);
  assert.equal(personal.snapshot().loginRequired, true);
  assert.deepEqual(requests, ["GET"]);
});

test("the liked library resolves the existing server ID list into native manga cards", async () => {
  const auth = fixture({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/users/me/liked") return Response.json(["manga-1"]);
      if (path === "/books/manga/manga-1")
        return Response.json({
          id: "manga-1",
          title: history.title,
          covers: [{ url: history.thumbnail }],
          authors: [],
          genres: ["Drama"],
        });
      return Response.json({}, { status: 404 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await personal.load("liked");
  assert.equal(personal.snapshot().items[0]?.id, "manga-1");
  assert.equal(personal.snapshot().items[0]?.thumbnail, history.thumbnail);
});

test("guests receive a native login prompt for private library without accessing or throwing from auth APIs", async () => {
  const auth = fixture({
    externalFetch: async () => {
      throw new Error("Private request from guest");
    },
  });
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await personal.load("favorites");
  assert.equal(personal.snapshot().loginRequired, true);
  assert.deepEqual(personal.snapshot().items, []);
});

test("continue-reading publishes the saved Chapter/Page on its first ready state through current catalog and Reader access", async () => {
  const item = { ...history, lastChapterId: "ver:version-1" };
  const fetch: typeof globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/versions/title/manga-1")
      return Response.json([
        {
          versionId: "version-1",
          status: "published",
          chapterNumber: "1",
          chapterTitle: "ตอนแรก",
          language: "th",
          priceCoins: 0,
        },
      ]);
    if (path.endsWith("/chapters")) return Response.json([]);
    if (path === "/versions/version-1")
      return Response.json({
        priceCoins: 0,
        pages: Array.from(
          { length: 8 },
          (_, index) => `/uploads/page-${index}.jpg`,
        ),
      });
    return Response.json({
      id: item.id,
      title: item.title,
      authors: [],
      genres: [],
      covers: [],
    });
  };
  const catalog = createCatalog({ ...options, fetch });
  const reader = createReader({ ...options, fetch });
  const visiblePages: Array<number | undefined> = [];
  reader.subscribe(() => {
    if (reader.snapshot().status === "ready")
      visiblePages.push(reader.snapshot().position?.pageIndex);
  });
  assert.equal(
    await resumeHistoryReading({
      item,
      catalog,
      reader,
      isCurrent: () => true,
    }),
    true,
  );
  assert.equal(reader.snapshot().chapter?.id, "ver:version-1");
  assert.equal(visiblePages[0], 6);
});

test("reading progress is saved to the existing authenticated history endpoint and updates Continue Reading only after success", async () => {
  const writes: unknown[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/users/me/history");
      assert.equal(init?.method, "POST");
      assert.ok(
        new Headers(init?.headers).get("authorization")?.startsWith("Bearer "),
      );
      writes.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  assert.equal(await personal.recordProgress(history), true);
  assert.deepEqual(writes, [history]);
  assert.deepEqual(personal.snapshot().history, [history]);
});

test("a delayed progress acknowledgement after sign-out cannot reintroduce private Continue Reading data", async () => {
  let release!: (response: Response) => void;
  const auth = fixture({
    externalFetch: () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const saving = personal.recordProgress(history);
  await new Promise((resolve) => setImmediate(resolve));
  await auth.app.signOut();
  release(new Response(null, { status: 201 }));
  assert.equal(await saving, false);
  assert.deepEqual(personal.snapshot().history, []);
});

test("successive page saves cannot arrive out of order and move shared history backwards", async () => {
  let release!: () => void;
  const pages: number[] = [];
  const auth = fixture({
    externalFetch: async (_input, init) => {
      const page = JSON.parse(String(init?.body)).lastPage;
      pages.push(page);
      if (page === 7)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return new Response(null, { status: 201 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const first = personal.recordProgress(history);
  await new Promise((resolve) => setImmediate(resolve));
  const next = personal.recordProgress({ ...history, lastPage: 8 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(pages, [7]);
  release();
  await Promise.all([first, next]);
  assert.deepEqual(pages, [7, 8]);
  assert.equal(personal.snapshot().history[0]?.lastPage, 8);
});

test("an older history read cannot replace newly acknowledged reading progress", async () => {
  let release!: (response: Response) => void;
  const auth = fixture({
    externalFetch: async (_input, init) =>
      init?.method === "POST"
        ? new Response(null, { status: 201 })
        : new Promise<Response>((resolve) => {
            release = resolve;
          }),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const loading = personal.load("history");
  await new Promise((resolve) => setImmediate(resolve));
  await personal.recordProgress({ ...history, lastPage: 8 });
  release(Response.json([history]));
  await loading;
  assert.equal(personal.snapshot().history[0]?.lastPage, 8);
  assert.equal((personal.snapshot().items[0] as typeof history)?.lastPage, 8);
});

test("resuming paid history retains its page while requiring existing server unlock without making a purchase", async () => {
  const paths: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    assert.notEqual(init?.method, "POST");
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path.startsWith("/versions/title/"))
      return Response.json([
        {
          versionId: "paid-1",
          status: "published",
          chapterNumber: "2",
          priceCoins: 15,
        },
      ]);
    if (path.endsWith("/chapters")) return Response.json([]);
    if (path === "/versions/paid-1")
      return Response.json({ priceCoins: 15, pages: ["/uploads/paid.jpg"] });
    return Response.json({
      id: history.id,
      covers: [],
      authors: [],
      genres: [],
    });
  };
  const catalog = createCatalog({ ...options, fetch });
  const reader = createReader({ ...options, fetch });
  await resumeHistoryReading({
    item: { ...history, lastChapterId: "ver:paid-1" },
    catalog,
    reader,
    isCurrent: () => true,
  });
  assert.equal(reader.snapshot().status, "unlockRequired");
  assert.deepEqual(reader.snapshot().pages, []);
  assert.equal(reader.snapshot().position?.pageIndex, 6);
  assert.equal(
    paths.some((path) => path.startsWith("/unlock/")),
    false,
  );
});

test("missing historical chapters leave current details available instead of silently opening another chapter", async () => {
  const fetch: typeof globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.startsWith("/versions/title/") || path.endsWith("/chapters"))
      return Response.json([]);
    return Response.json({
      id: history.id,
      covers: [],
      authors: [],
      genres: [],
    });
  };
  const catalog = createCatalog({ ...options, fetch });
  const reader = createReader({ ...options, fetch });
  assert.equal(
    await resumeHistoryReading({
      item: history,
      catalog,
      reader,
      isCurrent: () => true,
    }),
    false,
  );
  assert.equal(catalog.snapshot().book?.id, history.id);
  assert.equal(reader.snapshot().status, "closed");
});
