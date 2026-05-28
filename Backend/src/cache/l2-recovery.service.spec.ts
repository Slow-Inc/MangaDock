import { L2RecoveryService } from './l2-recovery.service';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

function makeEntry(overrides: Partial<CacheEntry<unknown>> = {}): CacheEntry<unknown> {
  return {
    data: { value: 'test' },
    updatedAt: new Date().toISOString(),
    ttlMs: 60_000,
    ...overrides,
  };
}

function makeRedis(available = true): jest.Mocked<Pick<RedisService, 'available' | 'set' | 'onReconnect'>> {
  return {
    available,
    set: jest.fn().mockResolvedValue(undefined),
    onReconnect: jest.fn().mockReturnValue(() => {}),
  } as any;
}

function makeJsonCache(entries: Map<string, CacheEntry<unknown>> = new Map()): jest.Mocked<Pick<JsonCacheService, 'getAll' | 'isExpired'>> {
  return {
    getAll: jest.fn().mockReturnValue(entries),
    isExpired: jest.fn().mockImplementation((entry: CacheEntry<unknown>) => {
      if (entry.ttlMs <= 0) return false;
      return Date.now() - new Date(entry.updatedAt).getTime() > entry.ttlMs;
    }),
  } as any;
}

function makeBatchSync(): jest.Mocked<Pick<BatchSyncWorker, 'markDirty'>> {
  return { markDirty: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeService(overrides: { redis?: any; jsonCache?: any; batchSync?: any } = {}) {
  const redis = overrides.redis ?? makeRedis();
  const jsonCache = overrides.jsonCache ?? makeJsonCache();
  const batchSync = overrides.batchSync ?? makeBatchSync();
  const svc = new L2RecoveryService(
    redis as unknown as RedisService,
    jsonCache as unknown as JsonCacheService,
    batchSync as unknown as BatchSyncWorker,
  );
  return { svc, redis, jsonCache, batchSync };
}

describe('L2RecoveryService', () => {
  afterEach(() => jest.restoreAllMocks());

  // Cycle 1 — writes non-expired L1 entry to L2
  it('recover() calls redis.set for each non-expired L1 entry', async () => {
    const entry = makeEntry({ ttlMs: 60_000 });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', entry]])),
    });

    await svc.recover();

    expect(redis.set).toHaveBeenCalledWith('key:1', JSON.stringify(entry), expect.any(Number));
  });

  // Cycle 2 — skips expired entries
  it('recover() does not call redis.set for expired L1 entries', async () => {
    const expired = makeEntry({ ttlMs: 1, updatedAt: new Date(Date.now() - 5000).toISOString() });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:old', expired]])),
    });

    await svc.recover();

    expect(redis.set).not.toHaveBeenCalled();
  });

  // Cycle 3 — calls markDirty per written key
  it('recover() calls markDirty for each key written to L2', async () => {
    const entry = makeEntry();
    const { svc, batchSync } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', entry]])),
    });

    await svc.recover();

    expect(batchSync.markDirty).toHaveBeenCalledWith('key:1');
  });

  // Cycle 4 — returns { synced, skipped } counts
  it('recover() returns synced and skipped counts', async () => {
    const fresh = makeEntry({ ttlMs: 60_000 });
    const expired = makeEntry({ ttlMs: 1, updatedAt: new Date(Date.now() - 5000).toISOString() });
    const { svc } = makeService({
      jsonCache: makeJsonCache(new Map([['key:a', fresh], ['key:b', expired]])),
    });

    const result = await svc.recover();

    expect(result).toEqual({ synced: 1, skipped: 1 });
  });

  // Cycle 5 — per-key failure does not abort recovery
  it('recover() continues to next key when redis.set throws for one key', async () => {
    const e1 = makeEntry();
    const e2 = makeEntry();
    const redis = makeRedis();
    (redis.set as jest.Mock)
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(undefined);
    const { svc, batchSync } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', e1], ['key:2', e2]])),
      redis,
    });

    await expect(svc.recover()).resolves.not.toThrow();
    expect(batchSync.markDirty).toHaveBeenCalledWith('key:2');
  });

  // Cycle 6 — no-op when L1 is empty
  it('recover() makes no Redis calls when L1 is empty', async () => {
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map()),
    });

    const result = await svc.recover();

    expect(redis.set).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, skipped: 0 });
  });

  // Cycle 7 — permanent entries use 7-day TTL
  it('recover() writes permanent entries (ttlMs <= 0) with a 7-day TTL', async () => {
    const permanent = makeEntry({ ttlMs: -1 });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:perm', permanent]])),
    });

    await svc.recover();

    expect(redis.set).toHaveBeenCalledWith('key:perm', JSON.stringify(permanent), SEVEN_DAYS_S);
  });

  // Cycle 8 — onModuleInit triggers immediate recovery when Redis is available
  it('onModuleInit() calls recover() immediately when Redis is already available', async () => {
    const { svc } = makeService({ redis: makeRedis(true) });
    const spy = jest.spyOn(svc, 'recover').mockResolvedValue({ synced: 0, skipped: 0 });

    await svc.onModuleInit();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // Cycle 9 — onModuleInit registers onReconnect subscription
  it('onModuleInit() registers an onReconnect callback that triggers recover()', async () => {
    let capturedCb: (() => void) | null = null;
    const redis = makeRedis(false);
    (redis.onReconnect as jest.Mock).mockImplementation((cb: () => void) => {
      capturedCb = cb;
      return () => {};
    });
    const { svc } = makeService({ redis });
    const spy = jest.spyOn(svc, 'recover').mockResolvedValue({ synced: 0, skipped: 0 });

    await svc.onModuleInit();
    capturedCb!();

    expect(spy).toHaveBeenCalled();
  });
});
