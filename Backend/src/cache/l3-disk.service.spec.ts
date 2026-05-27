import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { L3DiskService } from './l3-disk.service';
import type { CacheEntry } from './json-cache.service';

function makeEntry<T>(data: T, key?: string): CacheEntry<T> {
  return { key, data, updatedAt: new Date().toISOString(), ttlMs: 60_000 };
}

describe('L3DiskService', () => {
  let service: L3DiskService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'l3-test-'));
    service = new L3DiskService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Cycle 1 — Tracer Bullet
  it('readAll() returns empty map when directory has no JSON files', () => {
    expect(service.readAll().size).toBe(0);
  });

  // Cycle 2 — Round-trip
  it('write() then readAll() round-trips the entry with the original key', () => {
    const entry = makeEntry({ hello: 'world' }, 'manga:123');
    service.write('manga:123', entry);

    const result = service.readAll();
    expect(result.size).toBe(1);
    expect(result.get('manga:123')?.data).toEqual({ hello: 'world' });
  });

  // Cycle 3 — Key sanitization
  it('write() sanitizes unsafe filename chars but readAll() restores the original key', () => {
    service.write('wallet:user:456', makeEntry('coins'));

    const files = fs.readdirSync(tmpDir);
    expect(files.every((f) => !f.includes(':'))).toBe(true);
    expect(service.readAll().get('wallet:user:456')?.data).toBe('coins');
  });

  // Cycle 4 — Corrupt JSON resilience
  it('readAll() skips corrupt JSON files without throwing', () => {
    fs.writeFileSync(path.join(tmpDir, 'bad.json'), 'not-json{{{', 'utf-8');
    expect(() => service.readAll()).not.toThrow();
    expect(service.readAll().size).toBe(0);
  });

  // Cycle 5 — Disk write error resilience
  it('write() swallows disk errors without throwing', () => {
    // Use a plain file as the cache dir — any write inside it will fail (ENOTDIR)
    const fakeDir = path.join(tmpDir, 'impostor.json');
    fs.writeFileSync(fakeDir, '{}', 'utf-8');
    const svc = new L3DiskService(fakeDir);
    expect(() => svc.write('key', makeEntry('x'))).not.toThrow();
  });
});
