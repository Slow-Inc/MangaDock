import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * #1023: deleting already-deleted content is now a 404 on the server. For a delete, "already gone" is done — a stale
 * tab must not show "delete failed" or keep the cached copy.
 */
mock.module("./supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

const { deletePost, deleteComment } = await import("./communityApi");
const { cacheSet, cacheGet } = await import("./apiCache");

let status: number;
const realFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  status = 200;
  Object.assign(globalThis, { fetch: async () => new Response(null, { status }) });
  cacheSet("post:p1", { id: "p1" }, 60_000, { tags: ["forum_post:p1"] });
  cacheSet("comments:p1", [{ id: "c1" }], 60_000, { tags: ["forum_post:p1"] });
});

describe("a delete of content already deleted elsewhere is done (#1023)", () => {
  test("a post answered 404 resolves and clears its cache", async () => {
    status = 404;
    await expect(deletePost("p1")).resolves.toBeUndefined();
    expect(cacheGet("post:p1")).toBeFalsy();
  });

  test("a comment answered 404 resolves and clears the comment list", async () => {
    status = 404;
    await expect(deleteComment("c1", "p1")).resolves.toBeUndefined();
    expect(cacheGet("comments:p1")).toBeFalsy();
  });

  test("any other failure still throws and keeps the cache", async () => {
    status = 503;
    await expect(deletePost("p1")).rejects.toThrow();
    await expect(deleteComment("c1", "p1")).rejects.toThrow();
    expect(cacheGet("post:p1")).toBeTruthy();
    expect(cacheGet("comments:p1")).toBeTruthy();
  });
});
