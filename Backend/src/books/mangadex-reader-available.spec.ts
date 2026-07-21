/**
 * Hotfix: the per-chapter Cloudflare Worker GET /v1/list amplification.
 *
 * MangaDexService.attachLocalStatus() used to fire one imageCache.hasChapterCache()
 * (== one R2 /v1/list) per chapter on EVERY chapter-list load — including the
 * Redis cache-hit path — so an N-chapter manga cost N Class-A list ops per load,
 * multiplied by every (re)fetch. readerAvailable is only consumed by the UI when
 * forceLocal (offline toggle) or isOfflineFallback (stale cache) is set
 * (HeroDetailButton.tsx:33, BookDetailModal chapterNeedsBackup === isOfflineFallback),
 * so the fan-out must be gated on exactly those conditions.
 */
import { MangaDexService } from './mangadex.service';

function makeService(opts: {
  enabled: boolean;
  chapters?: Array<{ id: string; pageCount: number }>;
}) {
  const chapters = opts.chapters ?? [
    { id: 'c1', pageCount: 1 },
    { id: 'c2', pageCount: 1 },
    { id: 'c3', pageCount: 1 },
  ];
  const hasChapterCache = jest.fn().mockResolvedValue(true);
  const imageCache: any = { enabled: opts.enabled, hasChapterCache };
  // cache HIT → getMangaChapters short-circuits straight into attachLocalStatus
  const cache: any = { get: jest.fn().mockResolvedValue({ data: chapters }) };
  const statusService: any = {};
  const service = new MangaDexService(cache, imageCache, statusService);
  return { service, hasChapterCache, chapters };
}

describe('MangaDexService readerAvailable — R2 /v1/list gating (hotfix)', () => {
  it('does NOT fan out per-chapter /v1/list on default browsing (forceLocal=false)', async () => {
    const { service, hasChapterCache } = makeService({ enabled: true });
    const out = await service.getMangaChapters('manga-1', false);
    expect(hasChapterCache).not.toHaveBeenCalled();
    expect(out.every((c: any) => c.readerAvailable === false)).toBe(true);
  });

  it('fans out one hasChapterCache per chapter only when forceLocal=true', async () => {
    const { service, hasChapterCache, chapters } = makeService({
      enabled: true,
    });
    const out = await service.getMangaChapters('manga-1', true);
    expect(hasChapterCache).toHaveBeenCalledTimes(chapters.length);
    expect(out.every((c: any) => c.readerAvailable === true)).toBe(true);
  });

  it('never fans out when the image cache is disabled', async () => {
    const { service, hasChapterCache } = makeService({ enabled: false });
    await service.getMangaChapters('manga-1', true);
    expect(hasChapterCache).not.toHaveBeenCalled();
  });
});
