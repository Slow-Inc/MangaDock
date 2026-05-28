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

  // Cycle 6 — Constructor ensures cacheDir
  it('constructor ensures cacheDir exists — directory is ready before any write is called', () => {
    const freshDir = path.join(tmpDir, 'auto-created');
    expect(fs.existsSync(freshDir)).toBe(false); // dir does not exist yet

    new L3DiskService(freshDir);

    expect(fs.existsSync(freshDir)).toBe(true); // dir created at construction
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

describe('L3DiskService — dirty fallback (#48)', () => {
  let tmpDir: string;
  let svc: L3DiskService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'l3-fallback-'));
    svc = new L3DiskService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Cycle F1 — appendDirtyFallback writes key to fallback file
  it('appendDirtyFallback() persists a key to the fallback file on disk', () => {
    svc.appendDirtyFallback('manga:1');

    const fallbackPath = path.join(tmpDir, 'dirty_fallback.json');
    const content = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8')) as string[];
    expect(content).toContain('manga:1');
  });

  // Cycle F2 — multiple appends accumulate in fallback file
  it('appendDirtyFallback() accumulates multiple keys without overwriting', () => {
    svc.appendDirtyFallback('key-1');
    svc.appendDirtyFallback('key-2');
    svc.appendDirtyFallback('key-3');

    const fallbackPath = path.join(tmpDir, 'dirty_fallback.json');
    const content = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8')) as string[];
    expect(content).toEqual(['key-1', 'key-2', 'key-3']);
  });

  // Cycle F3 — drainDirtyFallback returns all keys and deletes the file
  it('drainDirtyFallback() returns all queued keys and removes the fallback file', () => {
    svc.appendDirtyFallback('key-a');
    svc.appendDirtyFallback('key-b');

    const keys = svc.drainDirtyFallback();

    expect(keys).toEqual(['key-a', 'key-b']);
    expect(fs.existsSync(path.join(tmpDir, 'dirty_fallback.json'))).toBe(false);
  });

  // Cycle F4 — drainDirtyFallback is idempotent when file does not exist
  it('drainDirtyFallback() returns empty array when no fallback file exists', () => {
    const keys = svc.drainDirtyFallback();
    expect(keys).toEqual([]);
  });

  // Cycle F5 — second drain after drain returns empty (file was deleted)
  it('drainDirtyFallback() returns empty array on subsequent call after drain', () => {
    svc.appendDirtyFallback('key-1');
    svc.drainDirtyFallback();

    const keys = svc.drainDirtyFallback();
    expect(keys).toEqual([]);
  });
});

const CONSECUTIVE_FAIL_THRESHOLD = 3;

describe('L3DiskService — write watchdog (#45)', () => {
  let tmpDir: string;
  let svc: L3DiskService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'l3-watchdog-'));
    svc = new L3DiskService(tmpDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Cycle W1 — successful write resets the failure counter
  it('write() resets consecutive failure counter on success — no CRITICAL after reset', () => {
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    let shouldFail = false;
    jest.spyOn(svc as any, 'writeFile').mockImplementation(() => {
      if (shouldFail) throw new Error('disk full');
    });

    // Two failures
    shouldFail = true;
    svc.write('key-1', makeEntry(1));
    svc.write('key-2', makeEntry(2));

    // Success resets counter
    shouldFail = false;
    svc.write('key-ok', makeEntry('ok'));

    // One more failure — should NOT trigger CRITICAL (counter was reset, only 1 failure)
    shouldFail = true;
    svc.write('key-3', makeEntry(3));

    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Cycle W2 — CRITICAL log emitted when threshold reached
  it('write() emits a CRITICAL-level log when consecutive failures reach the threshold', () => {
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn(svc as any, 'writeFile').mockImplementation(() => { throw new Error('ENOSPC'); });

    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD; i++) {
      svc.write(`key-${i}`, makeEntry(i));
    }

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CRITICAL'));
  });

  // Cycle W3 — CRITICAL log fires exactly once even with many extra failures
  it('write() emits the CRITICAL log exactly once per failure run, not on every failure after threshold', () => {
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn(svc as any, 'writeFile').mockImplementation(() => { throw new Error('ENOSPC'); });

    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD + 5; i++) {
      svc.write(`key-${i}`, makeEntry(i));
    }

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  // Cycle W4 — CRITICAL can fire again after successful reset
  it('write() emits CRITICAL again after a successful write resets the consecutive counter', () => {
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    let shouldFail = true;
    jest.spyOn(svc as any, 'writeFile').mockImplementation(() => {
      if (shouldFail) throw new Error('ENOSPC');
    });

    // First failure run — triggers CRITICAL
    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD; i++) {
      svc.write(`key-fail-${i}`, makeEntry(i));
    }
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // Success resets counter
    shouldFail = false;
    svc.write('key-ok', makeEntry('ok'));

    // Second failure run — CRITICAL fires again
    shouldFail = true;
    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD; i++) {
      svc.write(`key-fail2-${i}`, makeEntry(i));
    }
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});
