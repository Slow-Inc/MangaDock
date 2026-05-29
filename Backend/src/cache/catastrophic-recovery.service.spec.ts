import { CatastrophicRecoveryService } from './catastrophic-recovery.service';
import { RedisService } from './redis.service';
import { L3DiskService } from './l3-disk.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { CacheEntry } from './json-cache.service';
import { DIRTY_QUEUE } from './batch-sync.worker';

const SUPABASE_BATCH_SIZE = 100;

const PIPELINE_CHUNK_SIZE = 500;

function makeEntry(overrides: Partial<CacheEntry<unknown>> = {}): CacheEntry<unknown> {
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

function makeRedis(available = false) {
  const createdPipelines: ReturnType<typeof makePipeline>[] = [];
  const client = {
    pipeline: jest.fn().mockImplementation(() => {
      const p = makePipeline();
      createdPipelines.push(p);
      return p;
    }),
    get created() { return createdPipelines; },
  };
  return {
    available,
    onReconnect: jest.fn().mockReturnValue(() => {}),
    getClient: jest.fn().mockResolvedValue(client),
    get _client() { return client; },
  } as any;
}

function makeL3(entries: Map<string, CacheEntry<unknown>> = new Map()): jest.Mocked<Pick<L3DiskService, 'readAll'>> {
  return { readAll: jest.fn().mockReturnValue(entries) } as any;
}

type SupabaseRow = { key: string; data: unknown; updated_at: string; ttl_ms: number };

function makeSupabase(
  rowsOrCallbacks: Array<{ data: SupabaseRow[]; error: any }> | { data: SupabaseRow[]; error: any } = { data: [], error: null },
) {
  const responses = Array.isArray(rowsOrCallbacks) ? rowsOrCallbacks : [rowsOrCallbacks];
  let callIdx = 0;
  const inFn = jest.fn().mockImplementation(() => Promise.resolve(responses[callIdx++] ?? { data: [], error: null }));
  return {
    client: {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ in: inFn }),
      }),
    },
    _in: inFn,
  } as unknown as SupabaseService & { _in: jest.Mock };
}

type ReconnectCb = () => Promise<void>;

function makeService(overrides: { redis?: any; l3?: any; supabase?: any } = {}) {
  const redis = overrides.redis ?? makeRedis(false);
  const l3 = overrides.l3 ?? makeL3();
  const supabase = overrides.supabase ?? makeSupabase();
  const svc = new CatastrophicRecoveryService(
    redis as unknown as RedisService,
    l3 as unknown as L3DiskService,
    supabase as unknown as SupabaseService,
  );
  return { svc, redis, l3, supabase };
}

describe('CatastrophicRecoveryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // T1 — Tracer bullet: early exit when Redis available at boot
  it('does not read L3 when Redis is already available at startup', async () => {
    const l3 = makeL3(new Map());
    const { svc } = makeService({ redis: makeRedis(true), l3 });

    await svc.onModuleInit();

    expect(l3.readAll).not.toHaveBeenCalled();
  });

  // T2 — Reads L3 when Redis unavailable
  it('reads all L3 entries when Redis is unavailable at startup', async () => {
    const l3 = makeL3(new Map([['key:1', makeEntry()]]));
    const { svc } = makeService({ redis: makeRedis(false), l3 });

    await svc.onModuleInit();

    expect(l3.readAll).toHaveBeenCalledTimes(1);
  });

  // T3 — Empty L3: no reconnect callback registered
  it('does not register a reconnect callback when L3 is empty', async () => {
    const redis = makeRedis(false);
    const { svc } = makeService({ redis, l3: makeL3(new Map()) });

    await svc.onModuleInit();

    expect(redis.onReconnect).not.toHaveBeenCalled();
  });

  // T4 — Non-empty L3: registers reconnect callback
  it('registers a reconnect callback when L3 has entries and Redis is unavailable', async () => {
    const redis = makeRedis(false);
    const { svc } = makeService({ redis, l3: makeL3(new Map([['key:1', makeEntry()]])) });

    await svc.onModuleInit();

    expect(redis.onReconnect).toHaveBeenCalledTimes(1);
  });

  // T5 — Reconnect: pipeline SET for each L3 entry
  it('writes L3 entries to L2 via pipeline SET when Redis reconnects', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const entry = makeEntry({ ttlMs: 60_000 });
    const redis = makeRedis(false);
    let reconnectCb!: ReconnectCb;
    (redis.onReconnect as jest.Mock).mockImplementation((cb: ReconnectCb) => {
      reconnectCb = cb;
      return () => {};
    });
    const { svc } = makeService({ redis, l3: makeL3(new Map([['key:1', entry]])) });

    await svc.onModuleInit();
    await reconnectCb();

    const pipe = redis._client.created[0];
    expect(pipe.set).toHaveBeenCalledWith('key:1', expect.any(String), 'EX', expect.any(Number));
    expect(pipe.exec).toHaveBeenCalled();
  });

  // T6 — Reconnect: rpush to DIRTY_QUEUE for each key
  it('enqueues each key to DIRTY_QUEUE via pipeline rpush on reconnect', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const redis = makeRedis(false);
    let reconnectCb!: ReconnectCb;
    (redis.onReconnect as jest.Mock).mockImplementation((cb: ReconnectCb) => {
      reconnectCb = cb;
      return () => {};
    });
    const { svc } = makeService({ redis, l3: makeL3(new Map([['key:1', makeEntry()]])) });

    await svc.onModuleInit();
    await reconnectCb();

    const pipe = redis._client.created[0];
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'key:1');
  });

  // T7 — Jitter: pipeline NOT called before timer fires
  it('applies jitter — pipeline is not called synchronously before the timer fires', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(1);
    const redis = makeRedis(false);
    let reconnectCb!: ReconnectCb;
    (redis.onReconnect as jest.Mock).mockImplementation((cb: ReconnectCb) => {
      reconnectCb = cb;
      return () => {};
    });
    const { svc } = makeService({ redis, l3: makeL3(new Map([['key:1', makeEntry()]])) });

    await svc.onModuleInit();
    const cbPromise = reconnectCb();

    await Promise.resolve(); // flush initial microtasks — pipeline still blocked by timer
    expect(redis._client.pipeline).not.toHaveBeenCalled();

    jest.runAllTimers(); // resolve the jitter setTimeout
    await cbPromise;

    expect(redis._client.pipeline).toHaveBeenCalled();
  });

  // T8 — Chunked: 501 entries → 2 pipeline executions
  it(`creates a new pipeline for every ${PIPELINE_CHUNK_SIZE} entries (chunked batching)`, async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const entries = new Map<string, CacheEntry<unknown>>();
    for (let i = 0; i < PIPELINE_CHUNK_SIZE + 1; i++) entries.set(`key:${i}`, makeEntry());
    const redis = makeRedis(false);
    let reconnectCb!: ReconnectCb;
    (redis.onReconnect as jest.Mock).mockImplementation((cb: ReconnectCb) => {
      reconnectCb = cb;
      return () => {};
    });
    const { svc } = makeService({ redis, l3: makeL3(entries) });

    await svc.onModuleInit();
    await reconnectCb();

    expect(redis._client.pipeline).toHaveBeenCalledTimes(2);
  });

  // T9 — Client unavailable in reconnect callback: no throw
  it('handles a missing Redis client in the reconnect callback without throwing', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const redis = makeRedis(false);
    (redis.getClient as jest.Mock).mockResolvedValue(null);
    let reconnectCb!: ReconnectCb;
    (redis.onReconnect as jest.Mock).mockImplementation((cb: ReconnectCb) => {
      reconnectCb = cb;
      return () => {};
    });
    const { svc } = makeService({ redis, l3: makeL3(new Map([['key:1', makeEntry()]])) });

    await svc.onModuleInit();

    await expect(reconnectCb()).resolves.not.toThrow();
  });
});

describe('CatastrophicRecoveryService — Supabase comparison (#58)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function captureReconnect(redis: any): { getReconnectCb: () => ReconnectCb } {
    let cb!: ReconnectCb;
    (redis.onReconnect as jest.Mock).mockImplementation((fn: ReconnectCb) => { cb = fn; return () => {}; });
    return { getReconnectCb: () => cb };
  }

  // S1 — Tracer bullet: Supabase queried for L3 keys
  it('queries Supabase for L3 keys during onModuleInit', async () => {
    const supabase = makeSupabase();
    const { svc } = makeService({
      redis: makeRedis(false),
      l3: makeL3(new Map([['key:1', makeEntry()]])),
      supabase,
    });

    await svc.onModuleInit();

    expect((supabase as any)._in).toHaveBeenCalledWith('key', ['key:1']);
  });

  // S2 — Supabase newer: Supabase data pushed to L2
  it('pushes Supabase data to L2 when Supabase row has a newer updatedAt than L3', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const l3Entry = makeEntry({ updatedAt: '2026-01-01T00:00:00Z', data: { source: 'l3' }, ttlMs: 60_000 });
    const supabaseRow: SupabaseRow = {
      key: 'key:1',
      data: { source: 'supabase' },
      updated_at: '2026-06-01T00:00:00Z',
      ttl_ms: 60_000,
    };
    const redis = makeRedis(false);
    const { getReconnectCb } = captureReconnect(redis);
    const { svc } = makeService({
      redis,
      l3: makeL3(new Map([['key:1', l3Entry]])),
      supabase: makeSupabase({ data: [supabaseRow], error: null }),
    });

    await svc.onModuleInit();
    await getReconnectCb()();

    const setArgs = redis._client.created[0].set.mock.calls[0];
    const pushedEntry = JSON.parse(setArgs[1] as string);
    expect(pushedEntry.data).toEqual({ source: 'supabase' });
  });

  // S3 — L3 newer: L3 data pushed to L2
  it('pushes L3 data to L2 when L3 entry has a newer updatedAt than Supabase', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const l3Entry = makeEntry({ updatedAt: '2026-06-01T00:00:00Z', data: { source: 'l3' }, ttlMs: 60_000 });
    const supabaseRow: SupabaseRow = {
      key: 'key:1',
      data: { source: 'supabase' },
      updated_at: '2026-01-01T00:00:00Z',
      ttl_ms: 60_000,
    };
    const redis = makeRedis(false);
    const { getReconnectCb } = captureReconnect(redis);
    const { svc } = makeService({
      redis,
      l3: makeL3(new Map([['key:1', l3Entry]])),
      supabase: makeSupabase({ data: [supabaseRow], error: null }),
    });

    await svc.onModuleInit();
    await getReconnectCb()();

    const setArgs = redis._client.created[0].set.mock.calls[0];
    const pushedEntry = JSON.parse(setArgs[1] as string);
    expect(pushedEntry.data).toEqual({ source: 'l3' });
  });

  // S4 — Supabase unreachable: warns and falls back to L3
  it('falls back to L3-only buffer and logs a warning when Supabase query fails', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const l3Entry = makeEntry({ data: { source: 'l3' } });
    const redis = makeRedis(false);
    const { getReconnectCb } = captureReconnect(redis);
    const supabase = makeSupabase({ data: [], error: new Error('connection refused') });
    const { svc } = makeService({
      redis,
      l3: makeL3(new Map([['key:1', l3Entry]])),
      supabase,
    });
    const warnSpy = jest.spyOn((svc as any).logger, 'warn');

    await svc.onModuleInit();
    await getReconnectCb()();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Supabase'));
    const setArgs = redis._client.created[0].set.mock.calls[0];
    const pushedEntry = JSON.parse(setArgs[1] as string);
    expect(pushedEntry.data).toEqual({ source: 'l3' });
  });

  // S5 — 101 keys: 2 Supabase batch queries
  it(`batches Supabase queries at ${SUPABASE_BATCH_SIZE} keys — 101 L3 keys → 2 queries`, async () => {
    const entries = new Map<string, CacheEntry<unknown>>();
    for (let i = 0; i < SUPABASE_BATCH_SIZE + 1; i++) entries.set(`key:${i}`, makeEntry());
    const supabase = makeSupabase([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const { svc } = makeService({
      redis: makeRedis(false),
      l3: makeL3(entries),
      supabase,
    });

    await svc.onModuleInit();

    expect((supabase as any)._in).toHaveBeenCalledTimes(2);
  });
});

describe('CatastrophicRecoveryService — smart dirty queuing (#62)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function captureReconnect(redis: any): { getReconnectCb: () => ReconnectCb } {
    let cb!: ReconnectCb;
    (redis.onReconnect as jest.Mock).mockImplementation((fn: ReconnectCb) => { cb = fn; return () => {}; });
    return { getReconnectCb: () => cb };
  }

  // D1 — Tracer bullet: Supabase winner → NO rpush to DIRTY_QUEUE
  it('does NOT enqueue key to DIRTY_QUEUE when Supabase data wins — it is already in the DB', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const l3Entry = makeEntry({ updatedAt: '2026-01-01T00:00:00Z' });
    const supabaseRow: SupabaseRow = {
      key: 'key:1', data: {}, updated_at: '2026-06-01T00:00:00Z', ttl_ms: 60_000,
    };
    const redis = makeRedis(false);
    const { getReconnectCb } = captureReconnect(redis);
    const { svc } = makeService({
      redis,
      l3: makeL3(new Map([['key:1', l3Entry]])),
      supabase: makeSupabase({ data: [supabaseRow], error: null }),
    });

    await svc.onModuleInit();
    await getReconnectCb()();

    const pipe = redis._client.created[0];
    expect(pipe.rpush).not.toHaveBeenCalledWith(DIRTY_QUEUE, 'key:1');
  });

  // D2 — L3 winner → rpush to DIRTY_QUEUE (needs re-sync to Supabase)
  it('enqueues key to DIRTY_QUEUE when L3 data wins — it must be synced to Supabase', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const l3Entry = makeEntry({ updatedAt: '2026-06-01T00:00:00Z' });
    const supabaseRow: SupabaseRow = {
      key: 'key:1', data: {}, updated_at: '2026-01-01T00:00:00Z', ttl_ms: 60_000,
    };
    const redis = makeRedis(false);
    const { getReconnectCb } = captureReconnect(redis);
    const { svc } = makeService({
      redis,
      l3: makeL3(new Map([['key:1', l3Entry]])),
      supabase: makeSupabase({ data: [supabaseRow], error: null }),
    });

    await svc.onModuleInit();
    await getReconnectCb()();

    const pipe = redis._client.created[0];
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'key:1');
  });

  // D3 — No Supabase match → L3 wins by default → rpush to DIRTY_QUEUE
  it('enqueues key to DIRTY_QUEUE when no Supabase row exists for the key (L3 wins by default)', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const redis = makeRedis(false);
    const { getReconnectCb } = captureReconnect(redis);
    const { svc } = makeService({
      redis,
      l3: makeL3(new Map([['key:1', makeEntry()]])),
      supabase: makeSupabase({ data: [], error: null }),
    });

    await svc.onModuleInit();
    await getReconnectCb()();

    const pipe = redis._client.created[0];
    expect(pipe.rpush).toHaveBeenCalledWith(DIRTY_QUEUE, 'key:1');
  });
});
