import {
  isTranslatedPatchCacheKey,
  resetTranslationCache,
  TRANSLATED_PATCH_PREFIX,
  type CacheResetPorts,
} from './translation-cache-reset';

/** In-memory fake of every side-effecting port. Records what got deleted so a
 *  test can assert "only translated-patch state was touched, nothing else". */
function makePorts(seed: {
  redisKeys?: string[];
  l3Keys?: string[];
  patchChapters?: Record<string, number>; // chapterId -> file count
}): {
  ports: CacheResetPorts;
  redis: Set<string>;
  l3: Set<string>;
  chapters: Map<string, number>;
} {
  const redis = new Set(seed.redisKeys ?? []);
  const l3 = new Set(seed.l3Keys ?? []);
  const chapters = new Map(Object.entries(seed.patchChapters ?? {}));
  const ports: CacheResetPorts = {
    listRedisKeys: () => Promise.resolve([...redis]),
    deleteRedisKeys: (keys) => {
      let n = 0;
      for (const k of keys) if (redis.delete(k)) n += 1;
      return Promise.resolve(n);
    },
    listL3Keys: () => Promise.resolve([...l3]),
    deleteL3Key: (key) => {
      l3.delete(key);
      return Promise.resolve();
    },
    listPatchChapters: () => Promise.resolve([...chapters.keys()]),
    deletePatchChapter: (chapterId) => {
      const n = chapters.get(chapterId) ?? 0;
      chapters.delete(chapterId);
      return Promise.resolve(n);
    },
  };
  return { ports, redis, l3, chapters };
}

const PATCH_KEY = `${TRANSLATED_PATCH_PREFIX}v6:ch1:0:JA:TH:default:hd`;

describe('isTranslatedPatchCacheKey', () => {
  it('matches the translated-patch cache key and nothing else', () => {
    expect(isTranslatedPatchCacheKey(PATCH_KEY)).toBe(true);
    // Adjacent namespaces that share a cache but are NOT translated patches.
    expect(isTranslatedPatchCacheKey('forum:posts:123')).toBe(false);
    expect(isTranslatedPatchCacheKey('search:onepiece')).toBe(false);
    expect(isTranslatedPatchCacheKey('mangadex:chapter:abc')).toBe(false);
    // A sibling translate namespace that is not the patch cache must survive.
    expect(isTranslatedPatchCacheKey('translate:glossary:ch1')).toBe(false);
  });
});

describe('resetTranslationCache', () => {
  it('deletes translated-patch Redis keys and reports the count', async () => {
    const { ports, redis } = makePorts({
      redisKeys: [PATCH_KEY, 'forum:posts:1'],
    });

    const report = await resetTranslationCache(ports);

    expect(redis.has(PATCH_KEY)).toBe(false);
    expect(redis.has('forum:posts:1')).toBe(true); // untouched
    expect(report.redisKeys).toBe(1);
  });

  it('leaves unrelated Redis/L3 cache entirely intact', async () => {
    const { ports, redis, l3 } = makePorts({
      redisKeys: ['forum:posts:1', 'search:naruto', 'mangadex:x'],
      l3Keys: ['forum:feed', 'versions:latest'],
    });

    const report = await resetTranslationCache(ports);

    expect(redis.size).toBe(3);
    expect(l3.size).toBe(2);
    expect(report.redisKeys).toBe(0);
    expect(report.l3Files).toBe(0);
  });

  it('deletes translated-patch L3 files by their canonical key', async () => {
    const { ports, l3 } = makePorts({ l3Keys: [PATCH_KEY, 'forum:feed'] });

    const report = await resetTranslationCache(ports);

    expect(l3.has(PATCH_KEY)).toBe(false);
    expect(l3.has('forum:feed')).toBe(true);
    expect(report.l3Files).toBe(1);
  });

  it('removes every patch chapter directory and sums the files deleted', async () => {
    const { ports, chapters } = makePorts({
      patchChapters: { '083f60ad': 7, abc123: 3 },
    });

    const report = await resetTranslationCache(ports);

    expect(chapters.size).toBe(0);
    expect(report.patchChapters).toBe(2);
    expect(report.patchFiles).toBe(10);
  });

  it('keeps going when one chapter deletion throws (best-effort, no abort)', async () => {
    const { ports, chapters } = makePorts({
      patchChapters: { good: 2, bad: 5 },
    });
    // 'bad' rejects; 'good' deletes from the same map the real port closes over.
    ports.deletePatchChapter = (id) => {
      if (id === 'bad') return Promise.reject(new Error('EPERM'));
      const n = chapters.get(id) ?? 0;
      chapters.delete(id);
      return Promise.resolve(n);
    };

    const report = await resetTranslationCache(ports);

    expect(chapters.has('good')).toBe(false); // good one still removed
    expect(report.patchChapters).toBe(1);
    expect(report.patchFiles).toBe(2);
  });
});
