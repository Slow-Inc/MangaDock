import { BooksService } from './books.service';

/**
 * #148 — the translate paths used to await cache round-trips one at a time:
 * the batch pre-check looped one get per page, and the text path looped one
 * get per line (and one write per line after Gemini). On the cold path
 * (restart / cross-node, L1 empty) that serialized N Redis RTTs. These specs
 * pin the concurrency contract: all lookups are ISSUED before any resolves,
 * and replay/order semantics are unchanged.
 */

type Deferred = { resolve: (v: unknown) => void; promise: Promise<unknown> };

function deferred(): Deferred {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((res) => { resolve = res; });
  return { resolve, promise };
}

const drain = async (n = 20) => { for (let i = 0; i < n; i += 1) await Promise.resolve(); };

const MODELS_ENTRY = { data: { models: ['gemini-2.5-flash'] }, source: 'json' };

/** cache.get keyed router: models key resolves immediately; selected prefixes
 *  return caller-controlled deferreds so tests can observe issue-vs-resolve. */
function makeService(deferPrefix: string) {
  const deferredByKey = new Map<string, Deferred>();
  const cache = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'gemini:models:v1') return Promise.resolve(MODELS_ENTRY);
      if (key.startsWith(deferPrefix)) {
        const d = deferred();
        deferredByKey.set(key, d);
        return d.promise;
      }
      return Promise.resolve(null);
    }),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    put: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    storage as any,
  );
  return { service, cache, deferredByKey };
}

describe('BooksService — parallel cache round-trips in translate paths (#148)', () => {
  const OLD_KEY = process.env.GEMINI_API_KEY;
  beforeAll(() => { process.env.GEMINI_API_KEY = 'test-key'; });
  afterAll(() => { process.env.GEMINI_API_KEY = OLD_KEY; });

  it('batch pre-check issues every page-cache get before any resolves', async () => {
    const { service, deferredByKey } = makeService('translate:manga-patches:');
    const pages = [0, 1, 2].map((i) => ({ pageIndex: i, pageUrl: `http://img/${i}.jpg` }));
    const received: number[] = [];

    const job = service.startOrAttachBatchJob('ch1', pages, (pageIndex) => {
      received.push(pageIndex);
    }, 'ja', 'th');
    await drain();

    // Serial code would have issued only the first get at this point
    expect(deferredByKey.size).toBe(3);

    // Resolve out of order — replay must still arrive in page order
    const keys = [...deferredByKey.keys()].sort();
    const hit = { data: { patches: [{ xPct: 0, yPct: 0, wPct: 1, hPct: 1, url: 'http://b/p.png' }] } };
    deferredByKey.get(keys[2])!.resolve(hit);
    deferredByKey.get(keys[0])!.resolve(hit);
    deferredByKey.get(keys[1])!.resolve(hit);
    await job;

    expect(received).toEqual([0, 1, 2]);
  });

  it('text translate issues every line-cache lookup before any resolves, and counts hits', async () => {
    const { service, deferredByKey } = makeService('translate:manga:v1:');
    const lines = ['line-a', 'line-b', 'line-c'];

    const call = service.translateMangaEpisode({ lines, chapterId: 'ch1', page: 0, targetLang: 'th' });
    await drain();

    // Serial code would have issued only line-a's lookup at this point
    expect(deferredByKey.size).toBe(3);

    for (const d of deferredByKey.values()) d.resolve({ data: { text: 'แปลแล้ว' }, source: 'json' });
    const result = await call;

    expect(result.fromCache).toBe(3);
    expect(result.translatedLines).toEqual(['แปลแล้ว', 'แปลแล้ว', 'แปลแล้ว']);
  });
});
