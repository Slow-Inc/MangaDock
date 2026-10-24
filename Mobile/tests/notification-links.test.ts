import test from "node:test";
import assert from "node:assert/strict";
import { notificationDestination } from "../src/notification-links.ts";
test("OS product links use the native scheme without accepting auth callbacks or foreign origins", () => {
  assert.deepEqual(notificationDestination("mangadock://book/manga-1"), {
    kind: "book",
    id: "manga-1",
  });
  assert.deepEqual(notificationDestination("mangadock://community/p/post-1"), {
    kind: "post",
    id: "post-1",
  });
  assert.deepEqual(notificationDestination("mangadock:///studio"), {
    kind: "studio",
  });
  for (const url of [
    "mangadock://auth/recovery?code=secret",
    "other://book/manga-1",
    "mangadock://user@book/manga-1",
    "mangadock://book:80/manga-1",
    "mangadock://community/p/../profile/user",
  ])
    assert.equal(notificationDestination(url), null);
});
test("notification destinations select supported native product screens and reject external or malformed links", () => {
  assert.deepEqual(notificationDestination("/community/p/post-1"), {
    kind: "post",
    id: "post-1",
  });
  assert.deepEqual(notificationDestination("/community/profile/reader-1"), {
    kind: "profile",
    id: "reader-1",
  });
  assert.deepEqual(notificationDestination("/book/manga-1/reviews"), {
    kind: "book",
    id: "manga-1",
  });
  assert.deepEqual(notificationDestination("/community/manga/manga-1"), {
    kind: "forumManga",
    id: "manga-1",
  });
  for (const path of [
    "https://other.test/community/p/post-1",
    "//other.test",
    "/\\other.test",
    "javascript:alert(1)",
    "/community/p/%2Foutside",
    "/community/p/..",
    "/unknown",
    "/community/p/%",
  ])
    assert.equal(notificationDestination(path), null);
});
