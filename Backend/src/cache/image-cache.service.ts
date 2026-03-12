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

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageCacheService implements OnModuleInit {
  private readonly logger = new Logger(ImageCacheService.name);
  private readonly imageDir: string;
  private readonly publicPrefix = '/img-cache';

  /** Downloads currently in-flight (prevents duplicate concurrent downloads). */
  private readonly inFlight = new Set<string>();

  constructor() {
    this.imageDir = path.resolve(process.cwd(), '.cache', 'images');
  }

  onModuleInit() {
    if (this.enabled) {
      fs.mkdirSync(this.imageDir, { recursive: true });
      this.logger.log(`Image cache ENABLED — storage: ${this.imageDir}`);
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
  localThumbnailPath(bookId: string, externalUrl: string): string | null {
    if (!this.enabled) return null;
    const ext = this.extFrom(externalUrl);
    const rel = `${bookId}/thumbnail.${ext}`;
    const abs = path.join(this.imageDir, rel);

    if (fs.existsSync(abs)) {
      return `${this.publicPrefix}/${rel}`;
    }

    this.triggerDownload(externalUrl, abs);
    return null;
  }

  /**
   * Returns an array of resolved paths for each page.
   * Pages that are already cached → local path.
   * Pages not yet cached → external URL + background download triggered.
   */
  localPagePaths(
    bookId: string,
    chapterId: string,
    pages: string[],
    prefix: 'p' | 'ds',
  ): string[] {
    if (!this.enabled || pages.length === 0) return pages;

    const dir = path.join(this.imageDir, bookId, 'chapters', chapterId);
    fs.mkdirSync(dir, { recursive: true });

    const missing: Array<{ url: string; abs: string }> = [];
    const result = pages.map((url, i) => {
      const ext = this.extFrom(url);
      const filename = `${prefix}${i}.${ext}`;
      const abs = path.join(dir, filename);

      if (fs.existsSync(abs)) {
        return `${this.publicPrefix}/${bookId}/chapters/${chapterId}/${filename}`;
      }

      missing.push({ url, abs });
      return url; // fall back to external URL for this request
    });

    if (missing.length > 0) {
      this.downloadBatch(missing, 4).catch(() => {
        // errors already logged inside downloadFile
      });
    }

    return result;
  }

  /**
   * Returns local /img-cache/… paths for every cover in a manga.
   * Already-downloaded covers → local path; others → external URL + background download.
   * Storage: {mangaId}/covers/c{idx}.{ext}
   */
  localCoverPaths(mangaId: string, coverUrls: string[]): string[] {
    if (!this.enabled || coverUrls.length === 0) return coverUrls;

    const dir = path.join(this.imageDir, mangaId, 'covers');
    fs.mkdirSync(dir, { recursive: true });

    const missing: Array<{ url: string; abs: string }> = [];
    const result = coverUrls.map((url, i) => {
      const ext = this.extFrom(url);
      const filename = `c${i}.${ext}`;
      const abs = path.join(dir, filename);

      if (fs.existsSync(abs)) {
        return `${this.publicPrefix}/${mangaId}/covers/${filename}`;
      }

      missing.push({ url, abs });
      return url;
    });

    if (missing.length > 0) {
      this.downloadBatch(missing, 4).catch(() => {});
    }

    return result;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Checks whether a local public path (e.g. /img-cache/bookId/thumbnail.jpg)
   * still exists on disk. Use this to guard against stale Redis cache entries
   * pointing to files that were deleted (e.g. cache dir wiped after restart).
   */
  localPathExists(localPublicPath: string): boolean {
    if (!localPublicPath.startsWith(this.publicPrefix)) return false;
    const rel = localPublicPath.slice(this.publicPrefix.length + 1); // strip /img-cache/
    const abs = path.join(this.imageDir, rel);
    return fs.existsSync(abs);
  }

  /**
   * Returns true when at least one cached page image exists for a chapter.
   * Used by forceLocal chapter list to decide whether reader should be unlocked.
   */
  hasChapterCache(bookId: string, chapterId: string): boolean {
    if (!this.enabled) return false;
    const dir = path.join(this.imageDir, bookId, 'chapters', chapterId);
    if (!fs.existsSync(dir)) return false;
    try {
      const files = fs.readdirSync(dir);
      return files.some((name) => /^(p|ds)\d+\./i.test(name));
    } catch {
      return false;
    }
  }

  /** Fire-and-forget single file download (deduped). */
  private triggerDownload(url: string, dest: string): void {
    if (this.inFlight.has(dest) || fs.existsSync(dest)) return;
    this.inFlight.add(dest);
    this.downloadFile(url, dest)
      .catch((err) =>
        this.logger.warn(`Download failed [${path.basename(dest)}]: ${String(err)}`),
      )
      .finally(() => this.inFlight.delete(dest));
  }

  /** Download a batch with limited concurrency (sequential batches of `limit`). */
  private async downloadBatch(
    items: Array<{ url: string; abs: string }>,
    limit: number,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += limit) {
      const batch = items.slice(i, i + limit);
      await Promise.allSettled(
        batch.map(({ url, abs }) => {
          if (this.inFlight.has(abs) || fs.existsSync(abs)) return Promise.resolve();
          this.inFlight.add(abs);
          return this.downloadFile(url, abs)
            .catch((err) =>
              this.logger.warn(`Page download failed: ${String(err)}`),
            )
            .finally(() => this.inFlight.delete(abs));
        }),
      );
    }
  }

  /** Download a single URL to disk using an atomic write. */
  private async downloadFile(url: string, dest: string): Promise<void> {
    if (fs.existsSync(dest)) return; // double-check (race)

    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const res = await fetch(url, {
      headers: { 'User-Agent': 'MangaDock-ImageCache/1.0' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const buffer = await res.arrayBuffer();
    const tmp = `${dest}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(buffer));
    fs.renameSync(tmp, dest); // near-atomic on same filesystem
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
