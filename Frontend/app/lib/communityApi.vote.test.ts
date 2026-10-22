import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * #992: a vote must clear the cached copies that still hold the old count and userVote — otherwise the next click
 * on a cached page sends +1 again, which the server treats as an undo.
 */
mock.module("./supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

const { vote } = await import("./communityApi");
const { cacheSet, cacheGet } = await import("./apiCache");

let status: number;

beforeEach(() => {
  status = 200;
  Object.assign(globalThis, {
    fetch: async () => new Response(JSON.stringify({ upvotes: 1, downvotes: 0 }), { status }),
  });
  cacheSet("post:p1", { id: "p1", upvotes: 0, userVote: 0 }, 60_000, { tags: ["forum_post:p1"] });
  cacheSet("post:p2", { id: "p2", upvotes: 5, userVote: 0 }, 60_000, { tags: ["forum_post:p2"] });
  cacheSet("posts:::hot:0:20", { items: [{ id: "p1", upvotes: 0, userVote: 0 }], total: 1 }, 60_000, { tags: ["forum_posts"] });
  cacheSet("comments:p1", [{ id: "c1", upvotes: 0, userVote: 0 }], 60_000, { tags: ["forum_post:p1"] });
});

describe("vote clears the cached copies it made stale (#992)", () => {
  test("a post vote clears the post and the feed, not other posts", async () => {
    await vote({ targetType: "post", targetId: "p1", voteValue: 1 });
    expect(cacheGet("post:p1")).toBeFalsy();
    expect(cacheGet("posts:::hot:0:20")).toBeFalsy();
    expect(cacheGet("post:p2")).toBeTruthy();
  });

  test("a comment vote clears that post's comment list", async () => {
    await vote({ targetType: "comment", targetId: "c1", voteValue: 1, postId: "p1" });
    expect(cacheGet("comments:p1")).toBeFalsy();
    expect(cacheGet("post:p2")).toBeTruthy();
  });

  test("a failed vote keeps every entry", async () => {
    status = 503;
    await expect(vote({ targetType: "post", targetId: "p1", voteValue: 1 })).rejects.toThrow();
    expect(cacheGet("post:p1")).toBeTruthy();
    expect(cacheGet("posts:::hot:0:20")).toBeTruthy();
  });
});
