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

  // Cycle 7 — syncEntry() is in-memory only
  it('syncEntry() updates memory without writing to L3 disk', () => {
    const entry = { data: 'hello', updatedAt: new Date().toISOString(), ttlMs: 60_000 };
    jc.syncEntry('synckey', entry);

    expect(jc.get('synckey')?.data).toBe('hello');
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });

  // Cycle 8 — onModuleInit() warms L1 from L3
  it('onModuleInit() loads entries written to L3 into L1 memory', () => {
    const entry = { key: 'disk:key', data: 'from disk', updatedAt: new Date().toISOString(), ttlMs: 60_000 };
    l3.write('disk:key', entry);

    const freshJc = new JsonCacheService(l3);
    freshJc.onModuleInit();

    expect(freshJc.get('disk:key')?.data).toBe('from disk');
  });
});
