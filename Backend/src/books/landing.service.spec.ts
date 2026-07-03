import { LandingService } from './landing.service';
import { LlmService } from './llm.service';

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
  rowDefs?: Array<{ id: string; title: string; order: string; limit?: number }>;
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
    mangaRowDefs: opts.rowDefs ?? [{ id: 'r1', title: 'Row 1', order: 'latest', limit: 10 }],
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

  it('fetches all landing rows concurrently, preserving input order', async () => {
    const rowDefs = [
      { id: 'r1', title: 'Row 1', order: 'a', limit: 10 },
      { id: 'r2', title: 'Row 2', order: 'b', limit: 10 },
      { id: 'r3', title: 'Row 3', order: 'c', limit: 10 },
    ];
    let inFlight = 0;
    let maxInFlight = 0;
    const rowFetch = jest.fn(async (order: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return { items: [{ id: order, thumbnail: 't' }] };
    });

    const { svc } = makeDeps({ rowDefs, rowFetch });
    const out = await svc.getLandingBooks();

    // All three fetches overlap — a sequential loop would peak at 1.
    expect(maxInFlight).toBe(3);
    // Promise.all preserves input order regardless of resolve order.
    expect(out.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
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

describe('translateDescription() — openai provider', () => {
  it('returns translated when llmService.complete resolves', async () => {
    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
    };
    const mockLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      getDescriptionModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      getMangaModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      complete: jest.fn().mockResolvedValue('คำแปลภาษาไทย'),
    } as unknown as LlmService;

    const svc = new LandingService(
      mockCache as any,
      { enabled: false } as any,
      {} as any,
      {} as any,
      () => 'http://localhost',
      { LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' } as NodeJS.ProcessEnv,
      mockLlm,
    );

    const result = await svc.translateDescription('Some English description here and more text');
    expect(result.translated).toBe(true);
    expect(result.translatedText).toBe('คำแปลภาษาไทย');
    expect(mockLlm.complete).toHaveBeenCalledWith(
      expect.stringContaining('Some English description'),
      'gpt-4o-mini',
    );
  });

  it('returns untranslated when llmService.isConfigured() is false', async () => {
    const mockLlm = {
      isConfigured: jest.fn().mockReturnValue(false),
      complete: jest.fn(),
    } as unknown as LlmService;

    const svc = new LandingService(
      {} as any, {} as any, {} as any, {} as any,
      () => 'http://localhost',
      { LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv,
      mockLlm,
    );

    const result = await svc.translateDescription('Some text');
    expect(result.translated).toBe(false);
    expect(mockLlm.complete).not.toHaveBeenCalled();
  });
});

describe('translateMangaEpisode() — openai provider', () => {
  it('uses llmService.getMangaModel() instead of geminiCatalog for non-gemini providers', async () => {
    const mockLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      getDescriptionModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      getMangaModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      complete: jest.fn().mockResolvedValue('["翻訳済み"]'),
    } as unknown as LlmService;

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
    };

    const svc = new LandingService(
      mockCache as any,
      { enabled: false } as any,
      {} as any,
      {} as any,
      () => 'http://localhost',
      { LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' } as NodeJS.ProcessEnv,
      mockLlm,
    );

    const result = await svc.translateMangaEpisode({
      lines: ['Hello', 'World'],
      targetLang: 'tha',
      model: 'gpt-4o-mini',
      chapterId: 'ch1',
      page: 0,
    });

    expect(mockLlm.getMangaModel).toHaveBeenCalled();
    expect(mockLlm.complete).toHaveBeenCalled();
    expect(result.translatedLines).toHaveLength(2);
  });
});
