import { CacheOrchestratorService } from './cache-orchestrator.service';
import { RedisService } from './redis.service';
import { JsonCacheService } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';

function makeRedis(available = true, store: Record<string, string> = {}): jest.Mocked<Pick<RedisService, 'available' | 'get' | 'set'>> {
  return {
    available,
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ?? null)),
    set: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeJsonCache(): jest.Mocked<Pick<JsonCacheService, 'get' | 'set' | 'getAll' | 'isExpired'>> {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
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
