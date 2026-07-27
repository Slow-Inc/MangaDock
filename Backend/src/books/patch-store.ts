import { createHash } from 'crypto';

import type { StorageProvider } from '../common/storage/storage-provider.interface';

export interface PatchLocator {
  chapterId: string;
  pageIndex: number;
  srcMIT: string;
  tgtMIT: string;
  /** Sanitized image-model segment; defaults to 'default' (matches jobKey/cache). */
  model?: string;
}

const ROOT = 'uploads/patches';

/** Filenames PatchStore owns: `{src}__{tgt}__{model}__p{page}__r{region}.png`.
 *  Ownership is detected by the `__p{N}__r{N}.png` tail — model ids may legally
 *  contain `_` (imageModelKey allows \w), so segment-wise matching would
 *  misclassify owned files as legacy and sweep them (data loss; caught in
 *  review). None of the three legacy formulas ever produced this tail. */
const OWNED_NAME = /__p\d+__r\d+\.png$/;

/** Charset every key segment must satisfy — same alphabet as imageModelKey.
 *  chapterId arrives from a URL param and segments become disk paths via the
 *  DiskStorageProvider join, so `/`, `\` and `..` must never pass. */
const SAFE_SEGMENT = /^[\w.-]+$/;

function assertSafeSegment(value: string, what: string): void {
  if (!SAFE_SEGMENT.test(value) || value.includes('..')) {
    throw new Error(
      `PatchStore: unsafe ${what} segment: ${JSON.stringify(value)}`,
    );
  }
}

/** User-uploaded "version" chapters are addressed as `ver:<uuid>`. The `:` is a
 *  valid id-scheme separator but not a valid path character, so map it to `_`
 *  before the segment is used as a directory name. Only `:` is normalized —
 *  every other unsafe char (`/`, `\`, `..`) still trips assertSafeSegment, so
 *  the traversal guard is unchanged. */
function toPathSegment(value: string): string {
  return value.replace(/:/g, '_');
}

/**
 * The single owner of Patch Set files on storage (#137).
 *
 * Deterministic names mean a re-translate overwrites instead of orphaning —
 * before this module, the webhook path random-suffixed every file, growing the
 * disk forever. Built on StorageProvider only (no direct fs) so the future R2
 * adapter inherits the same lifecycle.
 *
 * NOTE on list(): the disk adapter's `list(p)` is `readdir(p)` — one directory
 * level, basenames only (verified live; a prefix-style fake hid this until the
 * first real run). All traversal below works directory-by-directory.
 */
export class PatchStore {
  /** origin is a thunk because the backend origin is env-resolved per call. */
  constructor(
    private readonly storage: StorageProvider,
    private readonly origin: () => string,
  ) {}

  private chapterDir(chapterId: string): string {
    return `${ROOT}/${chapterId}`;
  }

  /** Filename prefix (no directory) for one page's region files. */
  private pageFilePrefix(loc: PatchLocator): string {
    const model = loc.model ?? 'default';
    return `${loc.srcMIT}__${loc.tgtMIT}__${model}__p${loc.pageIndex}__r`;
  }

  /** Write a page's Patch Set; returns public URLs aligned to the input order.
   *  Stale region files beyond the new count (page shrank on re-translate) are
   *  removed so the page's footprint is always exactly its current regions. */
  async put(loc: PatchLocator, pngs: Buffer[]): Promise<string[]> {
    const chapterId = toPathSegment(loc.chapterId);
    assertSafeSegment(chapterId, 'chapterId');
    assertSafeSegment(loc.srcMIT, 'srcMIT');
    assertSafeSegment(loc.tgtMIT, 'tgtMIT');
    if (loc.model !== undefined) assertSafeSegment(loc.model, 'model');

    const dir = this.chapterDir(chapterId);
    const filePrefix = this.pageFilePrefix(loc);
    // Normalize once per call: a trailing-slash origin must not produce `//`
    const origin = this.origin().replace(/\/+$/, '');

    // Region writes are independent (distinct deterministic keys, no shared
    // state), so run them concurrently. Promise.all keeps the input order for
    // the returned urls and preserves the old for-await loop's all-or-nothing
    // contract: any single write rejecting rejects put() and skips the
    // stale-cleanup below, exactly as before (allSettled would wrongly swallow
    // the failure).
    const urls = await Promise.all(
      pngs.map(async (png, i) => {
        const key = `${dir}/${filePrefix}${i}.png`;
        await this.storage.put(key, png, { contentType: 'image/png' });
        // Deterministic filenames mean a re-translate overwrites the PNG but keeps
        // the URL — so clients keep serving the stale cached patch (max-age=14400)
        // until it expires. A content-hash `?v=` makes the URL change iff the bytes
        // change: identical re-translate stays cached, changed patch busts it.
        const version = createHash('sha1')
          .update(png)
          .digest('hex')
          .slice(0, 12);
        return `${origin}/${key}?v=${version}`;
      }),
    );

    const names = await this.storage.list(dir);
    for (const name of names) {
      if (!name.startsWith(filePrefix)) continue;
      const region = Number(
        name.slice(filePrefix.length).replace(/\.png$/, ''),
      );
      if (Number.isFinite(region) && region >= pngs.length) {
        await this.storage.delete(`${dir}/${name}`);
      }
    }

    return urls;
  }

  /** Remove files not named by PatchStore — the random/ad-hoc backlog from the
   *  pre-#137 writers. Owned files are never swept: they are bounded by
   *  overwrite. Returns the number of removed files. */
  async sweepLegacy(): Promise<number> {
    const chapterDirs = await this.storage.list(ROOT);
    let removed = 0;
    for (const chapter of chapterDirs) {
      const dir = `${ROOT}/${chapter}`;
      const names = await this.storage.list(dir);
      for (const name of names) {
        if (!OWNED_NAME.test(name)) {
          // Best-effort per entry: readdir-based list() can surface stray
          // directories, and one EISDIR must not abort the whole sweep.
          try {
            await this.storage.delete(`${dir}/${name}`);
            removed += 1;
          } catch {
            /* skip undeletable entry, keep sweeping */
          }
        }
      }
    }
    return removed;
  }

  /** Sweep the legacy backlog now and once a day; timer never blocks exit.
   *  Failures surface through onError — a silently dead sweeper would let the
   *  legacy backlog grow again with no signal. */
  startSweeping(
    onSwept?: (removed: number) => void,
    onError?: (err: unknown) => void,
  ): void {
    const run = () =>
      void this.sweepLegacy()
        .then((n) => onSwept?.(n))
        .catch((err) => onError?.(err));
    run();
    setInterval(run, 24 * 60 * 60 * 1000).unref();
  }
}
