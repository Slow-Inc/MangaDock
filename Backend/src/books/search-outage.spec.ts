/**
 * #970: a MangaDex outage answered search and genre listings as "200, no results". The browser then showed
 * "ไม่พบหนังสือ" instead of its load-error state, cached the empty answer (search 5 min, genre 30 min), and a
 * year-range search cached it server-side for 20 min. An outage must answer 503 and leave no cache entry.
 */
import { ServiceUnavailableException } from '@nestjs/common';
import { MangaDexService } from './mangadex.service';
import { MangaCatalogService } from './manga-catalog.service';

function makeCache() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMangaDex(answer: () => Promise<Response>) {
  const cache = makeCache();
  const service = new MangaDexService(
    cache as never,
    {} as never,
    { broadcastStatus: jest.fn() } as never,
  );
  (service as unknown as { fetchFn: () => Promise<Response> }).fetchFn = answer;
  return { service, cache };
}

const down = () => Promise.resolve(new Response('', { status: 503 }));
const unreachable = () => Promise.reject(new Error('ECONNRESET'));

function makeCatalog(searchManga: jest.Mock) {
  const cache = makeCache();
  // chapter_versions alt-name lookup: no matches
  const supabaseBuilder: Record<string, jest.Mock> = {};
  supabaseBuilder.select = jest.fn(() => supabaseBuilder);
  supabaseBuilder.or = jest.fn(() => supabaseBuilder);
  supabaseBuilder.eq = jest.fn().mockResolvedValue({ data: [], error: null });
  const svc = new MangaCatalogService(
    { searchManga, fetchMangaByIds: jest.fn() } as never,
    { client: { from: jest.fn(() => supabaseBuilder) } } as never,
    cache as never,
  );
  return { svc, cache };
}

describe('MangaDex outage → 503, never an empty result (#970)', () => {
  it.each([
    ['a 503', down],
    ['a network error', unreachable],
  ])('the paged fetch marks %s as unavailable', async (_label, answer) => {
    const { service } = makeMangaDex(answer);
    const res = await service.searchManga('x');
    expect(res).toEqual({ items: [], total: 0, unavailable: true });
  });

  it('a 400 (our own bad request) is still just an empty answer', async () => {
    const { service } = makeMangaDex(() =>
      Promise.resolve(new Response('', { status: 400 })),
    );
    expect(await service.searchManga('x')).toEqual({ items: [], total: 0 });
  });

  it('search answers 503 and caches nothing', async () => {
    const { svc, cache } = makeCatalog(
      jest.fn().mockResolvedValue({ items: [], total: 0, unavailable: true }),
    );
    await expect(svc.searchBooks('x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('a year-range scan that hits the outage partway answers 503 and caches nothing', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`,
      publishedDate: '1990',
    }));
    const { svc, cache } = makeCatalog(
      jest
        .fn()
        .mockResolvedValueOnce({ items: full, total: 300 })
        .mockResolvedValueOnce({ items: [], total: 0, unavailable: true }),
    );
    await expect(
      svc.searchBooks('x', undefined, 28, 0, undefined, 2010, 2015),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it.each([
    ['a 503', down],
    ['a network error', unreachable],
  ])(
    'a genre listing answers 503 on %s and caches nothing',
    async (_label, answer) => {
      const { service, cache } = makeMangaDex(answer);
      await expect(service.getGenreManga('action')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(cache.set).not.toHaveBeenCalled();
    },
  );

  it('new releases answer 503 when every row is down', async () => {
    const { service, cache } = makeMangaDex(down);
    await expect(service.getNewReleases()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('new releases with one row down: the rest is served, nothing cached, no flag in the answer', async () => {
    const ok = JSON.stringify({ data: [], total: 0 });
    const { service, cache } = makeMangaDex(() =>
      Promise.reject(new Error('unused')),
    );
    let calls = 0;
    (service as unknown as { fetchFn: () => Promise<Response> }).fetchFn =
      () =>
        ++calls === 3
          ? down()
          : Promise.resolve(new Response(ok, { status: 200 }));
    const res = await service.getNewReleases();
    expect(JSON.stringify(res)).not.toContain('unavailable');
    expect(cache.set).not.toHaveBeenCalled();
  });
});
