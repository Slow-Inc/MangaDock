import { describe, it, expect } from "bun:test";
import { removeFollowItem, restoreFollowItem, singleFlight } from "./seriesFollowState";
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

describe("singleFlight (#669a)", () => {
  it("shares one in-flight call between concurrent callers", async () => {
    let calls = 0;
    let release!: () => void;
    const load = singleFlight(() => {
      calls += 1;
      return new Promise<void>((r) => { release = r; });
    });
    const p1 = load.run();
    const p2 = load.run();
    const p3 = load.run();
    expect(calls).toBe(1);
    release();
    await Promise.all([p1, p2, p3]);
  });

  it("starts a fresh call once the previous one settled (resolved or rejected)", async () => {
    let calls = 0;
    const load = singleFlight(async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
    });
    await expect(load.run()).rejects.toThrow("boom");
    await load.run();
    expect(calls).toBe(2);
  });

  it("reset() forgets the in-flight call so the next caller starts its own", () => {
    let calls = 0;
    const load = singleFlight(() => {
      calls += 1;
      return new Promise<void>(() => {});
    });
    load.run();
    load.reset();
    load.run();
    expect(calls).toBe(2);
  });
});
