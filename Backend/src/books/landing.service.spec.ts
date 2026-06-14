import { LandingService } from './landing.service';

/**
 * Landing assembly + description translation (#231, PRD #228 step 6). The two
 * landing failure paths (MangaDex threw / no books returned) share one serveStale
 * helper: serve the last good payload flagged stale, else the API-offline payload.
 * Description translation short-circuits before hitting Gemini when there's no API
 * key or the text is already mostly Thai. imageCache disabled → enhancement is a
 * no-op, so these assertions are about the control flow, not thumbnails.
 */
function makeDeps(opts: {
  fresh?: unknown;
  stale?: { data: unknown; updatedAt: string } | null;
  rowFetch?: jest.Mock;
  env?: Record<string, string>;
}) {
  const cache = {
    get: jest.fn(async () => (opts.fresh ? { data: opts.fresh, source: 'redis' } : null)),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
    getStale: jest.fn(() => opts.stale ?? null),
  };
  const imageCache = { enabled: false };
  const mangaDex = {
    mangaRowDefs: [{ id: 'r1', title: 'Row 1', order: 'latest', limit: 10 }],
    fetchMangaForRow: opts.rowFetch ?? jest.fn().mockResolvedValue({ items: [] }),
  };
  const geminiCatalog = {
    getMangaModels: jest.fn().mockResolvedValue(['gemini-2.5-flash']),
    getDescriptionModels: jest.fn().mockResolvedValue(['gemini-2.5-flash']),
  };
  const svc = new LandingService(
    cache as any,
    imageCache as any,
    mangaDex as any,
    geminiCatalog as any,
    () => 'http://backend',
    (opts.env ?? {}) as any,
  );
  return { svc, cache, mangaDex };
}

describe('LandingService — landing assembly + description (#231)', () => {
  it('serves the stale payload (flagged) when the MangaDex fetch throws', async () => {
    const { svc } = makeDeps({
      stale: { data: { hero: null, rows: [], updatedAt: 'T0' }, updatedAt: 'T0' },
      rowFetch: jest.fn().mockRejectedValue(new Error('mangadex down')),
    });

    const out = await svc.getLandingBooks();

    expect(out.fromStaleCache).toBe(true);
    expect(out.staleUpdatedAt).toBe('T0');
    expect(out.apiOffline).toBeUndefined();
  });

  it('returns the API-offline payload when the fetch throws and no stale cache exists', async () => {
    const { svc } = makeDeps({
      stale: null,
      rowFetch: jest.fn().mockRejectedValue(new Error('mangadex down')),
    });

    const out = await svc.getLandingBooks();

    expect(out.apiOffline).toBe(true);
    expect(out.fromStaleCache).toBeUndefined();
  });

  it('falls through the same serveStale path when no books are returned', async () => {
    const { svc, cache } = makeDeps({
      stale: { data: { hero: null, rows: [], updatedAt: 'T1' }, updatedAt: 'T1' },
      rowFetch: jest.fn().mockResolvedValue({ items: [] }), // all rows empty
    });

    const out = await svc.getLandingBooks();

    expect(out.fromStaleCache).toBe(true);
    expect(out.staleUpdatedAt).toBe('T1');
    expect(cache.set).not.toHaveBeenCalled(); // never cached an empty landing
  });

  it('caches and returns a fresh landing when MangaDex yields books', async () => {
    const { svc, cache } = makeDeps({
      rowFetch: jest.fn().mockResolvedValue({ items: [{ id: 'a', thumbnail: 't' }] }),
    });

    const out = await svc.getLandingBooks();

    expect(out.hero).toEqual({ id: 'a', thumbnail: 't' });
    expect(out.apiOffline).toBeUndefined();
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('description: returns untranslated when no Gemini API key is configured', async () => {
    const { svc } = makeDeps({ env: {} });
    await expect(svc.translateDescription('Some English text')).resolves.toEqual({
      translatedText: 'Some English text',
      translated: false,
    });
  });

  it('description: skips text that is already mostly Thai', async () => {
    const { svc } = makeDeps({ env: { GEMINI_API_KEY: 'k' } });
    const thai = 'นี่คือคำอธิบายภาษาไทยทั้งหมด';
    await expect(svc.translateDescription(thai)).resolves.toEqual({
      translatedText: thai,
      translated: false,
    });
  });
});
