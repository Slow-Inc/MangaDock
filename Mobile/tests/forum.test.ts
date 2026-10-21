import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createForum } from "../src/forum.ts";
import type { ForumComment } from "../src/forum.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
const post = {
  id: "post-1",
  authorUid: "reader-1",
  authorName: "Reader",
  authorPhotoUrl: null,
  title: "Title",
  content: "Body",
  category: "general" as const,
  targetMangaId: null,
  targetMangaTitle: null,
  imageUrls: [],
  upvotes: 0,
  downvotes: 0,
  userVote: 0,
  commentCount: 0,
  createdAt: "",
};
test("a delayed older post edit event cannot undo an acknowledged edit", async () => {
  let current = { ...post, updatedAt: "2026-10-04T10:00:00Z" };
  let send!: (event: object) => void;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/stream"))
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              send = (event) =>
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify(event)}\n\n`,
                  ),
                );
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (path.endsWith("/comments")) return Response.json([]);
      if (init?.method === "PATCH")
        current = {
          ...current,
          ...JSON.parse(String(init.body)),
          updatedAt: "2026-10-04T10:02:00Z",
        };
      return Response.json(current);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const forum = createForum({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await forum.open(post.id);
  const watching = forum.watch();
  await new Promise((resolve) => setImmediate(resolve));
  await forum.editPost({ title: "Acknowledged title", content: "New content" });
  send({
    type: "post_edited",
    postId: post.id,
    title: "Old title",
    content: "Old content",
    updatedAt: "2026-10-04T10:01:00Z",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(forum.snapshot().post?.title, "Acknowledged title");
  forum.stopWatching();
  await watching;
  forum.dispose();
});
test("community creates an authenticated post with existing attachment fields", async () => {
  const writes: unknown[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.ok(new Headers(init?.headers).get("authorization"));
      writes.push(JSON.parse(String(init?.body)));
      return Response.json(post);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const forum = createForum({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  assert.equal(
    (
      await forum.createPost({
        title: "Title",
        content: "Body",
        category: "general",
        imageUrls: ["/image.png"],
      })
    )?.id,
    post.id,
  );
  assert.deepEqual(writes, [
    {
      title: "Title",
      content: "Body",
      category: "general",
      imageUrls: ["/image.png"],
    },
  ]);
  forum.dispose();
});
test("a slow thread refresh preserves newer live vote counts while accepting server userVote", async () => {
  let delay = false,
    release!: () => void,
    send!: (event: object) => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const auth = fixture({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/stream"))
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              send = (event) =>
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify(event)}\n\n`,
                  ),
                );
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (delay) await waiting;
      return Response.json(
        path.endsWith("/comments") ? [] : { ...post, userVote: 1 },
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const forum = createForum({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await forum.open(post.id);
  const watching = forum.watch();
  await new Promise((resolve) => setImmediate(resolve));
  delay = true;
  const reload = forum.reload();
  send({
    type: "vote",
    postId: post.id,
    targetType: "post",
    targetId: post.id,
    upvotes: 8,
    downvotes: 2,
  });
  await new Promise((resolve) => setImmediate(resolve));
  release();
  await reload;
  assert.equal(forum.snapshot().post?.upvotes, 8);
  assert.equal(forum.snapshot().post?.userVote, 1);
  forum.stopWatching();
  await watching;
  forum.dispose();
});
test("live vote counts preserve my choice, and leaving a thread cancels its stream before late events can reach another post", async () => {
  let send!: (value: Uint8Array) => void, started!: () => void;
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  let cancelled = false;
  const auth = fixture({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/stream")) {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            send = (bytes) => controller.enqueue(bytes);
            started();
          },
          cancel() {
            cancelled = true;
          },
        });
        return new Response(stream, {
          headers: { "content-type": "text/event-stream" },
        });
      }
      return Response.json(
        path.endsWith("/comments") ? [] : { ...post, userVote: 1 },
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const forum = createForum({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await forum.open(post.id);
  const watching = forum.watch();
  await beginning;
  const updated = new Promise<void>((resolve) => {
    const unsub = forum.subscribe(() => {
      if (forum.snapshot().post?.upvotes === 8) {
        unsub();
        resolve();
      }
    });
  });
  send(
    new TextEncoder().encode(
      `data: ${JSON.stringify({ type: "vote", postId: post.id, targetType: "post", targetId: post.id, upvotes: 8, downvotes: 2 })}\n\n`,
    ),
  );
  await updated;
  assert.equal(forum.snapshot().post?.userVote, 1);
  forum.stopWatching();
  await watching;
  assert.equal(cancelled, true);
  assert.equal(forum.snapshot().connected, false);
  forum.dispose();
});
test("voting reconciles server userVote so tapping the same choice toggles off and failures keep the accepted vote", async () => {
  let current = post,
    reject = false;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/forum/vote") {
        if (reject) return Response.json({}, { status: 403 });
        const body = JSON.parse(String(init?.body));
        assert.equal(body.targetType, "post");
        current = {
          ...current,
          userVote: current.userVote === body.voteValue ? 0 : body.voteValue,
          upvotes: current.userVote === body.voteValue ? 0 : 1,
        };
        return Response.json({ upvotes: current.upvotes, downvotes: 0 });
      }
      return Response.json(path.endsWith("/comments") ? [] : current);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const forum = createForum({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await forum.open(post.id);
  await forum.vote("post", post.id, 1);
  assert.equal(forum.snapshot().post?.userVote, 1);
  await forum.vote("post", post.id, 1);
  assert.equal(forum.snapshot().post?.userVote, 0);
  reject = true;
  await assert.rejects(forum.vote("post", post.id, -1));
  assert.equal(forum.snapshot().post?.userVote, 0);
  forum.dispose();
});
test("native replies retain their parent, edit own comments and accept server promotion of children after deletion", async () => {
  const parent: ForumComment = {
    id: "comment-1",
    postId: post.id,
    parentId: null,
    authorUid: "reader-1",
    authorName: "Reader",
    authorPhotoUrl: null,
    authorRole: 0,
    content: "Parent",
    upvotes: 0,
    downvotes: 0,
    userVote: 0,
    createdAt: "",
    updatedAt: "",
    replies: [],
  };
  let comments = [parent];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/forum/comments" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        assert.equal(body.parentId, parent.id);
        const reply = {
          ...parent,
          id: "reply-1",
          parentId: parent.id,
          content: body.content,
        };
        comments = [{ ...parent, replies: [reply] }];
        return Response.json(reply);
      }
      if (path === "/forum/comments/reply-1") {
        const body = JSON.parse(String(init?.body));
        comments[0].replies![0].content = body.content;
        return Response.json(comments[0].replies![0]);
      }
      if (path === "/forum/comments/comment-1" && init?.method === "DELETE") {
        comments = comments[0].replies!;
        return new Response(null, { status: 204 });
      }
      return Response.json(path.endsWith("/comments") ? comments : post);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const forum = createForum({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await forum.open(post.id);
  await forum.comment("Reply", parent.id);
  assert.equal(forum.snapshot().comments[0].replies?.[0].content, "Reply");
  await forum.editComment("reply-1", "Edited reply");
  assert.equal(
    forum.snapshot().comments[0].replies?.[0].content,
    "Edited reply",
  );
  await forum.deleteComment(parent.id);
  assert.equal(forum.snapshot().comments[0].id, "reply-1");
  forum.dispose();
});
test("owners edit only title/content and delete a post after server acknowledgement, preserving denied posts", async () => {
  let current = post,
    denied = true;
  const writes: unknown[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/comments")) return Response.json([]);
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        writes.push(body);
        current = { ...current, ...body };
      }
      if (init?.method === "DELETE")
        return new Response(null, { status: denied ? 403 : 204 });
      return Response.json(current);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const forum = createForum({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await forum.open(post.id);
  await forum.editPost({ title: "Updated", content: "Updated body" });
  assert.equal(forum.snapshot().post?.title, "Updated");
  assert.deepEqual(writes, [{ title: "Updated", content: "Updated body" }]);
  await assert.rejects(forum.deletePost());
  assert.equal(forum.snapshot().post?.id, post.id);
  denied = false;
  assert.equal(await forum.deletePost(), true);
  assert.equal(forum.snapshot().post, null);
  forum.dispose();
});
