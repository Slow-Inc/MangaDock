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
  const storage = { put: jest.fn().mockResolvedValue(undefined) };
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
});
