import { describe, expect, test } from "bun:test";
import { FORUM_LIMITS, clipToLimit } from "./forumLimits";

/** #988: forum text is cut to the server's limits (Backend/src/forum/forum.dto.ts) before it is sent. */
describe("forum limits (#988)", () => {
  test("mirror the server DTOs", () => {
    expect(FORUM_LIMITS).toEqual({ title: 200, content: 10_000, comment: 5_000 });
  });

  test("text within the limit is unchanged", () => {
    expect(clipToLimit("สั้น", 200)).toBe("สั้น");
    const exact = "ก".repeat(200);
    expect(clipToLimit(exact, 200)).toBe(exact);
  });

  test("longer text is cut to exactly the limit, ending in an ellipsis", () => {
    const clipped = clipToLimit(`พูดคุยเกี่ยวกับเรื่อง ${"a".repeat(300)}`, 200);
    expect(Array.from(clipped)).toHaveLength(200);
    expect(clipped.endsWith("…")).toBe(true);
    expect(clipped.startsWith("พูดคุยเกี่ยวกับเรื่อง a")).toBe(true);
  });

  test("characters are counted as the server counts them, so an emoji is never split", () => {
    const clipped = clipToLimit("😀".repeat(250), 200);
    expect(Array.from(clipped)).toHaveLength(200);
    expect(clipped).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // no lone high surrogate
  });
});
