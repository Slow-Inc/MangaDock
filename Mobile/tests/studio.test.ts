import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createStudio } from "../src/studio.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
const version = {
  versionId: "version-1",
  titleId: "manga-1",
  titleName: "Title",
  chapterId: "chapter-1",
  chapterNumber: "1",
  chapterTitle: "Chapter 1",
  language: "th",
  translatorUid: "reader-1",
  translatorName: "Creator",
  status: "draft" as const,
  pages: [],
  priceCoins: 0,
  qualityScore: 0,
  isDefault: false,
  description: null,
  createdAt: "",
  updatedAt: "",
};
const creator = () =>
  Response.json({
    uid: "reader-1",
    email: "reader@example.test",
    displayName: "Creator",
    role: 1,
  });
test("creator can create a draft without the optional chapter title, matching the existing upload form", async () => {
  const auth = fixture({
    loadAccount: async () => creator(),
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/versions");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.chapterTitle, "");
      return Response.json({ ...version, chapterTitle: "" });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const studio = createStudio({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const draft = await studio.ensureDraft({
    titleId: "manga-1",
    titleName: "Title",
    chapterNumber: "1",
    chapterTitle: "",
    language: "th",
  });
  assert.equal(draft?.chapterTitle, "");
  studio.dispose();
});
test("reader onboarding refreshes the existing creator role and reads earnings from the server rather than calculating income from draft prices", async () => {
  let role = 0;
  const auth = fixture({
    loadAccount: async () =>
      Response.json({
        uid: "reader-1",
        email: "reader@example.test",
        displayName: "Creator",
        role,
      }),
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/users/me/become-translator") {
        assert.equal(init?.method, "POST");
        role = 1;
        return Response.json({ ok: true });
      }
      if (path === "/wallet/earnings")
        return Response.json({
          totalSales: 4,
          totalEarned: 33,
          titlesSold: 2,
          uniqueBuyers: 3,
        });
      assert.equal(path, "/versions/me/versions");
      return Response.json([version]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const studio = createStudio({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  assert.equal(
    await studio.becomeCreator({ bio: "Creator", translatorLanguages: ["th"] }),
    true,
  );
  assert.equal(auth.app.snapshot().account?.role, 1);
  await studio.loadEarnings();
  assert.equal(studio.snapshot().earnings?.totalEarned, 33);
  await auth.app.signOut();
  assert.equal(studio.snapshot().earnings, null);
  studio.dispose();
});
test("saved pages reorder and delete before publication, and native publication follows the server lifecycle", async () => {
  let current = { ...version, pages: ["/one.png", "/two.png"] },
    statuses: string[] = [];
  const auth = fixture({
    loadAccount: async () => creator(),
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.startsWith("/upload/")) {
        const body = JSON.parse(String(init?.body));
        current = {
          ...current,
          pages:
            init?.method === "PUT"
              ? body.pages
              : current.pages.filter((page) => page !== body.pageUrl),
        };
        return Response.json({ ok: true });
      }
      if (path.endsWith("/status")) {
        const body = JSON.parse(String(init?.body));
        statuses.push(body.status);
        current = { ...current, status: body.status };
        return new Response(null, { status: 204 });
      }
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(path.endsWith("/me/versions") ? [current] : current);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const studio = createStudio({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await studio.open(version.versionId);
  await assert.rejects(studio.reorderPages(["/one.png", "/one.png"]));
  await studio.reorderPages(["/two.png", "/one.png"]);
  assert.deepEqual(studio.snapshot().version?.pages, ["/two.png", "/one.png"]);
  await studio.deletePage("/one.png");
  assert.deepEqual(studio.snapshot().version?.pages, ["/two.png"]);
  await studio.status("published");
  assert.equal(studio.snapshot().version?.status, "published");
  await studio.status("draft");
  assert.deepEqual(statuses, ["published", "draft"]);
  await studio.deleteVersion();
  assert.equal(studio.snapshot().version, null);
  studio.dispose();
});
test("duplicate upload gestures while the first draft is being created do not append the same selected page twice", async () => {
  let creates = 0,
    uploads = 0;
  const auth = fixture({
    loadAccount: async () => creator(),
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/versions") {
        creates++;
        return Response.json(version);
      }
      if (path.startsWith("/upload/")) {
        uploads++;
        return Response.json({
          pageUrl: `/page-${uploads}.png`,
          pageIndex: uploads - 1,
        });
      }
      return Response.json({ ...version, pages: ["/page-1.png"] });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const studio = createStudio({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const images = [
      { name: "one.png", blob: new Blob(["image"], { type: "image/png" }) },
    ],
    draft = {
      titleId: "manga-1",
      titleName: "Title",
      chapterNumber: "1",
      chapterTitle: "Chapter 1",
      language: "th",
    };
  await Promise.all([
    studio.queuePages(images, draft),
    studio.queuePages(images, draft),
  ]);
  assert.equal(creates, 1);
  assert.equal(uploads, 1);
  studio.dispose();
});
test("chapter uploads preserve selected order, keep acknowledged pages, and retry only the rejected page without creating another draft", async () => {
  let creates = 0,
    rejected = true;
  const uploaded: string[] = [];
  let pages: string[] = [];
  const auth = fixture({
    loadAccount: async () => creator(),
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/versions") {
        creates++;
        return Response.json({ ...version, pages });
      }
      if (path.startsWith("/upload/")) {
        const file = (init?.body as FormData).get("file") as File;
        if (file.name === "two.png" && rejected)
          return Response.json({}, { status: 403 });
        uploaded.push(file.name);
        const pageUrl = `/pages/${file.name}`;
        pages = [...pages, pageUrl];
        return Response.json({ pageUrl, pageIndex: pages.length - 1 });
      }
      return Response.json({ ...version, pages });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const studio = createStudio({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const images = ["one.png", "two.png", "three.png"].map((name) => ({
    name,
    blob: new Blob(["image"], { type: "image/png" }),
  }));
  await studio.queuePages(images, {
    titleId: "manga-1",
    titleName: "Title",
    chapterNumber: "1",
    chapterTitle: "Chapter 1",
    language: "th",
  });
  assert.deepEqual(uploaded, ["one.png"]);
  assert.equal(studio.snapshot().uploads[1].status, "error");
  assert.equal(studio.snapshot().uploads[2].status, "pending");
  rejected = false;
  await studio.retryPages();
  assert.deepEqual(uploaded, ["one.png", "two.png", "three.png"]);
  assert.equal(creates, 1);
  assert.deepEqual(studio.snapshot().version?.pages, [
    "/pages/one.png",
    "/pages/two.png",
    "/pages/three.png",
  ]);
  studio.dispose();
});
test("concurrent first-page draft requests create one workspace and metadata changes validate price before reaching the server", async () => {
  let creates = 0,
    current = version;
  const bodies: unknown[] = [];
  const auth = fixture({
    loadAccount: async () => creator(),
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/versions") {
        creates++;
        assert.equal(init?.method, "POST");
        return Response.json(current);
      }
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        current = { ...current, ...body };
        return new Response(null, { status: 204 });
      }
      return Response.json(
        path === "/versions/me/versions" ? [current] : current,
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const studio = createStudio({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const body = {
    titleId: "manga-1",
    titleName: "Title",
    chapterNumber: "1",
    chapterTitle: "Chapter 1",
    language: "th",
  };
  await Promise.all([studio.ensureDraft(body), studio.ensureDraft(body)]);
  assert.equal(creates, 1);
  assert.equal(studio.snapshot().version?.versionId, version.versionId);
  await assert.rejects(studio.saveMetadata({ priceCoins: -1 }));
  assert.deepEqual(bodies, []);
  await studio.saveMetadata({ description: "Description", priceCoins: 10 });
  assert.equal(studio.snapshot().version?.priceCoins, 10);
  assert.deepEqual(bodies, [{ description: "Description", priceCoins: 10 }]);
  studio.dispose();
});
test("Studio lists only the accepted creator workspace and enforces the existing frontend role allowlist", async () => {
  const auth = fixture({
    loadAccount: async () => creator(),
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/versions/me/versions");
      assert.equal(
        new Headers(init?.headers).get("x-hardware-id"),
        options.deviceId,
      );
      return Response.json([version]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const studio = createStudio({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await studio.load();
  assert.equal(studio.snapshot().versions[0].versionId, version.versionId);
  await auth.app.signOut();
  assert.deepEqual(studio.snapshot().versions, []);
  studio.dispose();
  const reader = fixture();
  await reader.app.signIn("reader@example.test", "correct-test-password");
  const denied = createStudio({
    ...options,
    fetch: reader.fetch,
    session: reader.app,
  });
  await denied.load();
  assert.ok(denied.snapshot().error);
  assert.deepEqual(denied.snapshot().versions, []);
  denied.dispose();
});
