import { BooksService } from './books.service';

/**
 * Per-request Gemini model for image translation (Issue #87, Option A).
 *
 * The selected model must flow into the MIT config (`translator.model`) and
 * partition the patch cache + batch job registry — otherwise two users picking
 * different models for the same chapter would share cached patches and a jobKey.
 * Cache keys move v3 → v4 (`...:{src}:{tgt}:{model|default}`); old v3 entries
 * expire naturally (7-day TTL).
 */
function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { put: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(undefined) };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    storage as any,
  );
  return { service, cache };
}

const cachedEntry = {
  data: { patches: [{ xPct: 0, yPct: 0, wPct: 1, hPct: 1, url: 'http://b/p.png' }] },
};

describe('BooksService — per-request image translation model (#87)', () => {
  it('buildMitConfig includes translator.model when an image model is given', () => {
    const { service } = makeService();
    const cfg = JSON.parse((service as any).buildMitConfig('ANY', 'THA', '', 'gemini-2.5-pro'));
    expect(cfg.translator.model).toBe('gemini-2.5-pro');
  });

  it('buildMitConfig omits translator.model when absent, and sanitizes unsafe names', () => {
    const { service } = makeService();
    const noModel = JSON.parse((service as any).buildMitConfig('ANY', 'THA', ''));
    expect(noModel.translator.model).toBeUndefined();

    const unsafe = JSON.parse((service as any).buildMitConfig('ANY', 'THA', '', 'evil name!:{}'));
    expect(unsafe.translator.model).toBeUndefined();

    // "models/" prefix from the Gemini catalog is normalized away
    const prefixed = JSON.parse((service as any).buildMitConfig('ANY', 'THA', '', 'models/gemini-2.5-flash'));
    expect(prefixed.translator.model).toBe('gemini-2.5-flash');
  });

  it('partitions the patch cache by model (v4 key)', async () => {
    const { service, cache } = makeService();
    cache.get.mockResolvedValue(cachedEntry);

    await service.translateMangaPagePatches('ch1', 0, 'http://img/0.jpg', 'ja', 'th', {
      imageModel: 'gemini-2.5-pro',
    });
    await service.translateMangaPagePatches('ch1', 0, 'http://img/0.jpg', 'ja', 'th');

    const [keyWithModel] = cache.get.mock.calls[0];
    const [keyDefault] = cache.get.mock.calls[1];
    expect(keyWithModel).toContain(':gemini-2.5-pro');
    expect(keyWithModel).toContain(':v4:');
    expect(keyDefault).not.toBe(keyWithModel);
  });

  it('partitions the batch job registry by model', () => {
    const { service } = makeService();
    const defaultKey = (service as any).buildJobKey('ch1', 'ja', 'th');
    const modelKey = (service as any).buildJobKey('ch1', 'ja', 'th', 'gemini-2.5-pro');
    expect(modelKey).not.toBe(defaultKey);
  });

  // Found live (e2e 2026-06-05): the webhook path cached under the old v3 key
  // while the batch pre-check reads v4 — webhook results were never served from
  // cache again, so every re-translate hit MIT.
  it('caches webhook results under the same key the batch pre-check reads', async () => {
    const { service, cache } = makeService();
    const jobKey = (service as any).buildJobKey('ch1', 'ja', 'th', 'gemini-2.5-pro');
    (service as any).activeBatchJobs.set(jobKey, {
      completedPages: new Map(),
      processingPages: new Set(),
      listeners: new Set(),
      activeCallerCount: 1,
      expectedCount: 1,
      resolve: jest.fn(),
      reject: jest.fn(),
      cancelController: new AbortController(),
    });

    await service.handleMitCallback(jobKey, 0, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [{ x: 1, y: 2, w: 3, h: 4, img_b64: Buffer.from('png').toString('base64') }],
    });

    const { srcMIT, tgtMIT } = (service as any).mitLangPair('ja', 'th');
    const expectedKey = (service as any).patchCacheKey('ch1', 0, srcMIT, tgtMIT, 'gemini-2.5-pro');
    const writtenKeys = cache.set.mock.calls.map((c: unknown[]) => c[0]);
    expect(writtenKeys).toContain(expectedKey);
  });

  // Copilot on PR #144 (a latent bug recorded in DONE.md since 2026-06-04):
  // if persistence throws after processingPages.add, the page stayed locked
  // forever — the idempotency check saw it as "still processing" on retry.
  it('a storage failure never locks the page — retries stay possible', async () => {
    const { service } = makeService();
    const storage = {
      put: jest.fn().mockRejectedValue(new Error('disk full')),
      list: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).storage = storage;
    (service as any).patchStore = new (require('./patch-store').PatchStore)(storage, () => 'http://b');

    const jobKey = (service as any).buildJobKey('ch1', 'ja', 'th');
    const job = {
      completedPages: new Map(),
      processingPages: new Set(),
      listeners: new Set(),
      activeCallerCount: 1,
      expectedCount: 1,
      resolve: jest.fn(),
      reject: jest.fn(),
      cancelController: new AbortController(),
    };
    (service as any).activeBatchJobs.set(jobKey, job);

    await service.handleMitCallback(jobKey, 0, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [{ x: 1, y: 2, w: 3, h: 4, img_b64: Buffer.from('png').toString('base64') }],
    });

    expect(job.processingPages.has(0)).toBe(false); // unlocked
    expect(job.completedPages.get(0)?.error).toBeTruthy(); // surfaced as a page error
  });
});
