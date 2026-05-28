import { CacheOrchestratorService } from './cache-orchestrator.service';
import { RedisService } from './redis.service';
import { JsonCacheService } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';
import { L3BatchWriter } from './l3-batch-writer';

function makeRedis(available = true, store: Record<string, string> = {}): jest.Mocked<Pick<RedisService, 'available' | 'get' | 'set'>> {
  return {
    available,
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ?? null)),
    set: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeJsonCache(): jest.Mocked<Pick<JsonCacheService, 'get' | 'set' | 'getAll' | 'syncEntry' | 'isExpired'>> {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    getAll: jest.fn().mockReturnValue(new Map()),
    syncEntry: jest.fn(),
    isExpired: jest.fn().mockReturnValue(false),
  } as any;
}

function makeBatchSync(): jest.Mocked<Pick<BatchSyncWorker, 'markDirty'>> {
  return { markDirty: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeL3BatchWriter(): jest.Mocked<Pick<L3BatchWriter, 'flush'>> {
  return { flush: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeOrchestrator(overrides: {
  redis?: any; jsonCache?: any; batchSync?: any; l3BatchWriter?: any;
} = {}) {
  const redis = overrides.redis ?? makeRedis();
  const jsonCache = overrides.jsonCache ?? makeJsonCache();
  const batchSync = overrides.batchSync ?? makeBatchSync();
  const l3BatchWriter = overrides.l3BatchWriter ?? makeL3BatchWriter();
  const svc = new CacheOrchestratorService(redis, jsonCache, batchSync, l3BatchWriter);
  return { svc, redis, jsonCache, batchSync, l3BatchWriter };
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
  it('calls l3BatchWriter.flush() on graceful shutdown', async () => {
    const { svc, l3BatchWriter } = makeOrchestrator();

    await svc.onApplicationShutdown('SIGTERM');

    expect(l3BatchWriter.flush).toHaveBeenCalledTimes(1);
  });

  it('does not call jsonCache.syncEntry() on shutdown', async () => {
    const { svc, jsonCache } = makeOrchestrator();

    await svc.onApplicationShutdown('SIGTERM');

    expect(jsonCache.syncEntry).not.toHaveBeenCalled();
  });
});
