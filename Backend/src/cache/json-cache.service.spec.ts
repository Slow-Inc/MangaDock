import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { L3DiskService } from './l3-disk.service';
import { JsonCacheService } from './json-cache.service';

describe('JsonCacheService — L1 in-memory only', () => {
  let l3: L3DiskService;
  let jc: JsonCacheService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-'));
    l3 = new L3DiskService(tmpDir);
    jc = new JsonCacheService(l3);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Cycle 6 — set() is in-memory only
  it('set() updates memory without writing to L3 disk', () => {
    jc.set('mykey', { value: 42 }, 60_000);

    expect(jc.get('mykey')?.data).toEqual({ value: 42 });
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });

  // Cycle 8 — onModuleInit() warms L1 from L3
  it('onModuleInit() loads entries written to L3 into L1 memory', async () => {
    const entry = { key: 'disk:key', data: 'from disk', updatedAt: new Date().toISOString(), ttlMs: 60_000 };
    await l3.write('disk:key', entry);

    const freshJc = new JsonCacheService(l3);
    freshJc.onModuleInit();

    expect(freshJc.get('disk:key')?.data).toBe('from disk');
  });
});

describe('JsonCacheService — byte-size LRU eviction (#53)', () => {
  let l3: L3DiskService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-size-'));
    l3 = new L3DiskService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Cycle S1 — large entry is evicted when maxSize is exceeded
  it('evicts an older large entry when total byte size exceeds maxSize', () => {
    const jc = new JsonCacheService(l3);
    // Fill with one large entry (~30MB) then add another to push over the 50MB limit
    const big1 = 'x'.repeat(30 * 1024 * 1024); // ~30MB string
    const big2 = 'y'.repeat(25 * 1024 * 1024); // ~25MB string
    jc.set('large-1', big1, 60_000);
    jc.set('large-2', big2, 60_000);

    // large-1 should have been evicted (total would be ~55MB > 50MB)
    expect(jc.get('large-1')).toBeNull();
    expect(jc.get('large-2')).not.toBeNull();
  });

  // Cycle S2 — small entries are not evicted below maxSize
  it('does not evict small entries when total size is well below maxSize', () => {
    const jc = new JsonCacheService(l3);
    jc.set('small-1', { v: 1 }, 60_000);
    jc.set('small-2', { v: 2 }, 60_000);

    expect(jc.get('small-1')).not.toBeNull();
    expect(jc.get('small-2')).not.toBeNull();
  });
});

describe('JsonCacheService — live iteration API (FR-5, no full-map clone)', () => {
  let l3: L3DiskService;
  let jc: JsonCacheService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-iter-'));
    l3 = new L3DiskService(tmpDir);
    jc = new JsonCacheService(l3);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('entries() yields the current [key, entry] pairs from the live store', () => {
    jc.set('a', 1, 60_000);
    jc.set('b', 2, 60_000);

    const pairs = [...jc.entries()];
    expect(pairs.map(([k]) => k).sort()).toEqual(['a', 'b']);
    expect(pairs.find(([k]) => k === 'a')?.[1].data).toBe(1);
  });

  it('keys() yields the current keys', () => {
    jc.set('a', 1, 60_000);
    jc.set('b', 2, 60_000);

    expect([...jc.keys()].sort()).toEqual(['a', 'b']);
  });

  it('has() reflects whether a key is present', () => {
    jc.set('a', 1, 60_000);

    expect(jc.has('a')).toBe(true);
    expect(jc.has('missing')).toBe(false);
  });

  it('peek() returns the entry (or null) without rebuilding the map', () => {
    jc.set('a', { v: 1 }, 60_000);

    expect(jc.peek('a')?.data).toEqual({ v: 1 });
    expect(jc.peek('missing')).toBeNull();
  });
});
