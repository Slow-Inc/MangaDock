import { MangaCatalogService } from './manga-catalog.service';
import { OFF_SCOPE } from '../common/content-rating';

/**
 * MangaDex catalog passthrough + search (#231, PRD #228 step 6). searchBooks
 * serves from cache, else queries MangaDex and enhances the result with
 * user-uploaded alt-name matches from chapter_versions — the alt-name lookup is
 * best-effort (a failure must never sink the base search). Passthroughs forward
 * to the same MangaDexService instance.
 */
function makeSupabase(
  rows: Array<{ title_id: string }> | null,
  error?: unknown,
) {
  const result = { data: rows, error: error ?? null };
  // eq() is awaitable (no timeout) and chains to abortSignal() (with one, #863)
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.or = jest.fn(() => builder);
  builder.eq = jest.fn(() => Object.assign(Promise.resolve(result), builder));
  builder.abortSignal = jest.fn(() => Promise.resolve(result));
  return { client: { from: jest.fn(() => builder) } };
}

function makeCache(hit?: unknown) {
  return {
    get: jest.fn(async () => (hit ? { data: hit, source: 'redis' } : null)),
    set: jest.fn().mockResolvedValue(undefined),
  };
}

describe('MangaCatalogService — search + passthrough (#231)', () => {
  it('serves search from cache without touching MangaDex', async () => {
    const cache = makeCache({ items: [{ id: 'a' }], total: 1 });
    const mangaDex = { searchManga: jest.fn(), fetchMangaByIds: jest.fn() };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    await expect(svc.searchBooks('naruto')).resolves.toEqual({
      items: [{ id: 'a' }],
      total: 1,
    });
    expect(mangaDex.searchManga).not.toHaveBeenCalled();
  });

  it('enhances results with alt-name matches not already present and caches them', async () => {
    const cache = makeCache(null);
    const mangaDex = {
      searchManga: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'a' }], total: 1 }),
      fetchMangaByIds: jest.fn().mockResolvedValue([{ id: 'b' }]),
    };
    const supabase = makeSupabase([{ title_id: 'a' }, { title_id: 'b' }]); // 'a' already present → only 'b' added
    const svc = new MangaCatalogService(
      mangaDex as any,
      supabase as any,
      cache as any,
    );

    const out = await svc.searchBooks('naruto');

    expect(mangaDex.fetchMangaByIds).toHaveBeenCalledWith(['b'], OFF_SCOPE);
    expect(out).toEqual({ items: [{ id: 'a' }, { id: 'b' }], total: 2 });
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('adds alt-name matches to the first page only, so later pages keep their size (#661)', async () => {
    const cache = makeCache(null);
    const page2 = Array.from({ length: 28 }, (_, i) => ({ id: `p2-${i}` }));
    const mangaDex = {
      searchManga: jest.fn().mockResolvedValue({ items: page2, total: 60 }),
      fetchMangaByIds: jest.fn().mockResolvedValue([{ id: 'alt' }]),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([{ title_id: 'alt' }]) as any,
      cache as any,
    );

    const out = await svc.searchBooks('naruto', undefined, 28, 28);

    expect(out.items).toHaveLength(28);
    expect(out.total).toBe(60);
    expect(mangaDex.fetchMangaByIds).not.toHaveBeenCalled();
  });

  it('swallows an alt-name lookup failure and returns the base search', async () => {
    const cache = makeCache(null);
    const mangaDex = {
      searchManga: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'a' }], total: 1 }),
      fetchMangaByIds: jest.fn(),
    };
    const supabase = makeSupabase(null, new Error('db down'));
    const svc = new MangaCatalogService(
      mangaDex as any,
      supabase as any,
      cache as any,
    );

    const out = await svc.searchBooks('naruto');

    expect(out).toEqual({ items: [{ id: 'a' }], total: 1 });
    expect(mangaDex.fetchMangaByIds).not.toHaveBeenCalled();
  });

  it('does not cache an empty search result', async () => {
    const cache = makeCache(null);
    const mangaDex = {
      searchManga: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    await svc.searchBooks('nothing');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('forwards passthroughs to the MangaDex service', async () => {
    const mangaDex = {
      getMangaChapters: jest.fn().mockResolvedValue(['ch']),
      getNewReleases: jest.fn().mockResolvedValue('releases'),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      makeCache(null) as any,
    );

    await expect(svc.getMangaChapters('m1', true)).resolves.toEqual(['ch']);
    expect(mangaDex.getMangaChapters).toHaveBeenCalledWith(
      'm1',
      true,
      OFF_SCOPE,
    );
    await svc.getNewReleases(2, 10, 'tag');
    expect(mangaDex.getNewReleases).toHaveBeenCalledWith(
      2,
      10,
      'tag',
      OFF_SCOPE,
    );
  });

  it('passes status param to MangaDex when provided', async () => {
    const cache = makeCache(null);
    const mangaDex = {
      searchManga: jest.fn().mockResolvedValue({
        items: [{ id: 'a', publishedDate: '2020' }],
        total: 1,
      }),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    await svc.searchBooks('naruto', undefined, 100, 0, 'completed');

    expect(mangaDex.searchManga).toHaveBeenCalledWith(
      'naruto',
      undefined,
      100,
      0,
      'completed',
      OFF_SCOPE,
    );
  });

  it('filters results by yearFrom and yearTo', async () => {
    const cache = makeCache(null);
    const items = [
      { id: 'a', publishedDate: '2009' },
      { id: 'b', publishedDate: '2015' },
      { id: 'c', publishedDate: '2021' },
      { id: 'd', publishedDate: '' },
    ];
    const mangaDex = {
      searchManga: jest.fn().mockResolvedValue({ items, total: 4 }),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    const out = await svc.searchBooks(
      'naruto',
      undefined,
      100,
      0,
      undefined,
      2010,
      2020,
    );

    expect(out.items.map((b: any) => b.id)).toEqual(['b']);
    expect(out.total).toBe(1);
  });

  it('year range: scans past the first upstream page so deeper matches are reachable and total is not the page count (#661)', async () => {
    const cache = makeCache(null);
    // Upstream: 250 results; 3 in-range on page 1, 1 on page 2, 1 on page 3.
    const page = (start: number, hits: number[]) =>
      Array.from({ length: 100 }, (_, i) => ({
        id: `m${start + i}`,
        publishedDate: hits.includes(start + i) ? '2015' : '1999',
      }));
    const pages: Record<number, any[]> = {
      0: page(0, [5, 40, 90]),
      100: page(100, [150]),
      200: page(200, [210]).slice(0, 50),
    };
    const mangaDex = {
      searchManga: jest.fn(
        async (_q: string, _l: unknown, _lim: number, off: number) => ({
          items: pages[off] ?? [],
          total: 250,
        }),
      ),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    const out = await svc.searchBooks(
      'naruto',
      undefined,
      28,
      0,
      undefined,
      2010,
      2020,
    );

    expect(out.items.map((b: any) => b.id)).toEqual([
      'm5',
      'm40',
      'm90',
      'm150',
      'm210',
    ]);
    expect(out.total).toBe(5);

    // Page 2 of the filtered list (offset 2, limit 2) serves deeper matches.
    const page2 = await svc.searchBooks(
      'naruto',
      undefined,
      2,
      2,
      undefined,
      2010,
      2020,
    );
    expect(page2.items.map((b: any) => b.id)).toEqual(['m90', 'm150']);
    expect(page2.total).toBeGreaterThan(4);
  });

  it('year range: yearFrom-only and yearTo-only use distinct cache keys (#661)', async () => {
    const cache = makeCache(null);
    const mangaDex = {
      searchManga: jest.fn().mockResolvedValue({
        items: [{ id: 'a', publishedDate: '2010' }],
        total: 1,
      }),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    await svc.searchBooks('x', undefined, 28, 0, undefined, 2010);
    await svc.searchBooks('x', undefined, 28, 0, undefined, undefined, 2010);

    const [k1, k2] = cache.set.mock.calls.map((c: any[]) => c[0]);
    expect(k1).not.toEqual(k2);
  });

  it('year range: an empty result is cached too, so a miss does not rescan upstream (#661)', async () => {
    const cache = makeCache(null);
    const mangaDex = {
      searchManga: jest.fn().mockResolvedValue({
        items: [{ id: 'a', publishedDate: '1999' }],
        total: 1,
      }),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    const out = await svc.searchBooks(
      'x',
      undefined,
      28,
      0,
      undefined,
      2010,
      2015,
    );

    expect(out.items).toEqual([]);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('omitting new params returns same results as before (backward compat)', async () => {
    const cache = makeCache(null);
    const mangaDex = {
      searchManga: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'a' }], total: 1 }),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      makeSupabase([]) as any,
      cache as any,
    );

    const out = await svc.searchBooks('naruto');

    expect(mangaDex.searchManga).toHaveBeenCalledWith(
      'naruto',
      undefined,
      100,
      0,
      undefined,
      OFF_SCOPE,
    );
    expect(out).toEqual({ items: [{ id: 'a' }], total: 1 });
  });
});

describe('MangaCatalogService — a slow alt-name lookup does not hold up search (#863)', () => {
  it('gives up on the chapter_versions query at its budget and returns the MangaDex results', async () => {
    let aborted = false;
    // Supabase hangs (it did, 2026-10-21): the query settles only when its abort signal fires
    const builder: Record<string, jest.Mock> = {};
    builder.select = jest.fn(() => builder);
    builder.or = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.abortSignal = jest.fn(
      (signal: AbortSignal) =>
        new Promise((resolve) =>
          signal.addEventListener('abort', () => {
            aborted = true;
            resolve({ data: null, error: { message: 'AbortError' } });
          }),
        ),
    );
    const supabase = { client: { from: jest.fn(() => builder) } };
    const mangaDex = {
      searchManga: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'a' }], total: 1 }),
      fetchMangaByIds: jest.fn(),
    };
    const svc = new MangaCatalogService(
      mangaDex as any,
      supabase as any,
      makeCache(null) as any,
    );
    (svc as unknown as { altNameTimeoutMs: number }).altNameTimeoutMs = 50;

    const started = Date.now();
    await expect(svc.searchBooks('naruto')).resolves.toEqual({
      items: [{ id: 'a' }],
      total: 1,
    });
    expect(aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(mangaDex.fetchMangaByIds).not.toHaveBeenCalled();
  });
});
