import type { MangaChapter } from "./types/manga";

/**
 * Chapter access gating (#302) — extracted verbatim from BookDetailModal's inline
 * predicates so the coin-unlock business logic (money-adjacent) is pure and
 * unit-testable instead of being closures over component state.
 *
 * The only external input is the set of version ids the current user has unlocked;
 * everything else is read off the chapter itself.
 */
export interface ChapterAccessCtx {
  /** versionIds the current user already owns (coin-unlocked). */
  unlockedVersions: Set<string>;
}

export interface ChapterAccess {
  /** A user-uploaded, priced chapter the user has not unlocked yet. */
  coinLocked: boolean;
  /** The chapter can be opened in the reader right now. */
  readable: boolean;
  /** Why the chapter is unavailable — only meaningful when `readable` is false. */
  unavailableLabel: string;
}

/** Offline-fallback chapters need an explicit reader-available flag to open. */
const chapterNeedsBackup = (ch: MangaChapter): boolean =>
  ch.isOfflineFallback === true;

/** A user upload the backend no longer has. */
const chapterMissingInBackend = (ch: MangaChapter): boolean =>
  ch.source === "user" && ch.backendAvailable === false;

function chapterCoinLocked(
  ch: MangaChapter,
  unlockedVersions: Set<string>,
): boolean {
  if (chapterMissingInBackend(ch)) return false;
  if (ch.source !== "user") return false;
  if (!ch.priceCoins || ch.priceCoins <= 0) return false;
  if (!ch.versionId) return false;
  return !unlockedVersions.has(ch.versionId);
}

function chapterReadable(
  ch: MangaChapter,
  unlockedVersions: Set<string>,
): boolean {
  if (chapterMissingInBackend(ch)) {
    return false;
  }
  if (chapterNeedsBackup(ch)) {
    return ch.readerAvailable === true;
  }
  if (chapterCoinLocked(ch, unlockedVersions)) return false;
  return ch.pageCount > 0;
}

function unavailableChapterLabel(
  ch: MangaChapter,
  unlockedVersions: Set<string>,
): string {
  if (chapterMissingInBackend(ch)) {
    return "ไม่มีใน backend";
  }
  if (chapterNeedsBackup(ch) && ch.readerAvailable !== true) {
    return "ไม่ได้สำรอง";
  }
  if (chapterCoinLocked(ch, unlockedVersions)) {
    return `🪙 ${ch.priceCoins}`;
  }
  return "ล็อค";
}

/**
 * Resolve a chapter's access state. Behaviour is identical to the three inline
 * predicates it replaces — same early-return order, same labels.
 */
export function chapterAccess(
  ch: MangaChapter,
  { unlockedVersions }: ChapterAccessCtx,
): ChapterAccess {
  return {
    coinLocked: chapterCoinLocked(ch, unlockedVersions),
    readable: chapterReadable(ch, unlockedVersions),
    unavailableLabel: unavailableChapterLabel(ch, unlockedVersions),
  };
}
