import { BatchSyncWorker, DIRTY_QUEUE, PROCESSING_QUEUE } from './batch-sync.worker';
import { RedisService } from './redis.service';
import { ElectionService } from '../status/election.service';
import { L3DiskService } from './l3-disk.service';
import { CacheEntry } from './json-cache.service';

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

function makeL3() {
  return { write: jest.fn() } as unknown as L3DiskService;
}

function makeWorker(
  dirtyQueue: string[],
  store: Record<string, string>,
  isLeader: boolean,
  processingQueue: string[] = [],
) {
  const redis = makeRedis(dirtyQueue, store, processingQueue);
  const l3 = makeL3();
  return {
    worker: new BatchSyncWorker(redis, makeElection(isLeader), l3),
    redis,
    l3,
  };
}

describe('BatchSyncWorker — Reliable Queue', () => {
  describe('uses RPOPLPUSH instead of LPOP', () => {
    it('calls rpoplpush to atomically move key from dirty to processing queue', async () => {
      const entry = makeEntry('hello');
      const redis = makeRedis(['key-1'], { 'key-1': JSON.stringify(entry) });
      const worker = new BatchSyncWorker(redis, makeElection(true), makeL3());

      await (worker as any).flush();

      expect((redis as any)._client.rpoplpush).toHaveBeenCalledWith(DIRTY_QUEUE, PROCESSING_QUEUE);
    });

    it('does not flush when not leader', async () => {
      const redis = makeRedis(['key-1']);
      const worker = new BatchSyncWorker(redis, makeElection(false), makeL3());

      await (worker as any).flush();

      expect((redis as any)._client.rpoplpush).not.toHaveBeenCalled();
    });
  });

  describe('Leader re-syncs L2 → L3 via L3DiskService', () => {
    it('calls l3.write with entry from L2 after pulling key from dirty queue', async () => {
      const entry = makeEntry(42);
      const redis = makeRedis(['key-a'], { 'key-a': JSON.stringify(entry) });
      const l3 = makeL3();
      const worker = new BatchSyncWorker(redis, makeElection(true), l3);

      await (worker as any).flush();

      expect(l3.write).toHaveBeenCalledWith('key-a', expect.objectContaining({ data: 42 }));
    });

    it('does not call l3.write when key is missing from L2 (expired)', async () => {
      const redis = makeRedis(['ghost-key'], {}); // nothing in store
      const l3 = makeL3();
      const worker = new BatchSyncWorker(redis, makeElection(true), l3);

      await (worker as any).flush();

      expect(l3.write).not.toHaveBeenCalled();
    });
  });

  describe('acknowledges successful sync with LREM', () => {
    it('calls lrem on processing queue after successful L3 write', async () => {
      const entry = makeEntry(42);
      const redis = makeRedis(['key-a'], { 'key-a': JSON.stringify(entry) });
      const worker = new BatchSyncWorker(redis, makeElection(true), makeL3());

      await (worker as any).flush();

      expect((redis as any)._client.lrem).toHaveBeenCalledWith(PROCESSING_QUEUE, 1, 'key-a');
    });

    it('does not call lrem when key is missing from L2 (skip)', async () => {
      const redis = makeRedis(['ghost-key'], {}); // nothing in store
      const worker = new BatchSyncWorker(redis, makeElection(true), makeL3());

      await (worker as any).flush();

      expect((redis as any)._client.lrem).not.toHaveBeenCalled();
    });
  });

  describe('crash recovery — re-queues orphaned processing entries on init', () => {
    it('moves entries from processing queue back to dirty queue on onModuleInit', async () => {
      const redis = makeRedis([], {}, ['orphan-1', 'orphan-2']);
      const worker = new BatchSyncWorker(redis, makeElection(false), makeL3());

      await worker.onModuleInit();

      expect((redis as any)._client.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'orphan-1');
      expect((redis as any)._client.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'orphan-2');
    });

    it('does not call rpush when processing queue is empty', async () => {
      const redis = makeRedis([], {}, []);
      const worker = new BatchSyncWorker(redis, makeElection(false), makeL3());

      await worker.onModuleInit();

      expect((redis as any)._client.rpush).not.toHaveBeenCalled();
    });
  });

  describe('markDirty', () => {
    it('pushes key to dirty queue via rpush', async () => {
      const redis = makeRedis([]);
      const worker = new BatchSyncWorker(redis, makeElection(false), makeL3());

      await worker.markDirty('some-key');

      expect((redis as any)._client.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'some-key');
    });
  });

  describe('corrupt Redis data', () => {
    it('skips corrupt entries without throwing', async () => {
      const redis = makeRedis(['bad-key'], { 'bad-key': 'not-json{{{' });
      const worker = new BatchSyncWorker(redis, makeElection(true), makeL3());

      await expect((worker as any).flush()).resolves.not.toThrow();
    });
  });
});
