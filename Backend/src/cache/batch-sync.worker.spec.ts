import { BatchSyncWorker, DIRTY_QUEUE, PROCESSING_QUEUE } from './batch-sync.worker';
import { RedisService } from './redis.service';
import { ElectionService } from '../status/election.service';
import { L3DiskService } from './l3-disk.service';
import { SupabaseService } from '../supabase/supabase.service';
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
    del: jest.fn().mockResolvedValue(1),
    eval: jest.fn().mockResolvedValue(processingQueue.length),
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

function makeSupabase(rpcError: Error | null = null): { client: { rpc: jest.Mock }; _rpc: jest.Mock } & SupabaseService {
  const rpc = rpcError
    ? jest.fn().mockResolvedValue({ data: null, error: rpcError })
    : jest.fn().mockResolvedValue({ data: {}, error: null });
  return { client: { rpc }, _rpc: rpc } as any;
}

function makeWorker(
  dirtyQueue: string[],
  store: Record<string, string> = {},
  isLeader: boolean = true,
  processingQueue: string[] = [],
  supabase: ReturnType<typeof makeSupabase> = makeSupabase(),
) {
  const redis = makeRedis(dirtyQueue, store, processingQueue);
  const l3 = makeL3();
  return {
    worker: new BatchSyncWorker(redis, makeElection(isLeader), l3, supabase as unknown as SupabaseService),
    redis,
    l3,
    supabase,
  };
}

describe('BatchSyncWorker — Reliable Queue', () => {
  describe('uses RPOPLPUSH instead of LPOP', () => {
    it('calls rpoplpush to atomically move key from dirty to processing queue', async () => {
      const entry = makeEntry('hello');
      const { worker, redis } = makeWorker(['key-1'], { 'key-1': JSON.stringify(entry) });

      await (worker as any).flush();

      expect((redis as any)._client.rpoplpush).toHaveBeenCalledWith(DIRTY_QUEUE, PROCESSING_QUEUE);
    });

    it('does not flush when not leader', async () => {
      const { worker, redis } = makeWorker(['key-1'], {}, false);

      await (worker as any).flush();

      expect((redis as any)._client.rpoplpush).not.toHaveBeenCalled();
    });
  });

  describe('Leader re-syncs L2 → L3 via L3DiskService', () => {
    it('calls l3.write with entry from L2 after pulling key from dirty queue', async () => {
      const entry = makeEntry(42);
      const { worker, l3 } = makeWorker(['key-a'], { 'key-a': JSON.stringify(entry) });

      await (worker as any).flush();

      expect(l3.write).toHaveBeenCalledWith('key-a', expect.objectContaining({ data: 42 }));
    });

    it('does not call l3.write when key is missing from L2 (expired)', async () => {
      const { worker, l3 } = makeWorker(['ghost-key'], {});

      await (worker as any).flush();

      expect(l3.write).not.toHaveBeenCalled();
    });
  });

  describe('Supabase RPC persistence (#43)', () => {
    // Cycle S1 — RPC is called with key and parsed entry after L3 write
    it('calls supabase.client.rpc with key and entry after writing to L3', async () => {
      const entry = makeEntry(42);
      const { worker, supabase } = makeWorker(['key-a'], { 'key-a': JSON.stringify(entry) });

      await (worker as any).flush();

      expect(supabase._rpc).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ p_key: 'key-a' }),
      );
    });

    // Cycle S2 — lrem NOT called when RPC returns an error object
    it('does NOT call lrem when Supabase RPC returns an error — key stays in processing for retry', async () => {
      const entry = makeEntry(42);
      const supabase = makeSupabase(new Error('DB timeout'));
      const { worker, redis } = makeWorker(['key-a'], { 'key-a': JSON.stringify(entry) }, true, [], supabase);

      await (worker as any).flush();

      expect((redis as any)._client.lrem).not.toHaveBeenCalledWith(PROCESSING_QUEUE, 1, 'key-a');
    });

    // Cycle S3 — lrem called only after RPC succeeds
    it('calls lrem on processing queue only after Supabase RPC succeeds', async () => {
      const entry = makeEntry(42);
      const { worker, redis } = makeWorker(['key-a'], { 'key-a': JSON.stringify(entry) });

      await (worker as any).flush();

      expect((redis as any)._client.lrem).toHaveBeenCalledWith(PROCESSING_QUEUE, 1, 'key-a');
    });

    // Cycle S4 — expired key: lrem without RPC (no data to sync)
    it('calls lrem without calling RPC when key is expired in L2 — prevents permanent orphan', async () => {
      const { worker, redis, supabase } = makeWorker(['ghost-key'], {});

      await (worker as any).flush();

      expect((redis as any)._client.lrem).toHaveBeenCalledWith(PROCESSING_QUEUE, 1, 'ghost-key');
      expect(supabase._rpc).not.toHaveBeenCalled();
    });
  });

  describe('acknowledges successful sync with LREM', () => {
    it('calls lrem on processing queue after successful L3 write and RPC', async () => {
      const entry = makeEntry(42);
      const { worker, redis } = makeWorker(['key-a'], { 'key-a': JSON.stringify(entry) });

      await (worker as any).flush();

      expect((redis as any)._client.lrem).toHaveBeenCalledWith(PROCESSING_QUEUE, 1, 'key-a');
    });

    it('calls lrem to ack even when key is expired in L2 — prevents permanent orphan in cache:processing', async () => {
      const { worker, redis } = makeWorker(['ghost-key'], {});

      await (worker as any).flush();

      expect((redis as any)._client.lrem).toHaveBeenCalledWith(PROCESSING_QUEUE, 1, 'ghost-key');
    });
  });

  describe('crash recovery — leader-only, on first flush as leader', () => {
    it('calls EVAL to atomically move orphans from processing to dirty queue on first flush as leader', async () => {
      const { worker, redis } = makeWorker([], {}, true, ['orphan-1', 'orphan-2']);

      await (worker as any).flush();

      expect((redis as any)._client.eval).toHaveBeenCalledWith(
        expect.stringContaining('LRANGE'),
        2,
        PROCESSING_QUEUE,
        DIRTY_QUEUE,
      );
    });

    it('does not call EVAL for orphan recovery on onModuleInit — recovery is leader-only at flush time', async () => {
      const { worker, redis } = makeWorker([], {}, false, ['orphan-1']);

      await worker.onModuleInit();

      expect((redis as any)._client.eval).not.toHaveBeenCalled();
    });

    it('does not call EVAL for orphan recovery on a second consecutive flush as leader', async () => {
      const { worker, redis } = makeWorker([], {}, true, ['orphan-1']);

      await (worker as any).flush();
      (redis as any)._client.eval.mockClear();
      await (worker as any).flush();

      expect((redis as any)._client.eval).not.toHaveBeenCalled();
    });

    it('does not call DEL or RPUSH directly during recovery — Lua handles it atomically', async () => {
      const { worker, redis } = makeWorker([], {}, true, ['orphan-1', 'orphan-2']);

      await (worker as any).flush();

      expect((redis as any)._client.del).not.toHaveBeenCalled();
      expect((redis as any)._client.rpush).not.toHaveBeenCalled();
    });

    it('runs orphan recovery again when node re-acquires leadership after losing it', async () => {
      let leaderState = true;
      const election = { get isLeader() { return leaderState; } } as unknown as ElectionService;
      const redis = makeRedis([], {}, ['orphan-1']);
      const worker = new BatchSyncWorker(redis, election, makeL3(), makeSupabase() as any);

      await (worker as any).flush(); // leader → recovers
      (redis as any)._client.eval.mockClear();
      leaderState = false;
      await (worker as any).flush(); // non-leader → resets flag
      leaderState = true;
      await (worker as any).flush(); // leader again → recovers again

      expect((redis as any)._client.eval).toHaveBeenCalledWith(
        expect.stringContaining('LRANGE'),
        2,
        PROCESSING_QUEUE,
        DIRTY_QUEUE,
      );
    });
  });

  describe('markDirty', () => {
    it('pushes key to dirty queue via rpush', async () => {
      const { worker, redis } = makeWorker([], {}, false);

      await worker.markDirty('some-key');

      expect((redis as any)._client.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'some-key');
    });
  });

  describe('corrupt Redis data', () => {
    it('skips corrupt entries without throwing', async () => {
      const { worker } = makeWorker(['bad-key'], { 'bad-key': 'not-json{{{' });

      await expect((worker as any).flush()).resolves.not.toThrow();
    });
  });

  describe('conditional upsert RPC params (#59)', () => {
    // U1 — RPC called with p_data, p_updated_at, p_ttl_ms (not p_entry)
    it('calls upsert_cache_entry with p_data, p_updated_at, and p_ttl_ms from the cache entry', async () => {
      const entry = makeEntry({ title: 'One Piece' });
      const { worker, supabase } = makeWorker(['key-a'], { 'key-a': JSON.stringify(entry) });

      await (worker as any).flush();

      expect(supabase._rpc).toHaveBeenCalledWith(
        'upsert_cache_entry',
        expect.objectContaining({
          p_key: 'key-a',
          p_data: { title: 'One Piece' },
          p_updated_at: entry.updatedAt,
          p_ttl_ms: 60_000,
        }),
      );
    });

    // U2 — p_entry not passed (legacy param removed)
    it('does not pass the legacy p_entry param to the RPC', async () => {
      const entry = makeEntry({ title: 'Naruto' });
      const { worker, supabase } = makeWorker(['key-b'], { 'key-b': JSON.stringify(entry) });

      await (worker as any).flush();

      const [, params] = supabase._rpc.mock.calls[0];
      expect(params).not.toHaveProperty('p_entry');
    });
  });
});
