/**
 * ImageCacheService — local image fallback system.
 *
 * Controlled by env var IMAGE_CACHE_ENABLED=true|false
 * (set to false for Vercel / serverless where the filesystem is ephemeral).
 *
 * How it works:
 *  1. Every time a book/chapter response is built, this service is asked
 *     for each external image URL.
 *  2. If the local file already exists → returns the local /img-cache/… path.
 *  3. If not → returns null / falls back to external URL, and triggers a
 *     background download so the next request will find the file.
 *  4. Downloads are batched with a configurable concurrency cap.
 *
 * Storage layout (all under .cache/images/):
 *   thumbnails  →  {bookId}/thumbnail.{ext}
 *   pages       →  {bookId}/chapters/{chapterId}/p{idx}.{ext}
 *   data-saver  →  {bookId}/chapters/{chapterId}/ds{idx}.{ext}
 *
 * The public URL used in API responses is /img-cache/{relPath},
 * served as a NestJS static assets route from main.ts.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../common/storage/storage-provider.interface';

@Injectable()
export class ImageCacheService implements OnModuleInit {
  private readonly logger = new Logger(ImageCacheService.name);
  private readonly imageDir = 'img-cache';
  private readonly publicPrefix = '/img-cache';

  /** Downloads currently in-flight (prevents duplicate concurrent downloads). */
  private readonly inFlight = new Set<string>();

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async onModuleInit() {
    if (this.enabled) {
      if (this.storage.ensureDir) {
        await this.storage.ensureDir(this.imageDir);
      }
      this.logger.log(`Image cache ENABLED — prefix: ${this.imageDir}`);
    } else {
      this.logger.log(
        'Image cache DISABLED (set IMAGE_CACHE_ENABLED=true to enable)',
      );
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  get enabled(): boolean {
    return process.env.IMAGE_CACHE_ENABLED === 'true';
  }

  /**
   * Returns a local /img-cache/… path if the thumbnail is already cached,
   * otherwise triggers a background download and returns null (caller keeps
   * using the external URL for this request).
   */
  async localThumbnailPath(
    bookId: string,
    externalUrl: string,
  ): Promise<string | null> {
    if (!this.enabled) return null;
    const ext = this.extFrom(externalUrl);
    const rel = `${bookId}/thumbnail.${ext}`;
    const key = `${this.imageDir}/${rel}`;

    if (await this.storage.exists(key)) {
      return `${this.publicPrefix}/${rel}`;
    }

    this.triggerDownload(externalUrl, key);
    return null;
  }

  /**
   * Returns an array of resolved paths for each page.
   * Pages that are already cached → local path.
   * Pages not yet cached → external URL + background download triggered.
   */
  async localPagePaths(
    bookId: string,
    chapterId: string,
    pages: string[],
    prefix: 'p' | 'ds',
  ): Promise<string[]> {
    if (!this.enabled || pages.length === 0) return pages;

    const dir = `${this.imageDir}/${bookId}/chapters/${chapterId}`;

    // One list(dir) instead of one exists() per page (FR-19).
    const cached = await this.listBasenames(dir);

    const missing: Array<{ url: string; key: string }> = [];
    const results = pages.map((url, i) => {
      const ext = this.extFrom(url);
      const filename = `${prefix}${i}.${ext}`;
      const key = `${dir}/${filename}`;

      if (cached.has(filename)) {
        return `${this.publicPrefix}/${bookId}/chapters/${chapterId}/${filename}`;
      }

      missing.push({ url, key });
      return url; // fall back to external URL for this request
    });

    if (missing.length > 0) {
      this.downloadBatch(missing, 4).catch(() => {
        // errors already logged inside downloadFile
      });
    }

    return results;
  }

  /**
   * Returns local /img-cache/… paths for every cover in a manga.
   * Already-downloaded covers → local path; others → external URL + background download.
   * Storage: {mangaId}/covers/c{idx}.{ext}
   */
  async localCoverPaths(
    mangaId: string,
    coverUrls: string[],
  ): Promise<string[]> {
    if (!this.enabled || coverUrls.length === 0) return coverUrls;

    const dir = `${this.imageDir}/${mangaId}/covers`;

    // One list(dir) instead of one exists() per cover (FR-19).
    const cached = await this.listBasenames(dir);

    const missing: Array<{ url: string; key: string }> = [];
    const results = coverUrls.map((url, i) => {
      const ext = this.extFrom(url);
      const filename = `c${i}.${ext}`;
      const key = `${dir}/${filename}`;

      if (cached.has(filename)) {
        return `${this.publicPrefix}/${mangaId}/covers/${filename}`;
      }

      missing.push({ url, key });
      return url;
    });

    if (missing.length > 0) {
      this.downloadBatch(missing, 4).catch(() => {});
    }

    return results;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Lists a directory once and returns the set of bare filenames it contains,
   * so callers can membership-check many items with a single storage.list()
   * call instead of one storage.exists() per item (FR-19). Tolerates both
   * disk-style listings (bare filenames) and R2-style listings (full keys) by
   * reducing every entry to its basename. Returns an empty set on error.
   */
  private async listBasenames(dir: string): Promise<Set<string>> {
    try {
      const entries = await this.storage.list(dir);
      return new Set(entries.map((e) => e.split('/').pop() ?? e));
    } catch {
      return new Set();
    }
  }

  /**
   * Checks whether a local public path (e.g. /img-cache/bookId/thumbnail.jpg)
   * still exists on disk. Use this to guard against stale Redis cache entries
   * pointing to files that were deleted (e.g. cache dir wiped after restart).
   */
  async localPathExists(localPublicPath: string): Promise<boolean> {
    if (!localPublicPath.startsWith(this.publicPrefix)) return false;
    const rel = localPublicPath.slice(this.publicPrefix.length + 1); // strip /img-cache/
    const key = `${this.imageDir}/${rel}`;
    return await this.storage.exists(key);
  }

  /**
   * Returns true when at least one cached page image exists for a chapter.
   * Used by forceLocal chapter list to decide whether reader should be unlocked.
   */
  async hasChapterCache(bookId: string, chapterId: string): Promise<boolean> {
    if (!this.enabled) return false;
    const dir = `${this.imageDir}/${bookId}/chapters/${chapterId}`;
    try {
      const files = await this.storage.list(dir);
      return files.some((name) => /^(p|ds)\d+\./i.test(name));
    } catch {
      return false;
    }
  }

  /** Fire-and-forget single file download (deduped). */
  private triggerDownload(url: string, key: string): void {
    this.storage.exists(key).then((exists) => {
      if (exists || this.inFlight.has(key)) return;
      this.inFlight.add(key);
      this.downloadFile(url, key)
        .catch((err) =>
          this.logger.warn(`Download failed [${key}]: ${String(err)}`),
        )
        .finally(() => this.inFlight.delete(key));
    });
  }

  /** Download a batch with limited concurrency (sequential batches of `limit`). */
  private async downloadBatch(
    items: Array<{ url: string; key: string }>,
    limit: number,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += limit) {
      const batch = items.slice(i, i + limit);
      await Promise.allSettled(
        batch.map(async ({ url, key }) => {
          if (this.inFlight.has(key) || (await this.storage.exists(key)))
            return Promise.resolve();
          this.inFlight.add(key);
          return this.downloadFile(url, key)
            .catch((err) =>
              this.logger.warn(`Page download failed: ${String(err)}`),
            )
            .finally(() => this.inFlight.delete(key));
        }),
      );
    }
  }

  /** Download a single URL to storage using an atomic write. */
  private async downloadFile(url: string, key: string): Promise<void> {
    if (await this.storage.exists(key)) return;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'MangaDock-ImageCache/1.0' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const buffer = await res.arrayBuffer();
    await this.storage.put(key, Buffer.from(buffer));
  }

  /** Extract file extension from a URL, defaulting to 'jpg'. */
  private extFrom(url: string): string {
    try {
      const m = new URL(url).pathname.match(/\.(\w+)$/);
      return m?.[1]?.toLowerCase() ?? 'jpg';
    } catch {
      return 'jpg';
    }
  }
}
