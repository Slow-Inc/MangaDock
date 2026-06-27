import { MitTranslationService } from './mit-translation.service';

/**
 * #233 — single-page MIT translation carved out of BooksService. With MitClient
 * faked (and global.fetch faked for the page byte load), the single-page path is
 * unit-testable for the first time: cache hit, startup-retry loop, ECONNREFUSED →
 * unavailable, and abort/timeout.
 */
function makeService() {
  const mitClient = {
    baseUrl: 'http://mit',
    ready: jest.fn(),
    submitSinglePage: jest.fn(),
    cancel: jest.fn(),
  };
  const cache = { get: jest.fn().mockResolvedValue(null) };
  const persistPage = jest
    .fn()
    .mockResolvedValue([
      { xPct: 0, yPct: 0, wPct: 1, hPct: 1, url: 'http://b/p.png' },
    ]);
  const seriesContextFor = jest.fn().mockResolvedValue(undefined);
  const service = new MitTranslationService(mitClient as any, cache as any, {
    persistPage,
    seriesContextFor,
  });
  return { service, mitClient, cache, persistPage, seriesContextFor };
}

describe('MitTranslationService — single-page (#233)', () => {
  afterEach(() => jest.restoreAllMocks());

  // Tracer bullet — a cache hit short-circuits before any MIT call.
  it('returns cached patches without calling MIT on a cache hit', async () => {
    const { service, mitClient, cache } = makeService();
    const cached = {
      data: {
        patches: [
          { xPct: 0, yPct: 0, wPct: 1, hPct: 1, url: 'http://b/p.png' },
        ],
      },
    };
    cache.get.mockResolvedValue(cached);

    const result = await service.translateMangaPagePatches(
      'ch1',
      0,
      'http://img/0.jpg',
      'ja',
      'th',
    );

    expect(result).toEqual(cached.data);
    expect(mitClient.submitSinglePage).not.toHaveBeenCalled();
  });

  // Startup-retry loop — MIT replies 500 while still loading models, then 200.
  it('retries on HTTP 500 then succeeds, persisting the page once', async () => {
    const { service, mitClient, persistPage } = makeService();
    // loadPageBytes fetches the external page URL — return some bytes.
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    mitClient.submitSinglePage
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'loading models',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          img_width: 100,
          img_height: 200,
          patches: [
            {
              x: 1,
              y: 2,
              w: 3,
              h: 4,
              img_b64: Buffer.from('png').toString('base64'),
            },
          ],
        }),
      });

    jest.useFakeTimers();
    try {
      const promise = service.translateMangaPagePatches(
        'ch1',
        0,
        'http://img/0.jpg',
        'ja',
        'th',
      );
      await jest.advanceTimersByTimeAsync(5_000); // skip the 5s startup-retry delay
      const result = await promise;

      expect(mitClient.submitSinglePage).toHaveBeenCalledTimes(2);
      expect(persistPage).toHaveBeenCalledTimes(1);
      expect(result.patches).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  // Connection refused — MIT is down. Surfaced as a clean "unavailable", not a raw
  // ECONNREFUSED, so the Reader can fail open (PRD #131).
  it('maps ECONNREFUSED to "service unavailable"', async () => {
    const { service, mitClient } = makeService();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    mitClient.submitSinglePage.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:5003'),
    );

    await expect(
      service.translateMangaPagePatches(
        'ch1',
        0,
        'http://img/0.jpg',
        'ja',
        'th',
      ),
    ).rejects.toThrow('manga-image-translator service unavailable');
  });

  // A 5-minute MIT timeout / abort surfaces as a timeout, not a raw AbortError.
  it('maps an abort/timeout to a timeout error', async () => {
    const { service, mitClient } = makeService();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    mitClient.submitSinglePage.mockRejectedValue(
      new Error('The operation was aborted due to timeout'),
    );

    await expect(
      service.translateMangaPagePatches(
        'ch1',
        0,
        'http://img/0.jpg',
        'ja',
        'th',
      ),
    ).rejects.toThrow('manga-image-translator timed out after 5 minutes');
  });

  describe('checkMitHealth', () => {
    it('reports available when /ready is ok', async () => {
      const { service, mitClient } = makeService();
      mitClient.ready.mockResolvedValue({ ok: true });

      const result = await service.checkMitHealth();

      expect(result).toEqual({ available: true, url: 'http://mit' });
      expect(mitClient.ready).toHaveBeenCalledWith(5_000);
    });

    it('reports unavailable with a message when /ready throws', async () => {
      const { service, mitClient } = makeService();
      mitClient.ready.mockRejectedValue(new Error('boom'));

      const result = await service.checkMitHealth();

      expect(result.available).toBe(false);
      expect(result.message).toContain('boom');
    });
  });

  describe('getImageTranslator', () => {
    it('returns the translator family from /ready', async () => {
      const { service, mitClient } = makeService();
      mitClient.ready.mockResolvedValue({
        ok: true,
        json: async () => ({ translator: 'qwen3' }),
      });

      expect(await service.getImageTranslator()).toBe('qwen3');
      expect(mitClient.ready).toHaveBeenCalledWith(3_000);
    });

    it('degrades to null when MIT is down', async () => {
      const { service, mitClient } = makeService();
      mitClient.ready.mockRejectedValue(new Error('ECONNREFUSED'));

      expect(await service.getImageTranslator()).toBeNull();
    });
  });
});
