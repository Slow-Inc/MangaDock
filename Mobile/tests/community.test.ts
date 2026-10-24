import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createCommunity } from "../src/community.ts";
const post = {
  id: "post-1",
  authorUid: "reader-2",
  authorName: "นักอ่าน",
  authorPhotoUrl: null,
  title: "คุยเรื่องมังงะ",
  content: "เนื้อหา",
  category: "general",
  targetMangaId: "manga-1",
  targetMangaTitle: "เรื่องราว",
  imageUrls: [],
  upvotes: 2,
  downvotes: 0,
  userVote: 0,
  commentCount: 3,
  createdAt: "2026-10-03T00:00:00Z",
};
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
test("community live feed offers new posts without moving the current list and stops when the screen leaves", async () => {
  let started!: () => void,
    send!: (value: Uint8Array) => void,
    cancelled = false;
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  const auth = fixture({
    externalFetch: async (input) => {
      if (String(input).endsWith("/feed/stream"))
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              send = (value) => controller.enqueue(value);
              started();
            },
            cancel() {
              cancelled = true;
            },
          }),
        );
      return Response.json({ items: [post], total: 1 });
    },
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await community.load();
  const watching = community.watchFeed();
  await beginning;
  const update = new Promise<void>((resolve) => {
    const unsubscribe = community.subscribe(() => {
      if (community.snapshot().newPosts === 1) {
        unsubscribe();
        resolve();
      }
    });
  });
  send(
    new TextEncoder().encode(
      'data: {"type":"new_post","id":"new-id","category":"general"}\n\n',
    ),
  );
  await update;
  assert.equal(community.snapshot().items[0].id, post.id);
  community.stopWatching();
  await watching;
  assert.equal(cancelled, true);
  community.dispose();
});
test("trending manga uses the existing weekly ranking independently of the selected category feed", async () => {
  const auth = fixture({
    externalFetch: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/forum/trending-manga");
      assert.equal(url.searchParams.get("limit"), "5");
      return Response.json([
        {
          mangaId: "manga-1",
          mangaTitle: "Title",
          mangaCover: "/cover.jpg",
          postCount: 8,
        },
      ]);
    },
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await community.loadTrending();
  assert.equal(community.snapshot().trending[0].postCount, 8);
  assert.deepEqual(community.snapshot().items, []);
  community.dispose();
});
test("guests browse the existing Community category and manga feed without requiring sign-in", async () => {
  const auth = fixture({
    externalFetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/forum/posts");
      assert.equal(url.searchParams.get("category"), "general");
      assert.equal(url.searchParams.get("mangaId"), "manga-1");
      assert.equal(url.searchParams.get("sort"), "new");
      assert.equal(url.searchParams.get("limit"), "20");
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return Response.json({ items: [post], total: 1 });
    },
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await community.load({
    category: "general",
    mangaId: "manga-1",
    sort: "new",
  });
  assert.equal(community.snapshot().items[0]?.id, post.id);
  assert.equal(community.snapshot().total, 1);
});

test("changing Community category does not display a delayed older feed under the new category", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const auth = fixture({
    externalFetch: async (input) =>
      String(input).includes("category=general")
        ? delayed
        : Response.json({ items: [{ ...post, id: "new-post" }], total: 1 }),
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const previous = community.load({ category: "general" });
  await community.load({ category: "manga_update" });
  release(Response.json({ items: [post], total: 1 }));
  await previous;
  assert.equal(community.snapshot().filter.category, "manga_update");
  assert.equal(community.snapshot().items[0].id, "new-post");
});

test("loading more Community posts reaches later server pages while preserving the selected filter", async () => {
  const auth = fixture({
    externalFetch: async (input) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset"));
      assert.equal(url.searchParams.get("category"), "general");
      return Response.json({
        items: Array.from({ length: offset ? 2 : 20 }, (_, index) => ({
          ...post,
          id: `post-${offset + index}`,
        })),
        total: 22,
      });
    },
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await community.load({ category: "general" });
  await community.more();
  assert.equal(community.snapshot().items.length, 22);
  assert.equal(community.snapshot().items[21]?.id, "post-21");
  assert.equal(community.snapshot().filter.category, "general");
});

test("a failed Community filter shows its own error and can retry instead of keeping the old category feed", async () => {
  let offline = false;
  const auth = fixture({
    externalFetch: async () =>
      offline
        ? Response.json({}, { status: 503 })
        : Response.json({ items: [post], total: 1 }),
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await community.load({ category: "general" });
  offline = true;
  await community.load({ category: "spoiler" }).catch(() => {});
  assert.equal(community.snapshot().filter.category, "spoiler");
  assert.deepEqual(community.snapshot().items, []);
  assert.ok(community.snapshot().error);
  assert.equal(community.snapshot().loading, false);
  offline = false;
  await community.load({ category: "spoiler" });
  assert.equal(community.snapshot().error, null);
});

test("opening a Community post uses its server detail and preserves its manga reference", async () => {
  const auth = fixture({
    externalFetch: async (input) => {
      assert.equal(new URL(String(input)).pathname, "/forum/posts/post-1");
      return Response.json(post);
    },
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await community.open("post-1");
  assert.equal(community.snapshot().post?.content, post.content);
  assert.equal(community.snapshot().post?.targetMangaId, "manga-1");
});

test("back out of a loading post prevents its delayed detail from reopening the post", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const auth = fixture({ externalFetch: async () => delayed });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const opening = community.open("post-1");
  assert.equal(community.back(), true);
  release(Response.json(post));
  await opening;
  assert.equal(community.snapshot().postId, null);
  assert.equal(community.snapshot().post, null);
  assert.equal(community.back(), false);
});

test("a removed Community post stops loading with a visible server error and can return to the feed", async () => {
  const auth = fixture({
    externalFetch: async () => Response.json({}, { status: 404 }),
  });
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await community.open("removed").catch(() => {});
  assert.equal(community.snapshot().postLoading, false);
  assert.ok(community.snapshot().postError);
  assert.equal(community.snapshot().post, null);
  assert.equal(community.back(), true);
});

test("identity changes clear authenticated Community state and ignore delayed voted posts from the old account", async () => {
  let release!: (response: Response) => void;
  const delayed = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const auth = fixture({ externalFetch: async () => delayed });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const community = createCommunity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const loading = community.load();
  await new Promise((resolve) => setImmediate(resolve));
  await auth.app.signOut();
  release(Response.json({ items: [{ ...post, userVote: 1 }], total: 1 }));
  await loading;
  assert.deepEqual(community.snapshot().items, []);
  assert.equal(community.snapshot().loading, false);
});
