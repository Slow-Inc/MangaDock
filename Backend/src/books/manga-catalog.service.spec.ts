import { MangaCatalogService } from './manga-catalog.service';

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
  const builder: any = {
    select: jest.fn(() => builder),
    or: jest.fn(() => builder),
    eq: jest.fn(async () => ({ data: rows, error: error ?? null })),
  };
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

    expect(mangaDex.fetchMangaByIds).toHaveBeenCalledWith(['b']);
    expect(out).toEqual({ items: [{ id: 'a' }, { id: 'b' }], total: 2 });
    expect(cache.set).toHaveBeenCalledTimes(1);
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
    expect(mangaDex.getMangaChapters).toHaveBeenCalledWith('m1', true);
    await svc.getNewReleases(2, 10, 'tag');
    expect(mangaDex.getNewReleases).toHaveBeenCalledWith(2, 10, 'tag');
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
    );
    expect(out).toEqual({ items: [{ id: 'a' }], total: 1 });
  });
});
