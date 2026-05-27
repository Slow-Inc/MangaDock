import { BatchSyncWorker, DIRTY_QUEUE, PROCESSING_QUEUE } from './batch-sync.worker';
import { RedisService } from './redis.service';
import { ElectionService } from '../status/election.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';

function makeEntry<T>(data: T): CacheEntry<T> {
  return { data, updatedAt: new Date().toISOString(), ttlMs: 60_000 };
}

function makeClient(dirtyQueue: string[], store: Record<string, string> = {}, processingQueue: string[] = []) {
  return {
    rpoplpush: jest.fn().mockImplementation(() => Promise.resolve(dirtyQueue.shift() ?? null)),
    rpush: jest.fn().mockResolvedValue(1),
    lrem: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue(processingQueue),
  };
}

function makeRedis(dirtyQueue: string[], store: Record<string, string> = {}, processingQueue: string[] = []) {
  const client = makeClient(dirtyQueue, store, processingQueue);
  return {
    getClient: jest.fn().mockResolvedValue(client),
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ?? null)),
    _client: client,
  } as unknown as RedisService;
}

function makeElection(isLeader: boolean) {
  return { isLeader } as unknown as ElectionService;
}

function makeJsonCache() {
  return { syncEntry: jest.fn() } as unknown as JsonCacheService;
}

function makeWorker(
  dirtyQueue: string[],
  store: Record<string, string>,
  isLeader: boolean,
  processingQueue: string[] = [],
) {
  const redis = makeRedis(dirtyQueue, store, processingQueue);
  const jc = makeJsonCache();
  return {
    worker: new BatchSyncWorker(redis, makeElection(isLeader), jc),
    redis,
    jsonCache: jc,
  };
}

describe('BatchSyncWorker — Reliable Queue', () => {
  describe('uses RPOPLPUSH instead of LPOP', () => {
    it('calls rpoplpush to atomically move key from dirty to processing queue', async () => {
      const entry = makeEntry('hello');
      const redis = makeRedis(['key-1'], { 'key-1': JSON.stringify(entry) });
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(true), jsonCache);

      await (worker as any).flush();

      expect((redis as any)._client.rpoplpush).toHaveBeenCalledWith(DIRTY_QUEUE, PROCESSING_QUEUE);
    });

    it('does not flush when not leader', async () => {
      const redis = makeRedis(['key-1']);
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(false), jsonCache);

      await (worker as any).flush();

      expect((redis as any)._client.rpoplpush).not.toHaveBeenCalled();
    });
  });

  describe('acknowledges successful sync with LREM', () => {
    it('calls lrem on processing queue after successful syncKey', async () => {
      const entry = makeEntry(42);
      const redis = makeRedis(['key-a'], { 'key-a': JSON.stringify(entry) });
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(true), jsonCache);

      await (worker as any).flush();

      expect((redis as any)._client.lrem).toHaveBeenCalledWith(PROCESSING_QUEUE, 1, 'key-a');
    });

    it('does not call lrem when key is missing from Redis (skip)', async () => {
      const redis = makeRedis(['ghost-key'], {}); // nothing in store
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(true), jsonCache);

      await (worker as any).flush();

      expect((redis as any)._client.lrem).not.toHaveBeenCalled();
    });
  });

  describe('crash recovery — re-queues orphaned processing entries on init', () => {
    it('moves entries from processing queue back to dirty queue on onModuleInit', async () => {
      const redis = makeRedis([], {}, ['orphan-1', 'orphan-2']);
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(false), jsonCache);

      await worker.onModuleInit();

      expect((redis as any)._client.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'orphan-1');
      expect((redis as any)._client.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'orphan-2');
    });

    it('does not call rpush when processing queue is empty', async () => {
      const redis = makeRedis([], {}, []);
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(false), jsonCache);

      await worker.onModuleInit();

      expect((redis as any)._client.rpush).not.toHaveBeenCalled();
    });
  });

  describe('markDirty', () => {
    it('pushes key to dirty queue via rpush', async () => {
      const redis = makeRedis([]);
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(false), jsonCache);

      await worker.markDirty('some-key');

      expect((redis as any)._client.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'some-key');
    });
  });

  describe('corrupt Redis data', () => {
    it('skips corrupt entries without throwing', async () => {
      const redis = makeRedis(['bad-key'], { 'bad-key': 'not-json{{{' });
      const jsonCache = makeJsonCache();
      const worker = new BatchSyncWorker(redis, makeElection(true), jsonCache);

      await expect((worker as any).flush()).resolves.not.toThrow();
    });
  });
});
