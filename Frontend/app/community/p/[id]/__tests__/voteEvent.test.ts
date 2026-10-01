import { expect, test, describe } from "bun:test";
import { isDisplayedVoteEvent } from "../../../../lib/voteEvents";

describe("isDisplayedVoteEvent", () => {
  test("keeps post-target vote events (the only ones rendered)", () => {
    expect(isDisplayedVoteEvent("post")).toBe(true);
  });

  test("drops comment-target vote events (never displayed → wasted re-render)", () => {
    expect(isDisplayedVoteEvent("comment")).toBe(false);
    expect(isDisplayedVoteEvent("reply")).toBe(false);
  });
});
