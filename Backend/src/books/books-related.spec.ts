import { MangaCatalogService } from './manga-catalog.service';

/**
 * Unit tests for MangaCatalogService.getRelated (#325).
 * MangaDex + cache are fully stubbed — no network, no Redis.
 */

const BOOK_A = { id: 'a', title: 'A', subtitle: '', authors: [], description: '', thumbnail: '', publishedDate: '', categories: ['Action'], averageRating: 0, ratingsCount: 10 };
const BOOK_B = { id: 'b', title: 'B', subtitle: '', authors: [], description: '', thumbnail: '', publishedDate: '', categories: ['Action'], averageRating: 0, ratingsCount: 8 };
const BOOK_C = { id: 'c', title: 'C', subtitle: '', authors: [], description: '', thumbnail: '', publishedDate: '', categories: ['Action'], averageRating: 0, ratingsCount: 6 };

function makeCache() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSupabase() {
  const builder: any = {
    select: jest.fn(() => builder),
    or: jest.fn(() => builder),
    eq: jest.fn(async () => ({ data: [], error: null })),
  };
  return { client: { from: jest.fn(() => builder) } };
}

function makeMangaDex(overrides: Partial<{
  getMangaDetail: jest.Mock;
  getMangaTagId: jest.Mock;
  fetchMangaForRow: jest.Mock;
}> = {}) {
  return {
    getMangaDetail: jest.fn().mockResolvedValue({ id: 'src', genres: ['Action'] }),
    getMangaTagId: jest.fn().mockResolvedValue('tag-uuid-action'),
    fetchMangaForRow: jest.fn().mockResolvedValue({ items: [BOOK_A, BOOK_B, BOOK_C], total: 3 }),
    searchManga: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    fetchMangaByIds: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('MangaCatalogService.getRelated (#325)', () => {
  it('returns [] for unknown ID (getMangaDetail throws)', async () => {
    const mangaDex = makeMangaDex({
      getMangaDetail: jest.fn().mockRejectedValue(new Error('not found')),
    });
    const svc = new MangaCatalogService(mangaDex as any, makeSupabase() as any, makeCache() as any);

    await expect(svc.getRelated('unknown-id')).resolves.toEqual([]);
    expect(mangaDex.fetchMangaForRow).not.toHaveBeenCalled();
  });

  it('returns [] when the manga has no categories', async () => {
    const mangaDex = makeMangaDex({
      getMangaDetail: jest.fn().mockResolvedValue({ id: 'src', genres: [] }),
    });
    const svc = new MangaCatalogService(mangaDex as any, makeSupabase() as any, makeCache() as any);

    await expect(svc.getRelated('src')).resolves.toEqual([]);
    expect(mangaDex.getMangaTagId).not.toHaveBeenCalled();
  });

  it('excludes the source manga ID from results', async () => {
    const mangaDex = makeMangaDex({
      fetchMangaForRow: jest.fn().mockResolvedValue({
        items: [{ ...BOOK_A, id: 'src' }, BOOK_B, BOOK_C],
        total: 3,
      }),
    });
    const svc = new MangaCatalogService(mangaDex as any, makeSupabase() as any, makeCache() as any);

    const result = await svc.getRelated('src', 10);
    expect(result.map((b) => b.id)).not.toContain('src');
    expect(result.map((b) => b.id)).toEqual(['b', 'c']);
  });

  it('respects the limit cap', async () => {
    const mangaDex = makeMangaDex({
      fetchMangaForRow: jest.fn().mockResolvedValue({
        items: [BOOK_A, BOOK_B, BOOK_C],
        total: 3,
      }),
    });
    const svc = new MangaCatalogService(mangaDex as any, makeSupabase() as any, makeCache() as any);

    const result = await svc.getRelated('other', 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('queries MangaDex by rating order with the resolved tag ID', async () => {
    const mangaDex = makeMangaDex();
    const svc = new MangaCatalogService(mangaDex as any, makeSupabase() as any, makeCache() as any);

    await svc.getRelated('src', 10);

    expect(mangaDex.getMangaTagId).toHaveBeenCalledWith('Action');
    expect(mangaDex.fetchMangaForRow).toHaveBeenCalledWith('rating', 11, 0, 'tag-uuid-action');
  });
});
