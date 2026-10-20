/**
 * Merge server reading history into the local list (#814). The server is the source of truth for what was
 * read and when, but it does not store the display-only fields — so a local `lastChapterNumber` or
 * `thumbnailLocal` is kept when the server entry is for the same chapter. Without this every load erased the
 * chapter numbers and the backfill re-fetched every chapter list to rebuild them.
 */
export type MergeableEntry = {
  id: string;
  lastReadAt: number;
  lastChapterId?: string | null;
  lastChapterNumber?: string | null;
  thumbnailLocal?: string;
};

export function mergeRemoteHistory<T extends MergeableEntry>(local: T[], remote: T[], max: number): T[] {
  const localById = new Map(local.map((b) => [b.id, b]));
  const fromRemote = remote.map((r) => {
    const l = localById.get(r.id);
    if (!l || l.lastChapterId !== r.lastChapterId) return r;
    const kept: Partial<MergeableEntry> = {};
    if (l.lastChapterNumber !== undefined) kept.lastChapterNumber = l.lastChapterNumber;
    if (l.thumbnailLocal !== undefined) kept.thumbnailLocal = l.thumbnailLocal;
    return { ...r, ...kept };
  });
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((b) => !remoteIds.has(b.id));
  return [...fromRemote, ...localOnly].sort((a, b) => b.lastReadAt - a.lastReadAt).slice(0, max);
}
