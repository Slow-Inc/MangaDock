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
 *  `__` separators keep parsing unambiguous (model ids contain `-`). Anything
 *  in a chapter dir NOT matching this is a legacy orphan from the three old
 *  ad-hoc naming formulas and is removed by sweepLegacy(). */
const OWNED_NAME = /^[^_]+(?:__[^_]+){2}__p\d+__r\d+\.png$/;

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
    const dir = this.chapterDir(loc.chapterId);
    const filePrefix = this.pageFilePrefix(loc);
    const urls: string[] = [];

    for (let i = 0; i < pngs.length; i += 1) {
      const key = `${dir}/${filePrefix}${i}.png`;
      await this.storage.put(key, pngs[i], { contentType: 'image/png' });
      urls.push(`${this.origin()}/${key}`);
    }

    const names = await this.storage.list(dir);
    for (const name of names) {
      if (!name.startsWith(filePrefix)) continue;
      const region = Number(name.slice(filePrefix.length).replace(/\.png$/, ''));
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
          await this.storage.delete(`${dir}/${name}`);
          removed += 1;
        }
      }
    }
    return removed;
  }

  /** Sweep the legacy backlog now and once a day; timer never blocks exit. */
  startSweeping(onSwept?: (removed: number) => void): void {
    const run = () =>
      void this.sweepLegacy()
        .then((n) => onSwept?.(n))
        .catch(() => {});
    run();
    setInterval(run, 24 * 60 * 60 * 1000).unref();
  }
}
