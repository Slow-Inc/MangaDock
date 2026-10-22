/**
 * #961: (1) a chapter list cut short by a failed feed page was cached as the whole list; (2) new-releases with a tag
 * it could not resolve dropped the filter and read/wrote the untagged cache entry.
 */
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MangaDexService } from './mangadex.service';

type Internals = {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
};

const chapter = (n: number) => ({
  id: `c${n}`,
  attributes: { chapter: String(n), translatedLanguage: 'en', pages: 10 },
});

function makeService(opts: {
  fetch: (url: string) => Response;
  stale?: unknown;
  cached?: Record<string, unknown>;
}) {
  const cache = {
    get: jest.fn((key: string) =>
      Promise.resolve(
        opts.cached && key in opts.cached ? { data: opts.cached[key] } : null,
      ),
    ),
    set: jest.fn(() => Promise.resolve()),
    getStale: jest.fn(() =>
      opts.stale ? { data: opts.stale, updatedAt: 'then' } : null,
    ),
  };
  const service = new MangaDexService(
    cache as never,
    { enabled: false } as never,
    { broadcastStatus: jest.fn() } as never,
  );
  (service as unknown as Internals).fetchFn = (url) =>
    Promise.resolve(opts.fetch(url));
  return { service, cache };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('MangaDexService.getMangaChapters — a cut-short list is not cached (#961)', () => {
  const pagedFeed = (url: string) =>
    url.includes('offset=0')
      ? json({
          total: 1100,
          data: Array.from({ length: 500 }, (_, i) => chapter(i)),
        })
      : json({ result: 'error' }, 503);

  it('a failed second page: the 500 chapters are cached only briefly, not for the full TTL', async () => {
    const { service, cache } = makeService({ fetch: pagedFeed });
    const chapters = await service.getMangaChapters('m1');
    expect(chapters).toHaveLength(500); // still shown
    // a short entry spares MangaDex a full re-fetch on every request while it is failing, then the full list is retried
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect((cache.set.mock.calls[0] as unknown[])[2]).toBe(60_000);
  });

  it('a failed second page with a stale full list: the stale list is served', async () => {
    const stale = Array.from({ length: 1100 }, (_, i) => ({
      id: `s${i}`,
      chapterNumber: String(i),
      title: null,
      translatedLanguage: 'en',
      uploadedAt: '',
      pageCount: 10,
    }));
    const { service } = makeService({ fetch: pagedFeed, stale });
    const chapters = await service.getMangaChapters('m1');
    expect(chapters).toHaveLength(1100);
  });

  it('a complete list is still cached', async () => {
    const { service, cache } = makeService({
      fetch: () =>
        json({ total: 3, data: [chapter(1), chapter(2), chapter(3)] }),
    });
    await service.getMangaChapters('m1');
    expect(cache.set).toHaveBeenCalledTimes(1);
  });
});

describe('MangaDexService.getNewReleases — an unresolved tag never uses the untagged cache (#961)', () => {
  const untaggedKey = 'new-releases:v3:1:28';

  it('the tag list could not be loaded → 503, no untagged cache read, no fetch', async () => {
    const seen: string[] = [];
    const { service, cache } = makeService({
      fetch: (url) => {
        seen.push(url);
        return json({ result: 'error' }, 503);
      },
      cached: { [untaggedKey]: { new: { items: [], total: 0 } } },
    });
    await expect(
      service.getNewReleases(1, 28, 'Action'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(cache.get).not.toHaveBeenCalledWith(untaggedKey);
    expect(seen.filter((u) => u.includes('/manga?'))).toHaveLength(0);
  });

  it('the tag list is known but has no such tag → 404', async () => {
    const { service, cache } = makeService({
      fetch: () => json({ data: [] }),
      cached: { 'mangadex:tags:v1': { Action: 'tag-action' } },
    });
    await expect(service.getNewReleases(1, 28, 'Nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(cache.get).not.toHaveBeenCalledWith(untaggedKey);
  });
});
