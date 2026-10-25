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
  imageCache?: Record<string, unknown>;
  unreadable?: string[];
}) {
  const cache = {
    get: jest.fn(async () =>
      opts.fresh ? { data: opts.fresh, source: 'redis' } : null,
    ),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
    getStale: jest.fn(() => opts.stale ?? null),
  };
  const imageCache = opts.imageCache ?? { enabled: false };
  const mangaDex = {
    mangaRowDefs: opts.rowDefs ?? [
      { id: 'r1', title: 'Row 1', order: 'latest', limit: 10 },
    ],
    fetchMangaForRow:
      opts.rowFetch ?? jest.fn().mockResolvedValue({ items: [] }),
    findUnreadable: jest.fn().mockResolvedValue(new Set(opts.unreadable ?? [])),
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
      stale: {
        data: { hero: null, rows: [], updatedAt: 'T0' },
        updatedAt: 'T0',
      },
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
      stale: {
        data: { hero: null, rows: [], updatedAt: 'T1' },
        updatedAt: 'T1',
      },
      rowFetch: jest.fn().mockResolvedValue({ items: [] }), // all rows empty
    });

    const out = await svc.getLandingBooks();

    expect(out.fromStaleCache).toBe(true);
    expect(out.staleUpdatedAt).toBe('T1');
    expect(cache.set).not.toHaveBeenCalled(); // never cached an empty landing
  });

  it('caches and returns a fresh landing when MangaDex yields books', async () => {
    const { svc, cache } = makeDeps({
      rowFetch: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'a', thumbnail: 't' }] }),
    });

    const out = await svc.getLandingBooks();

    expect(out.hero).toEqual({ id: 'a', thumbnail: 't' });
    expect(out.apiOffline).toBeUndefined();
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('drops titles with nothing to read, so the hero is a readable one (#1112)', async () => {
    const { svc, mangaDex } = makeDeps({
      rowFetch: jest.fn().mockResolvedValue({
        items: [
          { id: 'gone', thumbnail: 't' },
          { id: 'a', thumbnail: 't' },
        ],
      }),
      unreadable: ['gone'],
    });

    const out = await svc.getLandingBooks();

    expect(mangaDex.findUnreadable).toHaveBeenCalledWith(['gone', 'a']);
    expect(out.hero).toEqual({ id: 'a', thumbnail: 't' });
    expect(out.rows[0].items.map((b) => b.id)).toEqual(['a']);
  });

  it('fills a row that came back empty from the stale landing, and caches only briefly (#865)', async () => {
    const rowDefs = [
      { id: 'r1', title: 'Row 1', order: 'a', limit: 10 },
      { id: 'r2', title: 'Row 2', order: 'b', limit: 10 },
    ];
    const { svc, cache } = makeDeps({
      rowDefs,
      stale: {
        data: {
          hero: null,
          rows: [
            { id: 'r1', title: 'Row 1', query: 'a', items: [{ id: 'old1' }] },
            { id: 'r2', title: 'Row 2', query: 'b', items: [{ id: 'old2' }] },
          ],
          updatedAt: 'T0',
        },
        updatedAt: 'T0',
      },
      // r1 fresh; r2's MangaDex call failed (fetchMangaWithParamsPaged swallows it into [])
      rowFetch: jest.fn(async (order: string) => ({
        items: order === 'a' ? [{ id: 'new1' }] : [],
      })),
    });

    const out = await svc.getLandingBooks();

    expect(out.rows.map((r) => r.items.map((b) => b.id))).toEqual([
      ['new1'],
      ['old2'],
    ]);
    expect(cache.set).toHaveBeenCalledTimes(1);
    const ttl = (cache.set.mock.calls[0] as unknown[])[2] as number;
    expect(ttl).toBeLessThan(5 * 60 * 1000); // retried soon, not held for the full landing TTL
  });

  it('keeps a partial landing on the short TTL when the thumbnail patch rewrites it (#865)', async () => {
    const { svc, cache } = makeDeps({
      fresh: {
        hero: null,
        rows: [
          {
            id: 'r1',
            title: 'Row 1',
            query: 'a',
            items: [{ id: 'a', thumbnail: 't' }],
          },
        ],
        updatedAt: 'T0',
        partial: true,
      },
      imageCache: {
        enabled: true,
        localPathExists: jest.fn().mockResolvedValue(false),
        localThumbnailPath: jest.fn().mockResolvedValue('/img-cache/a.jpg'),
      },
    });

    await svc.getLandingBooks();
    await new Promise((r) => setImmediate(r)); // the patch write is fire-and-forget

    expect(cache.set).toHaveBeenCalledTimes(1);
    const ttl = (cache.set.mock.calls[0] as unknown[])[2] as number;
    expect(ttl).toBeLessThan(5 * 60 * 1000);
  });

  it('caches a complete landing for the full TTL (#865)', async () => {
    const { svc, cache } = makeDeps({
      rowFetch: jest.fn().mockResolvedValue({ items: [{ id: 'a' }] }),
    });

    await svc.getLandingBooks();

    const ttl = (cache.set.mock.calls[0] as unknown[])[2] as number;
    expect(ttl).toBeGreaterThanOrEqual(20 * 60 * 1000);
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
    await expect(
      svc.translateDescription('Some English text'),
    ).resolves.toEqual({
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

    const result = await svc.translateDescription(
      'Some English description here and more text',
    );
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
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      () => 'http://localhost',
      { LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv,
      mockLlm,
    );

    const result = await svc.translateDescription('Some text');
    expect(result.translated).toBe(false);
    expect(mockLlm.complete).not.toHaveBeenCalled();
  });
});

describe('translateDescription() — reports the model that produced the text', () => {
  const text = 'Some English description here and more text';

  function makeSvc(opts: {
    env: NodeJS.ProcessEnv;
    cached?: unknown;
    complete: jest.Mock;
    catalogModels?: string[];
    descriptionModel?: string;
  }) {
    const cache = {
      get: jest
        .fn()
        .mockResolvedValue(opts.cached ? { data: opts.cached } : null),
      setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
    };
    const llm = {
      isConfigured: jest.fn().mockReturnValue(true),
      getDescriptionModel: jest
        .fn()
        .mockReturnValue(opts.descriptionModel ?? 'unused'),
      complete: opts.complete,
    } as unknown as LlmService;
    const geminiCatalog = {
      getDescriptionModels: jest
        .fn()
        .mockResolvedValue(opts.catalogModels ?? []),
    };
    const svc = new LandingService(
      cache as any,
      { enabled: false } as any,
      {} as any,
      geminiCatalog as any,
      () => 'http://localhost',
      opts.env,
      llm,
    );
    return { svc, cache };
  }

  it('returns the configured model for a non-Gemini provider', async () => {
    const { svc } = makeSvc({
      env: {
        LLM_PROVIDER: 'custom',
        LLM_API_KEY: 'k',
        LLM_BASE_URL: 'http://x',
      },
      descriptionModel: 'deepseek-v4-flash',
      complete: jest.fn().mockResolvedValue('คำแปลภาษาไทย'),
    });

    const result = await svc.translateDescription(text);

    expect(result.translated).toBe(true);
    expect(result.model).toBe('deepseek-v4-flash');
  });

  it('returns the fallback model when the first one failed', async () => {
    const complete = jest
      .fn()
      .mockRejectedValueOnce(new Error('model overloaded'))
      .mockResolvedValueOnce('คำแปลภาษาไทย');
    const { svc, cache } = makeSvc({
      env: { LLM_API_KEY: 'k' },
      catalogModels: ['gemini-3-flash-preview', 'gemini-2.5-flash'],
      complete,
    });

    const result = await svc.translateDescription(text);

    expect(result.model).toBe('gemini-2.5-flash');
    // the cached payload carries the model too, so cache hits keep reporting it
    expect(cache.setMangaCacheWithTiers).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'gemini-2.5-flash' }),
    );
  });

  it('keys the cache on the whole text, so a text sharing the first bytes of a description cannot poison it', async () => {
    const { svc, cache } = makeSvc({
      env: {
        LLM_PROVIDER: 'custom',
        LLM_API_KEY: 'k',
        LLM_BASE_URL: 'http://x',
      },
      descriptionModel: 'm',
      complete: jest.fn().mockResolvedValue('คำแปลภาษาไทย'),
    });
    const head = 'A long English description that opens a popular book page, ';
    await svc.translateDescription(head + 'and continues as written.');
    await svc.translateDescription(
      head + 'and then [a link](https://example.invalid).',
    );
    const keys = (cache.get as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it('does not send an over-long text to the provider (#801)', async () => {
    const complete = jest.fn().mockResolvedValue('คำแปลภาษาไทย');
    const { svc } = makeSvc({
      env: {
        LLM_PROVIDER: 'custom',
        LLM_API_KEY: 'k',
        LLM_BASE_URL: 'http://x',
      },
      descriptionModel: 'm',
      complete,
    });
    const long = 'word '.repeat(2000); // 10,000 chars

    const result = await svc.translateDescription(long);

    expect(result).toEqual({ translatedText: long, translated: false });
    expect(complete).not.toHaveBeenCalled();
  });

  it('keeps markdown links, bold bullets and rules in a translated description (#802)', async () => {
    const thai = [
      'เรื่องราวของนักผจญภัย',
      '',
      '* **ตัวละครหลัก:** ฮีโร่',
      '---',
      '- อ่านต้นฉบับที่ [Official Raw](https://example.com/raw)',
    ].join('\n');
    const complete = jest.fn().mockResolvedValue(thai);
    const { svc } = makeSvc({
      env: {
        LLM_PROVIDER: 'custom',
        LLM_API_KEY: 'k',
        LLM_BASE_URL: 'http://x',
      },
      descriptionModel: 'm',
      complete,
    });

    const result = await svc.translateDescription(
      text + ' with **bold** and [a link](https://example.com/raw)',
    );

    expect(result.translatedText).toBe(thai);
    expect(complete.mock.calls[0][0]).toMatch(/markdown/i);
  });

  it('drops a leaked THOUGHTS block but keeps the translated link lines (#802)', async () => {
    const leaked = [
      'THOUGHTS: The user wants a Thai translation of a description.',
      'I will keep the link.',
      'เรื่องราวของนักผจญภัย',
      '',
      '---',
      '- [Official Raw](https://example.com/raw)',
    ].join('\n');
    const { svc } = makeSvc({
      env: {
        LLM_PROVIDER: 'custom',
        LLM_API_KEY: 'k',
        LLM_BASE_URL: 'http://x',
      },
      descriptionModel: 'm',
      complete: jest.fn().mockResolvedValue(leaked),
    });

    const result = await svc.translateDescription(text);

    expect(result.translatedText).toBe(
      'เรื่องราวของนักผจญภัย\n\n---\n- [Official Raw](https://example.com/raw)',
    );
  });

  it('does not invent a model for an older cached payload that lacks one', async () => {
    const { svc } = makeSvc({
      env: { LLM_PROVIDER: 'openai', LLM_API_KEY: 'k' },
      descriptionModel: 'gpt-4o-mini',
      cached: { translatedText: 'คำแปลเก่า', translated: true },
      complete: jest.fn(),
    });

    const result = await svc.translateDescription(text);

    expect(result.translatedText).toBe('คำแปลเก่า');
    expect(result.model).toBeUndefined();
  });
});
