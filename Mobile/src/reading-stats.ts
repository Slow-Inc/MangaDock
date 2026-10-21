import type { HistoryBook } from "./personal.ts";
export function readingStats(history: HistoryBook[], now = Date.now()) {
  const books = [...history]
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .slice(0, 30);
  const days = new Set(
    books.map((book) => new Date(book.lastReadAt).toDateString()),
  );
  let streak = 0;
  for (let offset = 0; offset < 365; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    if (days.has(day.toDateString())) streak++;
    else if (offset > 0) break;
  }
  const counts = new Map<string, number>(),
    activity = Array<number>(7).fill(0);
  for (const book of books) {
    const day = new Date(book.lastReadAt).getDay();
    if (Number.isFinite(day)) activity[day]++;
    for (const genre of book.categories ?? [])
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  const genres = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }));
  return {
    totalSeries: books.length,
    recentCount: books.filter((book) => book.lastReadAt > now - 7 * 86_400_000)
      .length,
    streak,
    activity,
    genres,
  };
}
