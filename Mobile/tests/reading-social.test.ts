import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createReadingSocial } from "../src/reading-social.ts";

const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
const review = {
  id: "review-1",
  uid: "reader-1",
  mangaId: "manga-1",
  rating: 4,
  body: "Good",
  createdAt: "2026-10-04",
  displayName: "Reader",
  photoUrl: null,
};

test("an older page-comment read cannot erase an acknowledged comment", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const context = { mangaId: "manga-1", chapterId: "chapter-1", pageNumber: 1 };
  const comment = { ...review, ...context, id: "comment-new" };
  const auth = fixture({
    externalFetch: async (_input, init) => {
      if (init?.method === "POST") return Response.json(comment);
      await waiting;
      return Response.json([]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const social = createReadingSocial({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const old = social.comments(context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await social.addComment("Good"), true);
  release();
  await old;
  assert.deepEqual(social.snapshot().comments.items, [comment]);
  assert.equal(social.snapshot().comments.loading, false);
  social.dispose();
});

test("manga reviews load the existing public list and summary, including the signed-in readers own review", async () => {
  const paths: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path.endsWith("/my")) {
        assert.ok(
          new Headers(init?.headers)
            .get("authorization")
            ?.startsWith("Bearer "),
        );
        return Response.json(review);
      }
      return Response.json(
        path.endsWith("/summary") ? { averageRating: 4, count: 1 } : [review],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const social = createReadingSocial({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await social.reviews("manga-1");
  assert.deepEqual(social.snapshot().reviews.items, [review]);
  assert.deepEqual(social.snapshot().reviews.summary, {
    averageRating: 4,
    count: 1,
  });
  assert.deepEqual(social.snapshot().reviews.mine, review);
  assert.deepEqual(paths.sort(), [
    "/reviews/manga-1",
    "/reviews/manga-1/my",
    "/reviews/manga-1/summary",
  ]);
  social.dispose();
});

test("a slow review load cannot publish another manga or private review after navigation or sign-out", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const auth = fixture({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.includes("manga-1")) await waiting;
      return Response.json(
        path.endsWith("/summary")
          ? { averageRating: 4, count: 1 }
          : path.endsWith("/my")
            ? review
            : [review],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const social = createReadingSocial({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const old = social.reviews("manga-1");
  await new Promise((resolve) => setImmediate(resolve));
  await social.reviews("manga-2");
  await auth.app.signOut();
  release();
  await old;
  assert.equal(social.snapshot().reviews.mangaId, "manga-2");
  assert.equal(social.snapshot().reviews.mine, null);
  social.dispose();
});

test("saving and deleting the readers review refreshes the authoritative list and aggregate after acknowledgement", async () => {
  let saved: typeof review | null = null;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "POST") {
        assert.deepEqual(JSON.parse(String(init.body)), {
          mangaTitle: "Manga",
          rating: 4,
          body: "Good",
        });
        saved = review;
        return new Response(null, { status: 201 });
      }
      if (init?.method === "DELETE") {
        saved = null;
        return new Response(null, { status: 204 });
      }
      return Response.json(
        path.endsWith("/summary")
          ? { averageRating: saved ? 4 : 0, count: saved ? 1 : 0 }
          : path.endsWith("/my")
            ? saved
            : saved
              ? [saved]
              : [],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const social = createReadingSocial({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await social.reviews("manga-1");
  assert.equal(await social.saveReview("Manga", 4, "Good"), true);
  assert.equal(social.snapshot().reviews.summary.count, 1);
  assert.equal(await social.deleteReview(), true);
  assert.equal(social.snapshot().reviews.summary.count, 0);
  assert.equal(social.snapshot().reviews.mine, null);
  social.dispose();
});

test("page comments use the current one-based Reader context and append only the server-created comment", async () => {
  const context = { mangaId: "manga-1", chapterId: "chapter-1", pageNumber: 7 };
  const comment = { ...review, ...context, id: "comment-1" };
  const auth = fixture({
    externalFetch: async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        assert.deepEqual(JSON.parse(String(init.body)), {
          ...context,
          body: "Hello",
        });
        return Response.json(comment, { status: 201 });
      }
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      assert.equal(url.searchParams.get("page"), "7");
      assert.equal(url.searchParams.get("chapterId"), "chapter-1");
      return Response.json([]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const social = createReadingSocial({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await social.comments(context);
  assert.equal(await social.addComment("Hello"), true);
  assert.deepEqual(social.snapshot().comments.items, [comment]);
  await social.deleteComment("comment-1");
  assert.deepEqual(social.snapshot().comments.items, []);
  social.dispose();
});

test("a comment created for the previous page cannot appear on a newly opened page", async () => {
  let release!: (value: Response) => void;
  const context = { mangaId: "manga-1", chapterId: "chapter-1", pageNumber: 7 };
  const auth = fixture({
    externalFetch: async (_input, init) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : Response.json([]),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const social = createReadingSocial({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await social.comments(context);
  const posting = social.addComment("Hello");
  await new Promise((resolve) => setImmediate(resolve));
  await social.comments({ ...context, pageNumber: 8 });
  release(Response.json({ ...review, ...context }));
  assert.equal(await posting, false);
  assert.deepEqual(social.snapshot().comments.items, []);
  social.dispose();
});

test("reports preserve the supported content target and never mark a rejected request as submitted", async () => {
  const requests: object[] = [];
  let reject = true;
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/content-reports");
      requests.push(JSON.parse(String(init?.body)));
      return reject
        ? Response.json({ message: "Forbidden" }, { status: 403 })
        : new Response(null, { status: 201 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const social = createReadingSocial({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const report = {
    contentType: "manga" as const,
    contentId: "manga-1",
    reason: "copyright" as const,
    details: "Please check",
  };
  await assert.rejects(social.report(report));
  reject = false;
  assert.equal(await social.report(report), true);
  assert.deepEqual(requests, [report, report]);
  social.dispose();
});
