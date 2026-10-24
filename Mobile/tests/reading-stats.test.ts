import test from "node:test";
import assert from "node:assert/strict";
import { readingStats } from "../src/reading-stats.ts";
test("reading statistics retain the original latest-series semantics, local days and top genre counts", () => {
  const now = new Date(2026, 9, 4, 12).getTime();
  const history = [
    {
      id: "a",
      title: "A",
      thumbnail: "",
      lastReadAt: now,
      categories: ["Action", "Drama"],
    },
    {
      id: "b",
      title: "B",
      thumbnail: "",
      lastReadAt: new Date(2026, 9, 3, 12).getTime(),
      categories: ["Drama"],
    },
    {
      id: "c",
      title: "C",
      thumbnail: "",
      lastReadAt: new Date(2026, 8, 20, 12).getTime(),
      categories: ["Comedy"],
    },
  ];
  const stats = readingStats(history, now);
  assert.equal(stats.totalSeries, 3);
  assert.equal(stats.recentCount, 2);
  assert.equal(stats.streak, 2);
  assert.deepEqual(stats.genres[0], { genre: "Drama", count: 2 });
  assert.equal(stats.activity[0], 2);
  assert.equal(stats.activity[6], 1);
  assert.equal(readingStats([], now).streak, 0);
});
