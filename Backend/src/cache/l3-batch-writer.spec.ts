import { L3BatchWriter, FLUSH_CONFIG } from './l3-batch-writer';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { L3DiskService } from './l3-disk.service';

const drainMicrotasks = async (n = 20) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

function makeEntry<T>(data: T): CacheEntry<T> {
  return { data, updatedAt: new Date().toISOString(), ttlMs: 60_000 };
}

function makeRedis(store: Record<string, string> = {}) {
  return {
    available: true,
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ?? null)),
    // Mirrors RedisService.mget: one round-trip, null for missing keys
    mget: jest.fn().mockImplementation((keys: string[]) =>
      Promise.resolve(keys.map((k) => store[k] ?? null)),
    ),
  } as unknown as RedisService;
}

function makeJsonCache(keys: string[] = []) {
  const map = new Map(keys.map((k) => [k, makeEntry('data')]));
  return { getAll: jest.fn().mockReturnValue(map) } as unknown as JsonCacheService;
}

function makeL3() {
  return { write: jest.fn() } as unknown as L3DiskService;
}

function makeWriter(store: Record<string, string> = {}, l1Keys: string[] = []) {
  const redis = makeRedis(store);
  const jsonCache = makeJsonCache(l1Keys);
  const l3 = makeL3();
  return { writer: new L3BatchWriter(redis, jsonCache, l3), redis, jsonCache, l3 };
}

describe('L3BatchWriter', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Cycle 1 — Tracer Bullet: startup flush
  it('flushes all L1 keys to L3 immediately on onModuleInit before any interval fires', async () => {
    const entry = makeEntry('hello');
    const { writer, l3 } = makeWriter({ 'manga:1': JSON.stringify(entry) }, ['manga:1']);

    await writer.onModuleInit();
    writer.onModuleDestroy();

    expect(l3.write).toHaveBeenCalledWith('manga:1', expect.objectContaining({ data: 'hello' }));
  });

  // Cycle 2 — skip keys missing from L2
  it('does not call l3.write when key is missing from L2 (expired)', async () => {
    const { writer, l3 } = makeWriter({}, ['ghost:key']);

    await writer.onModuleInit();
    writer.onModuleDestroy();

    expect(l3.write).not.toHaveBeenCalled();
  });

  // Cycle 3 — wallet: keys flush at 2s interval (changed data; unchanged is skipped — Cycle 8)
  it('flushes wallet: keys at the 2s interval', async () => {
    jest.useFakeTimers();
    const store = { 'wallet:user:1': JSON.stringify(makeEntry(50)) };
    const { writer, l3 } = makeWriter(store, ['wallet:user:1']);

    await writer.onModuleInit();
    l3.write.mockClear();
    // a write-behind update lands between ticks
    store['wallet:user:1'] = JSON.stringify({ ...makeEntry(100), updatedAt: new Date(Date.now() + 500).toISOString() });

    jest.advanceTimersByTime(2_000);
    await drainMicrotasks();

    expect(l3.write).toHaveBeenCalledWith('wallet:user:1', expect.objectContaining({ data: 100 }));
    writer.onModuleDestroy();
  });

  // Cycle 4 — default keys do NOT flush at 2s, only at 60s
  it('does not flush manga: keys at 2s but does flush them at 60s', async () => {
    jest.useFakeTimers();
    const store = { 'manga:1': JSON.stringify(makeEntry('old')) };
    const { writer, l3 } = makeWriter(store, ['manga:1']);

    await writer.onModuleInit();
    l3.write.mockClear();
    store['manga:1'] = JSON.stringify({ ...makeEntry('chapter'), updatedAt: new Date(Date.now() + 500).toISOString() });

    jest.advanceTimersByTime(2_000); // wallet interval — should NOT write manga:
    await drainMicrotasks();
    expect(l3.write).not.toHaveBeenCalledWith('manga:1', expect.anything());

    jest.advanceTimersByTime(58_000); // total 60s — default interval fires
    await drainMicrotasks();
    expect(l3.write).toHaveBeenCalledWith('manga:1', expect.objectContaining({ data: 'chapter' }));

    writer.onModuleDestroy();
  });

  // Cycle 5 — onModuleDestroy flushes then stops all intervals
  it('flushes L3 during onModuleDestroy — persists L2 data before timers clear', async () => {
    const store = { 'manga:1': JSON.stringify(makeEntry('boot-data')) };
    const { writer, l3 } = makeWriter(store, ['manga:1']);

    await writer.onModuleInit();
    l3.write.mockClear(); // clear startup flush
    // an update lands after the last periodic flush — shutdown must persist it
    store['manga:1'] = JSON.stringify({ ...makeEntry('shutdown-data'), updatedAt: new Date(Date.now() + 500).toISOString() });

    await writer.onModuleDestroy();

    expect(l3.write).toHaveBeenCalledWith('manga:1', expect.objectContaining({ data: 'shutdown-data' }));
  });

  it('onModuleDestroy clears all intervals — no periodic flushes fire after destroy', async () => {
    jest.useFakeTimers();
    const entry = makeEntry(1);
    const { writer, l3 } = makeWriter({ 'wallet:x': JSON.stringify(entry) }, ['wallet:x']);

    await writer.onModuleInit();
    await writer.onModuleDestroy(); // await so the final flush completes first
    l3.write.mockClear();           // clear AFTER destroy — now check no more fire

    jest.advanceTimersByTime(60_000);
    await drainMicrotasks();

    expect(l3.write).not.toHaveBeenCalled();
  });

  // Cycle 6 — Redis unavailable: L1→L3 direct fallback
  it('writes L1 entries directly to L3 when Redis is unavailable — order-independent shutdown flush', async () => {
    const redis = { available: false, get: jest.fn() } as unknown as RedisService;
    const entry = makeEntry('important');
    const map = new Map([['manga:1', entry]]);
    const jsonCache = { getAll: jest.fn().mockReturnValue(map) } as unknown as JsonCacheService;
    const l3 = makeL3();
    const writer = new L3BatchWriter(redis, jsonCache, l3);

    await writer.flush();

    expect(redis.get).not.toHaveBeenCalled(); // L2 bypassed
    expect(l3.write).toHaveBeenCalledWith('manga:1', entry);
  });

  // Cycle 7 (#147) — one MGET round-trip per flush, not one GET per key
  it('fetches all matching keys in a single mget round-trip', async () => {
    const e = () => JSON.stringify(makeEntry('x'));
    const { writer, redis } = makeWriter(
      { 'wallet:1': e(), 'wallet:2': e(), 'wallet:3': e() },
      ['wallet:1', 'wallet:2', 'wallet:3'],
    );

    await writer.flush('wallet:');

    expect(redis.mget).toHaveBeenCalledTimes(1);
    expect(redis.mget).toHaveBeenCalledWith(['wallet:1', 'wallet:2', 'wallet:3']);
    expect(redis.get).not.toHaveBeenCalled();
  });

  // Cycle 8 (#147) — unchanged entries are not rewritten to disk every cycle
  it('skips l3.write for entries unchanged since the last flush, rewrites when they change', async () => {
    const entryV1 = makeEntry('coins=10');
    const store = { 'wallet:1': JSON.stringify(entryV1) };
    const { writer, l3 } = makeWriter(store, ['wallet:1']);

    await writer.flush('wallet:');
    expect(l3.write).toHaveBeenCalledTimes(1);

    await writer.flush('wallet:'); // nothing changed — no disk write
    expect(l3.write).toHaveBeenCalledTimes(1);

    const entryV2 = { ...makeEntry('coins=20'), updatedAt: new Date(Date.now() + 1000).toISOString() };
    store['wallet:1'] = JSON.stringify(entryV2);
    await writer.flush('wallet:'); // changed — written again
    expect(l3.write).toHaveBeenCalledTimes(2);
    expect(l3.write).toHaveBeenLastCalledWith('wallet:1', expect.objectContaining({ data: 'coins=20' }));
  });

  // Cycle 9 (#147, self-review) — high-water marks must not outlive their keys
  it('prunes high-water marks for keys evicted from L1 — no unbounded growth', async () => {
    const entry = makeEntry('x');
    const store = { 'manga:1': JSON.stringify(entry) };
    const map = new Map([['manga:1', entry]]);
    const redis = {
      available: true,
      get: jest.fn(),
      mget: jest.fn().mockImplementation((keys: string[]) => Promise.resolve(keys.map((k) => store[k as keyof typeof store] ?? null))),
    } as unknown as RedisService;
    const jsonCache = { getAll: jest.fn().mockReturnValue(map) } as unknown as JsonCacheService;
    const writer = new L3BatchWriter(redis, jsonCache, makeL3());

    await writer.flush();
    expect((writer as any).lastWritten.size).toBe(1);

    map.clear(); // key evicted from L1
    await writer.flush();
    expect((writer as any).lastWritten.size).toBe(0);
  });

  it('L1→L3 fallback respects prefix filter when Redis is unavailable', async () => {
    const redis = { available: false, get: jest.fn() } as unknown as RedisService;
    const walletEntry = makeEntry('coins');
    const mangaEntry = makeEntry('pages');
    const map = new Map([['wallet:user:1', walletEntry], ['manga:1', mangaEntry]]);
    const jsonCache = { getAll: jest.fn().mockReturnValue(map) } as unknown as JsonCacheService;
    const l3 = makeL3();
    const writer = new L3BatchWriter(redis, jsonCache, l3);

    await writer.flush('wallet:');

    expect(l3.write).toHaveBeenCalledWith('wallet:user:1', walletEntry);
    expect(l3.write).not.toHaveBeenCalledWith('manga:1', expect.anything());
  });
});
