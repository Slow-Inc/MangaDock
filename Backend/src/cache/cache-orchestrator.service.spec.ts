import { CacheOrchestratorService } from './cache-orchestrator.service';
import { RedisService } from './redis.service';
import { JsonCacheService } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';

function makeRedis(available = true, store: Record<string, string> = {}): jest.Mocked<Pick<RedisService, 'available' | 'get' | 'set' | 'publish' | 'subscribe' | 'onReconnect'>> {
  return {
    available,
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ?? null)),
    set: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => {}),
    onReconnect: jest.fn().mockReturnValue(() => {}),
  } as any;
}

function makeJsonCache(): jest.Mocked<Pick<JsonCacheService, 'get' | 'set' | 'delete' | 'getAll' | 'isExpired'>> {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn(),
    getAll: jest.fn().mockReturnValue(new Map()),
    isExpired: jest.fn().mockReturnValue(false),
  } as any;
}

function makeBatchSync(): jest.Mocked<Pick<BatchSyncWorker, 'markDirty'>> {
  return { markDirty: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeOrchestrator(overrides: {
  redis?: any; jsonCache?: any; batchSync?: any;
} = {}) {
  const redis = overrides.redis ?? makeRedis();
  const jsonCache = overrides.jsonCache ?? makeJsonCache();
  const batchSync = overrides.batchSync ?? makeBatchSync();
  const svc = new CacheOrchestratorService(redis, jsonCache, batchSync);
  return { svc, redis, jsonCache, batchSync };
}

describe('CacheOrchestratorService — cross-node L1 invalidation (#37)', () => {
  // Cycle 1 — set() publishes key to cache:invalidate
  it('set() publishes the key to cache:invalidate after writing to L2', async () => {
    const { svc, redis } = makeOrchestrator({ redis: makeRedis(true) });

    await svc.set('manga:1', { pages: [] });

    expect(redis.publish).toHaveBeenCalledWith('cache:invalidate', 'manga:1');
  });

  // Cycle 2 — setMangaCacheWithTiers() also publishes
  it('setMangaCacheWithTiers() publishes the key to cache:invalidate after writing to L2', async () => {
    const { svc, redis } = makeOrchestrator({ redis: makeRedis(true) });

    await svc.setMangaCacheWithTiers('manga:2', { pages: [] });

    expect(redis.publish).toHaveBeenCalledWith('cache:invalidate', 'manga:2');
  });

  // Cycle 6 — re-subscribes on reconnect (guards against Redis unavailable at startup)
  it('onModuleInit() registers onReconnect to re-subscribe when Redis was unavailable at startup', () => {
    let capturedReconnectCb: (() => void) | null = null;
    const redis = makeRedis(false);
    (redis.onReconnect as jest.Mock).mockImplementation((cb: () => void) => {
      capturedReconnectCb = cb;
      return () => {};
    });
    const { svc } = makeOrchestrator({ redis });

    svc.onModuleInit();
    capturedReconnectCb!();

    expect(redis.subscribe).toHaveBeenCalledTimes(2);
  });

  // Cycle 3 — incoming invalidation removes key from L1
  it('onModuleInit() subscribes to cache:invalidate; received key is deleted from L1', () => {
    let capturedHandler: ((data: unknown) => void) | null = null;
    const redis = makeRedis(true);
    (redis.subscribe as jest.Mock).mockImplementation((_ch: string, handler: (data: unknown) => void) => {
      capturedHandler = handler;
      return () => {};
    });
    const jsonCache = makeJsonCache();
    const { svc } = makeOrchestrator({ redis, jsonCache });

    svc.onModuleInit();
    capturedHandler!('manga:1');

    expect(jsonCache.delete).toHaveBeenCalledWith('manga:1');
  });
});

describe('CacheOrchestratorService — L1-first read path (#36)', () => {
  // Cycle 4 — L1-hit: no Redis call
  it('get() returns L1 entry without calling redis.get when L1 has a non-expired entry', async () => {
    const entry = { data: { pages: [] }, updatedAt: new Date().toISOString(), ttlMs: 60_000 };
    const jsonCache = makeJsonCache();
    (jsonCache.get as jest.Mock).mockReturnValue(entry);
    (jsonCache.isExpired as jest.Mock).mockReturnValue(false);
    const redis = makeRedis(true);
    const { svc } = makeOrchestrator({ redis, jsonCache });

    const result = await svc.get('manga:1');

    expect(redis.get).not.toHaveBeenCalled();
    expect(result).toEqual({ data: entry.data, source: 'json' });
  });

  // Cycle 5 — L2-hit: updates L1 with fresh data
  it('get() writes the L2 entry into L1 on a L2 cache hit', async () => {
    const entry = { data: { pages: [1] }, updatedAt: new Date().toISOString(), ttlMs: 60_000 };
    const redis = makeRedis(true, { 'manga:1': JSON.stringify(entry) });
    const jsonCache = makeJsonCache();
    (jsonCache.get as jest.Mock).mockReturnValue(null);
    const { svc } = makeOrchestrator({ redis, jsonCache });

    await svc.get('manga:1');

    expect(jsonCache.set).toHaveBeenCalledWith('manga:1', entry.data, expect.any(Number));
  });
});

describe('CacheOrchestratorService — setMangaCacheWithTiers', () => {
  it('calls markDirty() with the key after writing to L2', async () => {
    const { svc, batchSync } = makeOrchestrator({ redis: makeRedis(true) });

    await svc.setMangaCacheWithTiers('manga:123', { pages: [] });

    expect(batchSync.markDirty).toHaveBeenCalledWith('manga:123');
  });

  it('does not call markDirty() when Redis is unavailable', async () => {
    const { svc, batchSync } = makeOrchestrator({ redis: makeRedis(false) });

    await svc.setMangaCacheWithTiers('manga:123', { pages: [] });

    expect(batchSync.markDirty).not.toHaveBeenCalled();
  });
});

describe('CacheOrchestratorService — shutdown', () => {
  it('onApplicationShutdown completes without error — flush delegated to L3BatchWriter.onModuleDestroy()', () => {
    const { svc } = makeOrchestrator();
    expect(() => svc.onApplicationShutdown('SIGTERM')).not.toThrow();
  });

  it('does not mutate jsonCache on shutdown', () => {
    const { svc, jsonCache } = makeOrchestrator();

    svc.onApplicationShutdown('SIGTERM');

    expect(jsonCache.set).not.toHaveBeenCalled();
  });
});
