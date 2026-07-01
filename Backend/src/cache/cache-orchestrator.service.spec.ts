import { CacheOrchestratorService } from './cache-orchestrator.service';
import { RedisService } from './redis.service';
import { JsonCacheService } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';
import { L3DiskService } from './l3-disk.service';

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

function makeJsonCache(): jest.Mocked<Pick<JsonCacheService, 'get' | 'set' | 'delete' | 'clear' | 'isExpired'>> {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    isExpired: jest.fn().mockReturnValue(false),
  } as any;
}

function makeBatchSync(): jest.Mocked<Pick<BatchSyncWorker, 'markDirty'>> {
  return { markDirty: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeMetrics(nodeId = 'test-node') {
  return { nodeId } as any;
}

function makeL3(): jest.Mocked<Pick<L3DiskService, 'appendDirtyFallback' | 'drainDirtyFallback'>> {
  return {
    appendDirtyFallback: jest.fn(),
    drainDirtyFallback: jest.fn().mockReturnValue([]),
  } as any;
}

function makeOrchestrator(overrides: {
  redis?: any; jsonCache?: any; batchSync?: any; metrics?: any; l3?: any;
} = {}) {
  const redis = overrides.redis ?? makeRedis();
  const jsonCache = overrides.jsonCache ?? makeJsonCache();
  const batchSync = overrides.batchSync ?? makeBatchSync();
  const metrics = overrides.metrics ?? makeMetrics();
  const l3 = overrides.l3 ?? makeL3();
  const svc = new CacheOrchestratorService(redis, jsonCache, batchSync, metrics, l3);
  return { svc, redis, jsonCache, batchSync, metrics, l3 };
}

describe('CacheOrchestratorService — cross-node L1 invalidation (#37)', () => {
  // Cycle 1 — set() publishes { key, nodeId } to cache:invalidate
  it('set() publishes { key, nodeId } to cache:invalidate after writing to L2', async () => {
    const metrics = makeMetrics('test-node');
    const { svc, redis } = makeOrchestrator({ redis: makeRedis(true), metrics });

    await svc.set('manga:1', { pages: [] });

    expect(redis.publish).toHaveBeenCalledWith(
      'cache:invalidate',
      JSON.stringify({ key: 'manga:1', nodeId: 'test-node' }),
    );
  });

  // Cycle 2 — setMangaCacheWithTiers() also publishes { key, nodeId }
  it('setMangaCacheWithTiers() publishes { key, nodeId } to cache:invalidate after writing to L2', async () => {
    const metrics = makeMetrics('test-node');
    const { svc, redis } = makeOrchestrator({ redis: makeRedis(true), metrics });

    await svc.setMangaCacheWithTiers('manga:2', { pages: [] });

    expect(redis.publish).toHaveBeenCalledWith(
      'cache:invalidate',
      JSON.stringify({ key: 'manga:2', nodeId: 'test-node' }),
    );
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

  // Cycle 9 — clears L1 before re-subscribing on reconnect (invalidation gap fix #46)
  it('onReconnect clears L1 (jsonCache.clear) before re-subscribing to invalidation channel', () => {
    const callOrder: string[] = [];
    let capturedReconnectCb: (() => void) | null = null;
    const redis = makeRedis(false);
    (redis.onReconnect as jest.Mock).mockImplementation((cb: () => void) => {
      capturedReconnectCb = cb;
      return () => {};
    });
    const jsonCache = makeJsonCache();
    (jsonCache.clear as jest.Mock).mockImplementation(() => callOrder.push('clear'));
    (redis.subscribe as jest.Mock).mockImplementation(() => callOrder.push('subscribe'));
    const { svc } = makeOrchestrator({ redis, jsonCache });

    svc.onModuleInit();
    capturedReconnectCb!();

    // clear must come before the reconnect subscribe call (index 1, not 0 which is init subscribe)
    const clearIdx = callOrder.lastIndexOf('clear');
    const subscribeIdx = callOrder.lastIndexOf('subscribe');
    expect(jsonCache.clear).toHaveBeenCalledTimes(1);
    expect(clearIdx).toBeLessThan(subscribeIdx);
  });

  // Cycle 3 — incoming invalidation from another node removes key from L1
  it('onModuleInit() subscribes to cache:invalidate; message from another node deletes key from L1', () => {
    let capturedHandler: ((data: unknown) => void) | null = null;
    const redis = makeRedis(true);
    (redis.subscribe as jest.Mock).mockImplementation((_ch: string, handler: (data: unknown) => void) => {
      capturedHandler = handler;
      return () => {};
    });
    const jsonCache = makeJsonCache();
    const metrics = makeMetrics('test-node');
    const { svc } = makeOrchestrator({ redis, jsonCache, metrics });

    svc.onModuleInit();
    capturedHandler!(JSON.stringify({ key: 'manga:1', nodeId: 'other-node' }));

    expect(jsonCache.delete).toHaveBeenCalledWith('manga:1');
  });

  // Cycle 7 — self-invalidation: same nodeId → L1 delete is skipped
  it('onModuleInit() handler does NOT delete from L1 when incoming nodeId matches own nodeId', () => {
    let capturedHandler: ((data: unknown) => void) | null = null;
    const redis = makeRedis(true);
    (redis.subscribe as jest.Mock).mockImplementation((_ch: string, handler: (data: unknown) => void) => {
      capturedHandler = handler;
      return () => {};
    });
    const jsonCache = makeJsonCache();
    const metrics = makeMetrics('test-node');
    const { svc } = makeOrchestrator({ redis, jsonCache, metrics });

    svc.onModuleInit();
    capturedHandler!(JSON.stringify({ key: 'manga:1', nodeId: 'test-node' }));

    expect(jsonCache.delete).not.toHaveBeenCalled();
  });

  // Cycle 8 — cross-node: different nodeId → L1 delete is applied
  it('onModuleInit() handler deletes from L1 when incoming nodeId differs from own nodeId', () => {
    let capturedHandler: ((data: unknown) => void) | null = null;
    const redis = makeRedis(true);
    (redis.subscribe as jest.Mock).mockImplementation((_ch: string, handler: (data: unknown) => void) => {
      capturedHandler = handler;
      return () => {};
    });
    const jsonCache = makeJsonCache();
    const metrics = makeMetrics('test-node');
    const { svc } = makeOrchestrator({ redis, jsonCache, metrics });

    svc.onModuleInit();
    capturedHandler!(JSON.stringify({ key: 'manga:1', nodeId: 'another-node' }));

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

  // FR-15 — a finite-TTL entry that has already expired in Redis must not be
  // written into L1 as if it were immortal (ttlRemainingMs <= 0 would be
  // treated as "permanent" by JsonCacheService.isExpired).
  it('get() does NOT write the L2 entry into L1 when the entry has already expired (ttlRemainingMs <= 0)', async () => {
    const entry = {
      data: { pages: [1] },
      updatedAt: new Date(Date.now() - 120_000).toISOString(), // 2 minutes ago
      ttlMs: 60_000, // 1 minute TTL — already expired by the time we read it
    };
    const redis = makeRedis(true, { 'manga:1': JSON.stringify(entry) });
    const jsonCache = makeJsonCache();
    (jsonCache.get as jest.Mock).mockReturnValue(null);
    const { svc } = makeOrchestrator({ redis, jsonCache });

    const result = await svc.get('manga:1');

    expect(jsonCache.set).not.toHaveBeenCalled();
    expect(result).toEqual({ data: entry.data, source: 'redis' });
  });
});

describe('CacheOrchestratorService — setMangaCacheWithTiers', () => {
  it('does not call markDirty() — manga cache is permanent (ttlMs=-1), no dirty-queue entry needed', async () => {
    const { svc, batchSync } = makeOrchestrator({ redis: makeRedis(true) });

    await svc.setMangaCacheWithTiers('manga:123', { pages: [] });

    expect(batchSync.markDirty).not.toHaveBeenCalled();
  });

  it('does not call markDirty() when Redis is unavailable', async () => {
    const { svc, batchSync } = makeOrchestrator({ redis: makeRedis(false) });

    await svc.setMangaCacheWithTiers('manga:123', { pages: [] });

    expect(batchSync.markDirty).not.toHaveBeenCalled();
  });
});

describe('CacheOrchestratorService — dirty fallback (#48)', () => {
  // Cycle F6 — appends to dirty fallback when Redis is unavailable
  it('set() calls l3.appendDirtyFallback(key) when Redis is unavailable', async () => {
    const l3 = makeL3();
    const { svc } = makeOrchestrator({ redis: makeRedis(false), l3 });

    await svc.set('manga:5', { pages: [] });

    expect(l3.appendDirtyFallback).toHaveBeenCalledWith('manga:5');
  });

  // Cycle F7 — does NOT append fallback when Redis is available (BatchSyncWorker handles it)
  it('set() does NOT call l3.appendDirtyFallback(key) when Redis is available', async () => {
    const l3 = makeL3();
    const { svc } = makeOrchestrator({ redis: makeRedis(true), l3 });

    await svc.set('manga:5', { pages: [] });

    expect(l3.appendDirtyFallback).not.toHaveBeenCalled();
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
