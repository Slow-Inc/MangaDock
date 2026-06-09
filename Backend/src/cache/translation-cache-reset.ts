/**
 * Pure selection + orchestration for wiping the translated-patch caches (#MIT-debug).
 *
 * Re-translating during MIT debugging is defeated by every cache layer happily
 * replaying the previous result. This module decides *which* cache entries belong
 * to the translated-patch set and drives their deletion through injected ports —
 * so the real fs/Redis CLI stays a thin shell and the dangerous part (don't nuke
 * `forum:*` / `search:*` / `mangadex:*`) is unit-tested with fakes.
 *
 * The selection rule mirrors `patchCacheKey()` in books.service.ts: the patch
 * cache is the single namespace prefixed `translate:manga-patches:`. Any sibling
 * `translate:*` namespace (e.g. a glossary) is intentionally NOT swept.
 */

export const TRANSLATED_PATCH_PREFIX = 'translate:manga-patches:';

/** True iff `key` addresses the translated per-page patch cache. Mirrors the
 *  key built by BooksService.patchCacheKey — keep the two in lockstep. */
export function isTranslatedPatchCacheKey(key: string): boolean {
  return key.startsWith(TRANSLATED_PATCH_PREFIX);
}

/** Side-effecting boundary. Each port lists or deletes one storage layer; the
 *  orchestrator never imports fs/ioredis directly so it stays unit-testable. */
export interface CacheResetPorts {
  /** Every Redis key (unfiltered — the orchestrator applies the patch filter). */
  listRedisKeys(): Promise<string[]>;
  /** Delete the given keys; returns how many were actually removed. */
  deleteRedisKeys(keys: string[]): Promise<number>;
  /** Canonical keys of all L3 disk cache entries. */
  listL3Keys(): Promise<string[]>;
  /** Delete the L3 disk entry for one canonical key. */
  deleteL3Key(key: string): Promise<void>;
  /** Chapter ids that own a PatchStore PNG directory. */
  listPatchChapters(): Promise<string[]>;
  /** Remove one chapter's PNG directory; returns the file count removed. */
  deletePatchChapter(chapterId: string): Promise<number>;
}

export interface CacheResetReport {
  redisKeys: number;
  l3Files: number;
  patchChapters: number;
  patchFiles: number;
}

/** Wipe every translated-patch cache layer. Best-effort per layer: a failure in
 *  one chapter/key is logged by the caller's port and never aborts the sweep. */
export async function resetTranslationCache(
  ports: CacheResetPorts,
): Promise<CacheResetReport> {
  const report: CacheResetReport = {
    redisKeys: 0,
    l3Files: 0,
    patchChapters: 0,
    patchFiles: 0,
  };

  // Redis — one DEL for the matching keys.
  const redisVictims = (await ports.listRedisKeys()).filter(
    isTranslatedPatchCacheKey,
  );
  if (redisVictims.length > 0) {
    report.redisKeys = await ports.deleteRedisKeys(redisVictims);
  }

  // L3 disk — delete the file behind each matching canonical key.
  for (const key of (await ports.listL3Keys()).filter(
    isTranslatedPatchCacheKey,
  )) {
    try {
      await ports.deleteL3Key(key);
      report.l3Files += 1;
    } catch {
      /* skip undeletable entry, keep sweeping */
    }
  }

  // PatchStore PNGs — the whole `uploads/patches/<chapterId>` tree is translated output.
  for (const chapterId of await ports.listPatchChapters()) {
    try {
      const files = await ports.deletePatchChapter(chapterId);
      report.patchChapters += 1;
      report.patchFiles += files;
    } catch {
      /* skip undeletable chapter, keep sweeping */
    }
  }

  return report;
}
