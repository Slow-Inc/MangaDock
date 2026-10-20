import { describe, it, expect } from "bun:test";
import { removeFollowItem, restoreFollowItem } from "./seriesFollowState";
import type { FollowedSeries } from "./seriesFollowState";

const item = (id: string, followedAt: string): FollowedSeries => ({
  id,
  title: `t-${id}`,
  thumbnail: `th-${id}`,
  followedAt,
});

describe("removeFollowItem / restoreFollowItem (#667)", () => {
  const original = [item("a", "2026-01-03"), item("b", "2026-01-02"), item("c", "2026-01-01")];

  it("removes the item and reports where it was", () => {
    const { items, snapshot } = removeFollowItem(original, "b");
    expect(items.map((f) => f.id)).toEqual(["a", "c"]);
    expect(snapshot).toEqual({ index: 1, item: original[1] });
  });

  it("restores a failed unfollow at its original position with its original followedAt", () => {
    const { items, snapshot } = removeFollowItem(original, "b");
    expect(restoreFollowItem(items, snapshot)).toEqual(original);
  });

  it("restores the last item at the end", () => {
    const { items, snapshot } = removeFollowItem(original, "c");
    expect(restoreFollowItem(items, snapshot)).toEqual(original);
  });

  it("returns no snapshot when the id is not in the list, and restore is a no-op", () => {
    const { items, snapshot } = removeFollowItem(original, "zzz");
    expect(items).toEqual(original);
    expect(snapshot).toBeNull();
    expect(restoreFollowItem(items, snapshot)).toEqual(original);
  });

  it("clamps the index when the list shrank while the request was in flight", () => {
    const { snapshot } = removeFollowItem(original, "c");
    expect(restoreFollowItem([item("a", "x")], snapshot).map((f) => f.id)).toEqual(["a", "c"]);
  });
});
