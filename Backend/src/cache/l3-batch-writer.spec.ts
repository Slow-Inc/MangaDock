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

  // Cycle 3 — wallet: keys flush at 2s interval
  it('flushes wallet: keys at the 2s interval', async () => {
    jest.useFakeTimers();
    const entry = makeEntry(100);
    const { writer, l3 } = makeWriter(
      { 'wallet:user:1': JSON.stringify(entry) },
      ['wallet:user:1'],
    );

    await writer.onModuleInit();
    l3.write.mockClear();

    jest.advanceTimersByTime(2_000);
    await drainMicrotasks();

    expect(l3.write).toHaveBeenCalledWith('wallet:user:1', expect.objectContaining({ data: 100 }));
    writer.onModuleDestroy();
  });

  // Cycle 4 — default keys do NOT flush at 2s, only at 60s
  it('does not flush manga: keys at 2s but does flush them at 60s', async () => {
    jest.useFakeTimers();
    const entry = makeEntry('chapter');
    const { writer, l3 } = makeWriter({ 'manga:1': JSON.stringify(entry) }, ['manga:1']);

    await writer.onModuleInit();
    l3.write.mockClear();

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
    const entry = makeEntry('shutdown-data');
    const { writer, l3 } = makeWriter({ 'manga:1': JSON.stringify(entry) }, ['manga:1']);

    await writer.onModuleInit();
    l3.write.mockClear(); // clear startup flush

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

  // Cycle 6 — Redis unavailable: skip flush entirely
  it('skips flush entirely when Redis is unavailable', async () => {
    const redis = { available: false, get: jest.fn() } as unknown as RedisService;
    const jsonCache = makeJsonCache(['wallet:1']);
    const l3 = makeL3();
    const writer = new L3BatchWriter(redis, jsonCache, l3);

    await writer.onModuleInit();
    writer.onModuleDestroy();

    expect(redis.get).not.toHaveBeenCalled();
    expect(l3.write).not.toHaveBeenCalled();
  });
});
