import { GeminiModelCatalog } from './gemini-model-catalog';

/**
 * Gemini model selection (#231, PRD #228 step 6). The catalog filters the
 * configured candidate list against what the provider actually exposes, with a
 * memory→cache→API availability lookup. `env` and the `now` clock are injected so
 * selection is deterministic without touching process.env or the wall clock.
 */
function makeCache(initial?: { models: string[] } | null) {
  const store = new Map<string, unknown>();
  if (initial) store.set('gemini:models:v1', initial);
  return {
    get: jest.fn(async (key: string) => {
      const data = store.get(key);
      return data ? { data, source: 'redis' } : null;
    }),
    set: jest.fn(async (key: string, val: unknown) => {
      store.set(key, val);
    }),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
}

const modelsResponse = (names: string[]) =>
  new Response(
    JSON.stringify({
      models: names.map((name) => ({
        name: `models/${name}`,
        supportedGenerationMethods: ['generateContent'],
      })),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

describe('GeminiModelCatalog — model selection (#231)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns raw normalized candidates when no provider catalog is available (no API key)', async () => {
    const cache = makeCache(null);
    const catalog = new GeminiModelCatalog(cache as any, {} as any, () => 0);

    await expect(catalog.getMangaModels()).resolves.toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('puts the requested model first, then env overrides, then defaults', async () => {
    const cache = makeCache(null);
    const env = {
      GEMINI_MANGA_MODEL: 'gemini-2.5-pro',
      GEMINI_MANGA_FALLBACK_MODEL: 'gemini-2.0-flash',
    };
    const catalog = new GeminiModelCatalog(cache as any, env as any, () => 0);

    await expect(catalog.getMangaModels('gemini-2.5-flash')).resolves.toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('filters candidates against the provider catalog, skipping unavailable models', async () => {
    const cache = makeCache(null);
    const env = { GEMINI_API_KEY: 'k', GEMINI_MANGA_MODEL: 'gemini-2.5-pro' };
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(modelsResponse(['gemini-2.5-flash', 'gemini-2.5-flash-lite']) as any);
    const catalog = new GeminiModelCatalog(cache as any, env as any, () => 0);

    // gemini-2.5-pro is not in the provider catalog → skipped.
    await expect(catalog.getMangaModels()).resolves.toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('falls back to the raw candidates when none match the provider catalog', async () => {
    const cache = makeCache(null);
    const env = { GEMINI_API_KEY: 'k' };
    jest.spyOn(global, 'fetch').mockResolvedValue(modelsResponse(['some-other-model']) as any);
    const catalog = new GeminiModelCatalog(cache as any, env as any, () => 0);

    await expect(catalog.getDescriptionModels()).resolves.toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('serves the availability catalog from memory within the 1-hour TTL (injected clock)', async () => {
    const cache = makeCache({ models: ['gemini-2.5-flash'] });
    const env = { GEMINI_API_KEY: 'k' };
    const fetchSpy = jest.spyOn(global, 'fetch');
    let clock = 0;
    const catalog = new GeminiModelCatalog(cache as any, env as any, () => clock);

    await catalog.getMangaModels(); // primes memory from the redis cache
    clock = 1000 * 60 * 30; // +30 min — still inside the 1-hour TTL
    await catalog.getMangaModels();

    expect(cache.get).toHaveBeenCalledTimes(1); // second call hit memory, not cache
    expect(fetchSpy).not.toHaveBeenCalled(); // never reached the provider API
  });

  it('refetches the catalog once the TTL expires (injected clock)', async () => {
    const cache = makeCache({ models: ['gemini-2.5-flash'] });
    const env = { GEMINI_API_KEY: 'k' };
    let clock = 0;
    const catalog = new GeminiModelCatalog(cache as any, env as any, () => clock);

    await catalog.getMangaModels();
    clock = 1000 * 60 * 60 + 1; // just past the 1-hour TTL
    await catalog.getMangaModels();

    expect(cache.get).toHaveBeenCalledTimes(2); // memory expired → re-read cache
  });
});
