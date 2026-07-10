import { L2RecoveryService } from './l2-recovery.service';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { L3DiskService } from './l3-disk.service';
import { ElectionService } from '../status/election.service';
import { DIRTY_QUEUE } from './batch-sync.worker';

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;
const PIPELINE_CHUNK_SIZE = 500;

function makeEntry(
  overrides: Partial<CacheEntry<unknown>> = {},
): CacheEntry<unknown> {
  return {
    data: { value: 'test' },
    updatedAt: new Date().toISOString(),
    ttlMs: 60_000,
    ...overrides,
  };
}

function makePipeline() {
  return {
    set: jest.fn().mockReturnThis(),
    rpush: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
}

function makeRedis(available = true) {
  const created: ReturnType<typeof makePipeline>[] = [];
  const client = {
    pipeline: jest.fn().mockImplementation(() => {
      const p = makePipeline();
      created.push(p);
      return p;
    }),
    get created() {
      return created;
    },
  };
  return {
    available,
    onReconnect: jest.fn().mockReturnValue(() => {}),
    getClient: jest.fn().mockResolvedValue(available ? client : null),
    get _client() {
      return client;
    },
  } as any;
}

function makeJsonCache(
  entries: Map<string, CacheEntry<unknown>> = new Map(),
): jest.Mocked<Pick<JsonCacheService, 'keys' | 'peek' | 'isExpired'>> {
  return {
    keys: jest.fn().mockImplementation(() => entries.keys()),
    peek: jest.fn().mockImplementation((k: string) => entries.get(k) ?? null),
    isExpired: jest.fn().mockImplementation((entry: CacheEntry<unknown>) => {
      if (entry.ttlMs <= 0) return false;
      return Date.now() - new Date(entry.updatedAt).getTime() > entry.ttlMs;
    }),
  } as any;
}

function makeL3(
  entries: Map<string, CacheEntry<unknown>> = new Map(),
  fallbackKeys: string[] = [],
): jest.Mocked<Pick<L3DiskService, 'readAll' | 'drainDirtyFallback'>> {
  return {
    readAll: jest.fn().mockReturnValue(entries),
    drainDirtyFallback: jest.fn().mockReturnValue(fallbackKeys),
  } as any;
}

function makeElection(
  isLeader = true,
): jest.Mocked<Pick<ElectionService, 'isLeader' | 'onBecomeLeader'>> {
  return { isLeader, onBecomeLeader: jest.fn() } as any;
}

function makeService(
  overrides: { redis?: any; jsonCache?: any; l3?: any; election?: any } = {},
) {
  const redis = overrides.redis ?? makeRedis();
  const jsonCache = overrides.jsonCache ?? makeJsonCache();
  const l3 = overrides.l3 ?? makeL3();
  const election = overrides.election ?? makeElection();
  const svc = new L2RecoveryService(
    redis as unknown as RedisService,
    jsonCache as unknown as JsonCacheService,
    l3 as unknown as L3DiskService,
    election as unknown as ElectionService,
  );
  return { svc, redis, jsonCache, l3, election };
}

describe('L2RecoveryService', () => {
  afterEach(() => jest.restoreAllMocks());

  // Cycle 1 — writes non-expired L1 entry to L2 via pipeline.set
  it('recover() calls pipeline.set for each non-expired L1 entry', async () => {
    const entry = makeEntry({ ttlMs: 60_000 });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', entry]])),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.set).toHaveBeenCalledWith(
      'key:1',
      JSON.stringify(entry),
      'EX',
      expect.any(Number),
    );
  });

  // FR-5 regression — a key present at keys()-snapshot time may be evicted from L1
  // during the getClient() await; peek() then returns null and it is not on L3.
  // recover() must skip it, not throw (the old getAll() snapshot was immune).
  it('recover() skips (does not throw) a key evicted from L1 after the keys snapshot', async () => {
    const jsonCache = {
      keys: jest
        .fn()
        .mockImplementation(() => ['evicted:key'][Symbol.iterator]()),
      peek: jest.fn().mockReturnValue(null), // evicted between snapshot and read
      isExpired: jest
        .fn()
        .mockImplementation(
          (e: CacheEntry<unknown>) =>
            e.ttlMs > 0 &&
            Date.now() - new Date(e.updatedAt).getTime() > e.ttlMs,
        ),
    };
    const { svc } = makeService({ jsonCache, l3: makeL3(new Map()) });

    await expect(svc.recover()).resolves.toMatchObject({ skipped: 1 });
  });

  // Cycle 2 — skips expired entries — no pipeline created
  it('recover() does not create a pipeline for expired-only L1 entries', async () => {
    const expired = makeEntry({
      ttlMs: 1,
      updatedAt: new Date(Date.now() - 5000).toISOString(),
    });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:old', expired]])),
    });

    await svc.recover();

    expect(redis._client.pipeline).not.toHaveBeenCalled();
  });

  // Cycle 3 — enqueues key to dirty queue via pipeline.rpush
  it('recover() calls pipeline.rpush(DIRTY_QUEUE, key) for each synced key', async () => {
    const entry = makeEntry();
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', entry]])),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'key:1');
  });

  // Cycle 4 — returns { synced, skipped } counts
  it('recover() returns synced and skipped counts', async () => {
    const fresh = makeEntry({ ttlMs: 60_000 });
    const expired = makeEntry({
      ttlMs: 1,
      updatedAt: new Date(Date.now() - 5000).toISOString(),
    });
    const { svc } = makeService({
      jsonCache: makeJsonCache(
        new Map([
          ['key:a', fresh],
          ['key:b', expired],
        ]),
      ),
    });

    const result = await svc.recover();

    expect(result).toEqual({ synced: 1, skipped: 1 });
  });

  // Cycle 5 — pipeline chunk failure does not abort subsequent chunks
  it('recover() continues to next pipeline chunk when exec fails for one chunk', async () => {
    const entries = new Map<string, CacheEntry<unknown>>();
    for (let i = 0; i < PIPELINE_CHUNK_SIZE + 100; i++) {
      entries.set(`key:${i}`, makeEntry());
    }
    const redis = makeRedis();
    // First pipeline.exec will fail
    (redis._client.pipeline as jest.Mock).mockImplementationOnce(() => {
      const p = makePipeline();
      p.exec.mockRejectedValue(new Error('chunk 1 failed'));
      return p;
    });

    const { svc } = makeService({ jsonCache: makeJsonCache(entries), redis });

    const result = await svc.recover();

    expect(result.synced).toBe(100); // second chunk succeeded
    expect(redis._client.pipeline).toHaveBeenCalledTimes(2); // both chunks attempted
  });

  // Cycle 6 — no-op when L1 and L3 are empty
  it('recover() makes no Redis calls when L1 and L3 are both empty', async () => {
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map()),
    });

    const result = await svc.recover();

    expect(redis.getClient).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, skipped: 0 });
  });

  // Cycle 7 — permanent entries use 7-day TTL in pipeline
  it('recover() writes permanent entries (ttlMs <= 0) with a 7-day TTL via pipeline', async () => {
    const permanent = makeEntry({ ttlMs: -1 });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:perm', permanent]])),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.set).toHaveBeenCalledWith(
      'key:perm',
      JSON.stringify(permanent),
      'EX',
      SEVEN_DAYS_S,
    );
  });

  // Cycle 8 — onBecomeLeader callback triggers recover()
  it('onModuleInit() registers onBecomeLeader; when the callback fires, recover() is called', async () => {
    let capturedCb: (() => void) | null = null;
    const election = makeElection(false);
    (election.onBecomeLeader as jest.Mock).mockImplementation(
      (cb: () => void) => {
        capturedCb = cb;
      },
    );
    const { svc } = makeService({ election });
    const spy = jest
      .spyOn(svc, 'recover')
      .mockResolvedValue({ synced: 0, skipped: 0 });

    await svc.onModuleInit();
    capturedCb!();

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
    const spy = jest
      .spyOn(svc, 'recover')
      .mockResolvedValue({ synced: 0, skipped: 0 });

    await svc.onModuleInit();
    capturedCb!();

    expect(spy).toHaveBeenCalled();
  });

  // Cycle 10 — L3-wins when L3 entry is newer than L1
  it('recover() writes L3 entry when L3 has a newer updatedAt than L1 for the same key', async () => {
    const older = makeEntry({
      updatedAt: new Date(Date.now() - 10_000).toISOString(),
    });
    const newer = makeEntry({
      updatedAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', older]])),
      l3: makeL3(new Map([['key:1', newer]])),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.set).toHaveBeenCalledWith(
      'key:1',
      JSON.stringify(newer),
      'EX',
      expect.any(Number),
    );
  });

  // Cycle 11 — L1-wins when L1 entry is newer than L3
  it('recover() writes L1 entry when L1 has a newer updatedAt than L3 for the same key', async () => {
    const newer = makeEntry({
      updatedAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const older = makeEntry({
      updatedAt: new Date(Date.now() - 10_000).toISOString(),
    });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', newer]])),
      l3: makeL3(new Map([['key:1', older]])),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.set).toHaveBeenCalledWith(
      'key:1',
      JSON.stringify(newer),
      'EX',
      expect.any(Number),
    );
  });

  // Cycle 12 — L3-only key (not in L1) is written to L2
  it('recover() writes a key that exists only in L3 (not in L1) to L2', async () => {
    const entry = makeEntry();
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map()),
      l3: makeL3(new Map([['key:l3only', entry]])),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.set).toHaveBeenCalledWith(
      'key:l3only',
      JSON.stringify(entry),
      'EX',
      expect.any(Number),
    );
  });

  // Cycle 13 — L3-only expired entry is skipped
  it('recover() skips a key that exists only in L3 when that entry is expired', async () => {
    const expired = makeEntry({
      ttlMs: 1,
      updatedAt: new Date(Date.now() - 5000).toISOString(),
    });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map()),
      l3: makeL3(new Map([['key:l3exp', expired]])),
    });

    await svc.recover();

    expect(redis._client.pipeline).not.toHaveBeenCalled();
  });

  // Cycle 14 — same key in both L1 and L3, both expired → skip
  it('recover() skips a key when both L1 and L3 entries are expired', async () => {
    const expiredL1 = makeEntry({
      ttlMs: 1,
      updatedAt: new Date(Date.now() - 5000).toISOString(),
    });
    const expiredL3 = makeEntry({
      ttlMs: 1,
      updatedAt: new Date(Date.now() - 3000).toISOString(),
    });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', expiredL1]])),
      l3: makeL3(new Map([['key:1', expiredL3]])),
    });

    await svc.recover();

    expect(redis._client.pipeline).not.toHaveBeenCalled();
  });

  // Cycle 15 — equal timestamps: L1 wins (prefer in-memory over disk on tie)
  it('recover() uses L1 entry when L1 and L3 have identical updatedAt', async () => {
    const ts = new Date(Date.now() - 1_000).toISOString();
    const l1Entry = makeEntry({ updatedAt: ts, data: { source: 'l1' } });
    const l3Entry = makeEntry({ updatedAt: ts, data: { source: 'l3' } });
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['key:1', l1Entry]])),
      l3: makeL3(new Map([['key:1', l3Entry]])),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.set).toHaveBeenCalledWith(
      'key:1',
      JSON.stringify(l1Entry),
      'EX',
      expect.any(Number),
    );
  });

  // Cycle 16 — onModuleInit never calls recover() directly
  it('onModuleInit() does not call recover() directly — recovery is deferred to onBecomeLeader event', async () => {
    const { svc } = makeService({
      redis: makeRedis(true),
      election: makeElection(true),
    });
    const spy = jest
      .spyOn(svc, 'recover')
      .mockResolvedValue({ synced: 0, skipped: 0 });

    await svc.onModuleInit();

    expect(spy).not.toHaveBeenCalled();
  });

  // Cycle 17 — non-leader: onReconnect does not trigger recover()
  it('onReconnect callback does not call recover() when node is not the leader', async () => {
    let capturedCb: (() => void) | null = null;
    const redis = makeRedis(false);
    (redis.onReconnect as jest.Mock).mockImplementation((cb: () => void) => {
      capturedCb = cb;
      return () => {};
    });
    const { svc } = makeService({ redis, election: makeElection(false) });
    const spy = jest
      .spyOn(svc, 'recover')
      .mockResolvedValue({ synced: 0, skipped: 0 });

    await svc.onModuleInit();
    capturedCb!();

    expect(spy).not.toHaveBeenCalled();
  });

  // Cycle P1 — keys are chunked into pipeline batches of PIPELINE_CHUNK_SIZE
  it(`recover() creates a new pipeline for every ${PIPELINE_CHUNK_SIZE} keys (chunked batching)`, async () => {
    const entries = new Map<string, CacheEntry<unknown>>();
    for (let i = 0; i < PIPELINE_CHUNK_SIZE * 2; i++) {
      entries.set(`key:${i}`, makeEntry());
    }
    const { svc, redis } = makeService({ jsonCache: makeJsonCache(entries) });

    await svc.recover();

    expect(redis._client.pipeline).toHaveBeenCalledTimes(2);
  });

  // Cycle P2 — Redis unavailable: recover() returns early
  it('recover() returns { synced: 0, skipped: 0 } immediately when Redis client is unavailable', async () => {
    const entry = makeEntry();
    const { svc, redis } = makeService({
      redis: makeRedis(false),
      jsonCache: makeJsonCache(new Map([['key:1', entry]])),
    });

    const result = await svc.recover();

    expect(result).toEqual({ synced: 0, skipped: 0 });
    expect(redis._client.pipeline).not.toHaveBeenCalled();
  });
});

describe('L2RecoveryService — dirty fallback drain (#48)', () => {
  // Cycle F8 — drains fallback and re-queues keys to DIRTY_QUEUE via pipeline
  it('recover() calls l3.drainDirtyFallback() and rpushes each returned key to DIRTY_QUEUE', async () => {
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map()),
      l3: makeL3(new Map(), ['fallback-key-1', 'fallback-key-2']),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'fallback-key-1');
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'fallback-key-2');
  });

  // Cycle F9 — no fallback keys: drainDirtyFallback still called (no-op)
  it('recover() calls l3.drainDirtyFallback() even when L1 and L3 are empty', async () => {
    const l3 = makeL3(new Map(), []);
    const { svc } = makeService({ jsonCache: makeJsonCache(new Map()), l3 });

    await svc.recover();

    expect(l3.drainDirtyFallback).toHaveBeenCalled();
  });

  // Cycle F10 — fallback keys mixed with L1 keys: both are re-queued
  it('recover() re-queues both L1 keys and fallback-only keys to DIRTY_QUEUE', async () => {
    const entry = makeEntry();
    const { svc, redis } = makeService({
      jsonCache: makeJsonCache(new Map([['l1-key', entry]])),
      l3: makeL3(new Map(), ['fallback-key']),
    });

    await svc.recover();

    const pipe = redis._client.created[0];
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'l1-key');
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'fallback-key');
  });
});
