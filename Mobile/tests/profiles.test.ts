import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createProfiles, type PublicProfile } from "../src/profiles.ts";
import type { ForumPost } from "../src/community.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
test("profile authored posts paginate using authorUid and retain server offsets instead of repeating the first twenty posts", async () => {
  const posts: ForumPost[] = Array.from({ length: 22 }, (_, index) => ({
    id: `post-${index}`,
    authorUid: "author-1",
    authorName: "Author",
    authorPhotoUrl: null,
    title: `Post ${index}`,
    content: "Body",
    category: "general",
    targetMangaId: null,
    targetMangaTitle: null,
    imageUrls: [],
    upvotes: 0,
    downvotes: 0,
    userVote: 0,
    commentCount: 0,
    createdAt: "",
  }));
  const auth = fixture({
    externalFetch: async (input) => {
      const url = new URL(String(input)),
        path = url.pathname;
      if (path === "/forum/posts") {
        assert.equal(url.searchParams.get("authorUid"), "author-1");
        assert.equal(url.searchParams.get("offset"), "20");
        return Response.json({ items: posts.slice(20), total: 22 });
      }
      return Response.json(
        path.startsWith("/forum/profile/")
          ? { ...profile, posts: posts.slice(0, 20) }
          : path.endsWith("/counts")
            ? { followers: 0, following: 0 }
            : [],
      );
    },
  });
  const profiles = createProfiles({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await profiles.open("author-1");
  await profiles.morePosts();
  assert.equal(profiles.snapshot().data?.posts.length, 22);
  assert.equal(profiles.snapshot().hasMorePosts, false);
  profiles.dispose();
});
const profile = {
  profile: {
    uid: "author-1",
    displayName: "Author",
    photoUrl: null,
    bannerUrl: null,
    bannerPosition: 50,
    role: 1,
    bio: "Hello",
    country: "TH",
    translatorLanguages: ["th"],
    ratingAvg: 4,
    ratingCount: 2,
    createdAt: "2026-10-04",
  },
  posts: [],
  comments: [],
  likedPosts: [],
  translatedTitles: [],
  earnings: null,
};
test("profile owners upload and reposition their banner through existing endpoints without allowing edits to other profiles", async () => {
  const own: PublicProfile = {
    ...profile,
    profile: { ...profile.profile, uid: "reader-1" },
  };
  const writes: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/forum/profile/banner") {
        writes.push("upload");
        own.profile.bannerUrl = "/banner.png";
        return Response.json({ bannerUrl: "/banner.png" });
      }
      if (path === "/forum/profile/banner-position") {
        writes.push("position");
        own.profile.bannerPosition = JSON.parse(String(init?.body)).position;
        return Response.json({ position: own.profile.bannerPosition });
      }
      return Response.json(
        path.startsWith("/forum/profile/")
          ? own
          : path.endsWith("/counts")
            ? { followers: 0, following: 0 }
            : path.endsWith("/is-following")
              ? { following: false }
              : [],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const profiles = createProfiles({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await profiles.open("reader-1");
  await profiles.uploadBanner({
    blob: new Blob(["image"], { type: "image/png" }),
    name: "banner.png",
  });
  await profiles.positionBanner(70);
  assert.equal(profiles.snapshot().data?.profile.bannerPosition, 70);
  assert.deepEqual(writes, ["upload", "position"]);
  await profiles.open("author-1");
  await assert.rejects(profiles.positionBanner(40));
  assert.deepEqual(writes, ["upload", "position"]);
  profiles.dispose();
});
test("a guest opens the existing public profile, follower counts and following list without a private follow-status request", async () => {
  const paths: string[] = [];
  const auth = fixture({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      return Response.json(
        path.startsWith("/forum/profile/")
          ? profile
          : path.endsWith("/counts")
            ? { followers: 3, following: 2 }
            : [],
      );
    },
  });
  const profiles = createProfiles({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await profiles.open("author-1");
  assert.deepEqual(profiles.snapshot().data, profile);
  assert.equal(profiles.snapshot().counts.followers, 3);
  assert.deepEqual(paths.sort(), [
    "/forum/profile/author-1",
    "/user-follows/author-1/counts",
    "/user-follows/author-1/followers",
    "/user-follows/author-1/following",
  ]);
  profiles.dispose();
});

test("following and unfollowing refresh the existing server relationship and counts after empty-body success", async () => {
  let followed = false;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method) {
        assert.equal(path, "/user-follows/author-1/follow");
        assert.ok(new Headers(init.headers).get("authorization"));
        followed = init.method === "POST";
        return new Response(null, { status: 204 });
      }
      return Response.json(
        path.startsWith("/forum/profile/")
          ? profile
          : path.endsWith("/counts")
            ? { followers: followed ? 4 : 3, following: 2 }
            : path.endsWith("/is-following")
              ? { following: followed }
              : [],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const profiles = createProfiles({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await profiles.open("author-1");
  assert.equal(await profiles.follow(true), true);
  assert.equal(profiles.snapshot().isFollowing, true);
  assert.equal(profiles.snapshot().counts.followers, 4);
  await profiles.follow(false);
  assert.equal(profiles.snapshot().isFollowing, false);
  profiles.dispose();
});

test("slow private profile data and follow acknowledgements cannot cross navigation or a sign-out", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delayed = false;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method || (delayed && path.includes("author-1"))) await waiting;
      return init?.method
        ? new Response(null, { status: 204 })
        : Response.json(
            path.startsWith("/forum/profile/")
              ? {
                  ...profile,
                  earnings: {
                    totalSales: 1,
                    totalEarned: 20,
                    titlesSold: 1,
                    uniqueBuyers: 1,
                  },
                }
              : path.endsWith("/counts")
                ? { followers: 3, following: 2 }
                : path.endsWith("/is-following")
                  ? { following: true }
                  : [],
          );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const profiles = createProfiles({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await profiles.open("author-1");
  const following = profiles.follow(true);
  await new Promise((resolve) => setImmediate(resolve));
  delayed = true;
  const old = profiles.open("author-1");
  await new Promise((resolve) => setImmediate(resolve));
  await profiles.open("author-2");
  await auth.app.signOut();
  release();
  assert.equal(await following, false);
  await old;
  assert.equal(profiles.snapshot().uid, "author-2");
  assert.equal(profiles.snapshot().data?.earnings ?? null, null);
  profiles.dispose();
});
