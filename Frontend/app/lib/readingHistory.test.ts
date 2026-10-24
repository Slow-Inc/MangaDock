import { describe, expect, test } from "bun:test";
import { mergeRemoteHistory } from "./readingHistory";

type MergeableEntry = Parameters<typeof mergeRemoteHistory>[0][number];

const e = (id: string, lastReadAt: number, extra: Partial<MergeableEntry> = {}): MergeableEntry => ({ id, lastReadAt, ...extra });

describe("mergeRemoteHistory: server history wins, local display-only fields survive (#814)", () => {
  test("keeps the local chapter number and cached thumbnail when the server entry is for the same chapter", () => {
    const local = [e("a", 100, { lastChapterId: "c1", lastChapterNumber: "12", thumbnailLocal: "/img-cache/a.jpg" })];
    const remote = [e("a", 200, { lastChapterId: "c1" })];
    expect(mergeRemoteHistory(local, remote, 30)).toEqual([
      e("a", 200, { lastChapterId: "c1", lastChapterNumber: "12", thumbnailLocal: "/img-cache/a.jpg" }),
    ]);
  });

  test("drops the local chapter number when the server says a different chapter was read", () => {
    const local = [e("a", 100, { lastChapterId: "c1", lastChapterNumber: "12" })];
    const remote = [e("a", 200, { lastChapterId: "c2" })];
    expect(mergeRemoteHistory(local, remote, 30)).toEqual([e("a", 200, { lastChapterId: "c2" })]);
  });

  test("a chapterless entry keeps its cached thumbnail (server null vs local undefined)", () => {
    const local = [e("a", 100, { thumbnailLocal: "/img-cache/a.jpg" })];
    const remote = [e("a", 200, { lastChapterId: null })];
    expect(mergeRemoteHistory(local, remote, 30)).toEqual([e("a", 200, { lastChapterId: null, thumbnailLocal: "/img-cache/a.jpg" })]);
  });

  test("keeps local-only entries, newest first, capped", () => {
    const local = [e("x", 300), e("a", 100)];
    const remote = [e("a", 200), e("b", 50)];
    expect(mergeRemoteHistory(local, remote, 2).map((b) => b.id)).toEqual(["x", "a"]);
  });
});
