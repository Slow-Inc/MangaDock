import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createRetention } from "../src/retention.ts";
import { notificationDestination } from "../src/notification-links.ts";

const id = "2f1f0c32-855b-4cd7-bb63-a13d4a7fb760";
const collection = {
  id,
  owner_uid: "reader-1",
  name: "อ่านสุดสัปดาห์",
  description: "",
  visibility: "private",
  created_at: "",
  updated_at: "",
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function setup(
  t: TestContext,
  fetch: typeof globalThis.fetch,
  signedIn = true,
) {
  const auth = fixture({ externalFetch: fetch });
  if (signedIn)
    await auth.app.signIn("reader@example.test", "correct-test-password");
  const retention = createRetention({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  t.after(() => {
    retention.dispose();
    auth.app.dispose();
  });
  return { auth, retention };
}

test("collection and feed links open native destinations without accepting invalid collection IDs", () => {
  for (const prefix of ["/", "mangadock://", "mangadock:///"])
    assert.deepEqual(notificationDestination(`${prefix}collections/${id}`), {
      kind: "collection",
      id,
    });
  assert.deepEqual(notificationDestination("mangadock://collections"), {
    kind: "collections",
  });
  assert.deepEqual(notificationDestination("mangadock://feed"), {
    kind: "feed",
  });
  for (const link of [
    "mangadock://collections/not-a-uuid",
    "/collections/%2f",
    "/collections/..",
    "mangadock://collections/a/../" + id,
    "https://other.test/collections/" + id,
  ])
    assert.equal(notificationDestination(link), null, link);
});

test("guest collection reads use the public endpoint without sending an account token", async (t) => {
  const requests: Array<{ path: string; headers: Headers }> = [];
  const { retention } = await setup(
    t,
    async (input, init) => {
      requests.push({
        path: new URL(String(input)).pathname,
        headers: new Headers(init?.headers),
      });
      return Response.json({ ...collection, visibility: "public", items: [] });
    },
    false,
  );
  await retention.open(id);
  assert.equal(requests[0].path, `/collections/public/${id}`);
  assert.equal(requests[0].headers.has("authorization"), false);
  assert.equal(requests[0].headers.get("x-manga-dock-client"), "mobile");
  assert.equal(retention.snapshot().detail?.id, id);
  await retention.feed();
  assert.match(retention.snapshot().feed.error!, /เข้าสู่ระบบ/);
  assert.equal(requests.length, 1);
});

test("collection CRUD keeps server ownership, private default input and acknowledgement semantics", async (t) => {
  const writes: Array<{ method: string; body: unknown }> = [];
  const { retention } = await setup(t, async (input, init) => {
    assert.match(new Headers(init?.headers).get("authorization")!, /^Bearer /);
    const method = init?.method ?? "GET";
    if (method !== "GET")
      writes.push({
        method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
    if (method === "POST") return Response.json(collection);
    if (String(input).endsWith("/items") || method === "DELETE")
      return new Response(null, { status: 204 });
    if (method === "PUT")
      return Response.json({
        ...collection,
        name: "แชร์ได้",
        visibility: "public",
      });
    return Response.json([]);
  });
  assert.equal(
    await retention.save({
      name: " อ่านสุดสัปดาห์ ",
      description: "",
      visibility: "private",
    }),
    true,
  );
  assert.deepEqual(writes[0].body, {
    name: "อ่านสุดสัปดาห์",
    description: "",
    visibility: "private",
  });
  await retention.item({ id: "manga-1", title: "เรื่องแรก" });
  assert.equal(retention.snapshot().detail?.items.length, 1);
  await retention.save(
    { name: "แชร์ได้", description: "", visibility: "public" },
    id,
  );
  assert.equal(retention.snapshot().detail?.items.length, 1);
  assert.equal(retention.snapshot().detail?.visibility, "public");
  await retention.item({ id: "manga-1", title: "เรื่องแรก" }, true);
  assert.equal(retention.snapshot().detail?.items.length, 0);
  await retention.remove();
  assert.equal(retention.snapshot().id, null);
  assert.equal(retention.snapshot().collections.length, 0);
});

test("account changes clear all private state and discard late writes", async (t) => {
  const pending = deferred<Response>();
  const { auth, retention } = await setup(t, async (_input, init) =>
    init?.method === "POST" ? pending.promise : Response.json([collection]),
  );
  await retention.list();
  const save = retention.save({
    name: "test",
    description: "",
    visibility: "private",
  });
  await auth.app.signOut();
  pending.resolve(Response.json(collection));
  assert.equal(await save, false);
  assert.deepEqual(retention.snapshot().collections, []);
  assert.equal(retention.snapshot().detail, null);
  assert.equal(retention.snapshot().saving, false);
});

test("duplicate save taps share a single pending write and failed writes preserve the draft target", async (t) => {
  const pending = deferred<Response>();
  let calls = 0;
  const { retention } = await setup(t, async () => {
    calls++;
    return pending.promise;
  });
  const input = {
    name: "test",
    description: "",
    visibility: "private" as const,
  };
  const save = retention.save(input);
  assert.equal(await retention.save(input), false);
  pending.resolve(Response.json({ message: "denied" }, { status: 403 }));
  assert.equal(await save, false);
  assert.equal(calls, 1);
  assert.equal(retention.snapshot().id, null);
  assert.match(retention.snapshot().mutationError!, /ไม่มีสิทธิ์/);
});

test("feed switches discard late results, page offsets count server rows and repeated IDs are deduplicated", async (t) => {
  const first = deferred<Response>();
  const paths: string[] = [];
  const { retention } = await setup(t, async (input) => {
    const url = new URL(String(input));
    paths.push(url.search);
    if (url.searchParams.get("mode") === "following") return first.promise;
    return Response.json({
      items:
        url.searchParams.get("offset") === "0"
          ? [{ id: "post-a" }, { id: "post-b" }]
          : [{ id: "post-b" }, { id: "post-c" }],
      total: 4,
    });
  });
  const old = retention.feed("following");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await retention.feed("personalized");
  first.resolve(Response.json({ items: [{ id: "wrong" }], total: 1 }));
  await old;
  await retention.feed("personalized", true);
  assert.deepEqual(
    retention.snapshot().feed.items.map((post) => post.id),
    ["post-a", "post-b", "post-c"],
  );
  assert.equal(retention.snapshot().feed.offset, 4);
  assert.match(paths.at(-1)!, /offset=2/);
  await retention.feed("personalized", true);
  assert.equal(paths.length, 3);
});

test("a new collection destination prevents an old detail from leaking into it", async (t) => {
  const pending = deferred<Response>();
  const { retention } = await setup(t, async (input) =>
    String(input).includes(id)
      ? pending.promise
      : Response.json({ ...collection, id: "new", items: [] }),
  );
  const old = retention.open(id);
  await retention.open("new");
  pending.resolve(Response.json({ ...collection, items: [] }));
  await old;
  assert.equal(retention.snapshot().detail?.id, "new");
  assert.equal(retention.snapshot().detailError, null);
});

test("catalog and response-body deadlines release loading and permit a same-screen retry", async (t) => {
  let stalled = true;
  let signal: AbortSignal | null | undefined;
  const { retention } = await setup(t, async (_input, init) => {
    signal = init?.signal;
    return stalled
      ? new Response(new ReadableStream({ start() {} }))
      : Response.json([collection]);
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const loading = retention.list();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  t.mock.timers.tick(15_000);
  await loading;
  assert.equal(retention.snapshot().listLoading, false);
  assert.match(retention.snapshot().listError!, /ใช้เวลานาน/);
  assert.equal(signal?.aborted, true);
  stalled = false;
  await retention.list();
  assert.equal(retention.snapshot().listError, null);
  assert.equal(retention.snapshot().collections[0].id, id);
});
