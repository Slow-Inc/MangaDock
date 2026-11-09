import { expect, test, describe } from "bun:test";
import { appendComment } from "../../../../lib/commentList";

describe("appendComment", () => {
  test("adds a new comment at the end", () => {
    expect(appendComment([{ id: "a" }], { id: "b" })).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("ignores a comment already delivered by the live stream (SSE beats the POST response)", () => {
    const prev = [{ id: "a" }, { id: "b" }];
    expect(appendComment(prev, { id: "b" })).toBe(prev);
  });
});
