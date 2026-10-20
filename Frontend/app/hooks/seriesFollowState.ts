// Pure list helpers for useSeriesFollow — no React / Supabase imports so they unit-test in isolation.

export type FollowedSeries = {
  id: string;
  title: string;
  thumbnail: string;
  followedAt: string;
};

export type RemovedFollow = { index: number; item: FollowedSeries } | null;

/** Remove `id` from the list, keeping where it was so a failed unfollow can be undone exactly. */
export function removeFollowItem(
  items: FollowedSeries[],
  id: string,
): { items: FollowedSeries[]; snapshot: RemovedFollow } {
  const index = items.findIndex((f) => f.id === id);
  if (index === -1) return { items, snapshot: null };
  return {
    items: [...items.slice(0, index), ...items.slice(index + 1)],
    snapshot: { index, item: items[index] },
  };
}

/** Put a removed item back at its original position (clamped if the list shrank meanwhile). */
export function restoreFollowItem(items: FollowedSeries[], snapshot: RemovedFollow): FollowedSeries[] {
  if (!snapshot) return items;
  const index = Math.min(snapshot.index, items.length);
  return [...items.slice(0, index), snapshot.item, ...items.slice(index)];
}
