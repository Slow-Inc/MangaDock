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
  it('write() then readAll() round-trips the entry with the original key', async () => {
    const entry = makeEntry({ hello: 'world' }, 'manga:123');
    await service.write('manga:123', entry);

    const result = service.readAll();
    expect(result.size).toBe(1);
    expect(result.get('manga:123')?.data).toEqual({ hello: 'world' });
  });

  // Cycle 3 — Key sanitization
  it('write() sanitizes unsafe filename chars but readAll() restores the original key', async () => {
    await service.write('wallet:user:456', makeEntry('coins'));

    const files = fs.readdirSync(tmpDir);
    expect(files.every((f) => !f.includes(':'))).toBe(true);
    expect(service.readAll().get('wallet:user:456')?.data).toBe('coins');
  });

  // Cycle 7 (#147) — compact on-disk format; legacy pretty files still readable
  it('write() stores compact JSON (no pretty-print indentation)', async () => {
    await service.write('manga:9', makeEntry({ a: 1, b: [1, 2] }));

    const file = fs.readdirSync(tmpDir).find((f) => f.endsWith('.json'))!;
    const raw = fs.readFileSync(path.join(tmpDir, file), 'utf-8');
    expect(raw).not.toContain('\n'); // single-line compact output
    expect(JSON.parse(raw).data).toEqual({ a: 1, b: [1, 2] });
  });

  it('readAll() still parses legacy pretty-printed files', () => {
    const legacy = { ...makeEntry('old-style'), key: 'manga:legacy' };
    fs.writeFileSync(
      path.join(tmpDir, 'manga_legacy.json'),
      JSON.stringify(legacy, null, 2),
      'utf-8',
    );

    expect(service.readAll().get('manga:legacy')?.data).toBe('old-style');
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
  it('write() swallows disk errors without throwing', async () => {
    // Use a plain file as the cache dir — any write inside it will fail (ENOTDIR)
    const fakeDir = path.join(tmpDir, 'impostor.json');
    fs.writeFileSync(fakeDir, '{}', 'utf-8');
    const svc = new L3DiskService(fakeDir);
    await expect(svc.write('key', makeEntry('x'))).resolves.toBeUndefined();
  });

  // FR-31 (#401) — filename collision: hash/encode so distinct keys never collide.
  // Under the old naive sanitizer, ':' and '/' both mapped to '_', so 'a:b' and
  // 'a/b' collided on one file and silently overwrote each other.
  it('write() gives keys that collide under naive sanitization distinct files (FR-31)', async () => {
    await service.write('a:b', makeEntry('first'));
    await service.write('a/b', makeEntry('second'));

    const jsonFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.json'));
    expect(jsonFiles.length).toBe(2); // two distinct files, no collision

    const all = service.readAll();
    expect(all.get('a:b')?.data).toBe('first');
    expect(all.get('a/b')?.data).toBe('second');
  });

  // FR-31 (#401) — atomic write: write to *.tmp then rename. A failure at the
  // rename step must never expose a partial/corrupt file at the final path,
  // and must not leave an orphaned .tmp behind.
  it('write() never leaves a partial file at the final path when the rename fails midway (FR-31)', async () => {
    await service.write('atomic:key', makeEntry('good-old-value'));
    const finalName = fs.readdirSync(tmpDir).find((f) => f.endsWith('.json'))!;
    const finalPath = path.join(tmpDir, finalName);
    const oldContent = fs.readFileSync(finalPath, 'utf-8');

    const renameSpy = jest
      .spyOn(service as any, 'renameFile')
      .mockRejectedValue(new Error('simulated crash during rename'));
    await service.write(
      'atomic:key',
      makeEntry('new-value-that-must-not-corrupt'),
    );
    renameSpy.mockRestore();

    // Final path still holds the complete old content — never a partial write.
    expect(fs.readFileSync(finalPath, 'utf-8')).toBe(oldContent);
    // No orphaned .tmp file left behind.
    expect(fs.readdirSync(tmpDir).some((f) => f.endsWith('.tmp'))).toBe(false);
  });
});

describe('L3DiskService — dirty fallback (#48 / #52)', () => {
  let tmpDir: string;
  let svc: L3DiskService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'l3-fallback-'));
    svc = new L3DiskService(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Cycle F1 — appendDirtyFallback persists a key (verifiable via drain)
  it('appendDirtyFallback() persists a key — drainDirtyFallback() returns it', () => {
    svc.appendDirtyFallback('manga:1');

    expect(svc.drainDirtyFallback()).toContain('manga:1');
  });

  // Cycle F2 — multiple appends accumulate without overwriting
  it('appendDirtyFallback() accumulates multiple keys without overwriting', () => {
    svc.appendDirtyFallback('key-1');
    svc.appendDirtyFallback('key-2');
    svc.appendDirtyFallback('key-3');

    expect(svc.drainDirtyFallback()).toEqual(['key-1', 'key-2', 'key-3']);
  });

  // Cycle F6 — file uses newline-delimited format (#52 crash-safety)
  it('appendDirtyFallback() uses newline-delimited plain text format (not JSON array)', () => {
    svc.appendDirtyFallback('key-a');
    svc.appendDirtyFallback('key-b');

    const fallbackPath = path.join(tmpDir, 'dirty_fallback.txt');
    const raw = fs.readFileSync(fallbackPath, 'utf-8');
    expect(raw).toBe('key-a\nkey-b\n');
  });

  // Cycle F3 — drainDirtyFallback returns all keys and deletes the file
  it('drainDirtyFallback() returns all queued keys and removes the fallback file', () => {
    svc.appendDirtyFallback('key-a');
    svc.appendDirtyFallback('key-b');

    const keys = svc.drainDirtyFallback();

    expect(keys).toEqual(['key-a', 'key-b']);
    expect(fs.existsSync(path.join(tmpDir, 'dirty_fallback.txt'))).toBe(false);
  });

  // Cycle F4 — drainDirtyFallback is idempotent when file does not exist
  it('drainDirtyFallback() returns empty array when no fallback file exists', () => {
    expect(svc.drainDirtyFallback()).toEqual([]);
  });

  // Cycle F5 — second drain returns empty (file was deleted)
  it('drainDirtyFallback() returns empty array on subsequent call after drain', () => {
    svc.appendDirtyFallback('key-1');
    svc.drainDirtyFallback();

    expect(svc.drainDirtyFallback()).toEqual([]);
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
  it('write() resets consecutive failure counter on success — no CRITICAL after reset', async () => {
    const errorSpy = jest
      .spyOn((svc as any).logger, 'error')
      .mockImplementation(() => {});
    let shouldFail = false;
    jest.spyOn(svc as any, 'writeFile').mockImplementation(async () => {
      if (shouldFail) throw new Error('disk full');
    });

    // Two failures
    shouldFail = true;
    await svc.write('key-1', makeEntry(1));
    await svc.write('key-2', makeEntry(2));

    // Success resets counter
    shouldFail = false;
    await svc.write('key-ok', makeEntry('ok'));

    // One more failure — should NOT trigger CRITICAL (counter was reset, only 1 failure)
    shouldFail = true;
    await svc.write('key-3', makeEntry(3));

    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Cycle W2 — CRITICAL log emitted when threshold reached
  it('write() emits a CRITICAL-level log when consecutive failures reach the threshold', async () => {
    const errorSpy = jest
      .spyOn((svc as any).logger, 'error')
      .mockImplementation(() => {});
    jest.spyOn(svc as any, 'writeFile').mockRejectedValue(new Error('ENOSPC'));

    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD; i++) {
      await svc.write(`key-${i}`, makeEntry(i));
    }

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CRITICAL'));
  });

  // Cycle W3 — CRITICAL log fires exactly once even with many extra failures
  it('write() emits the CRITICAL log exactly once per failure run, not on every failure after threshold', async () => {
    const errorSpy = jest
      .spyOn((svc as any).logger, 'error')
      .mockImplementation(() => {});
    jest.spyOn(svc as any, 'writeFile').mockRejectedValue(new Error('ENOSPC'));

    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD + 5; i++) {
      await svc.write(`key-${i}`, makeEntry(i));
    }

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  // Cycle W4 — CRITICAL can fire again after successful reset
  it('write() emits CRITICAL again after a successful write resets the consecutive counter', async () => {
    const errorSpy = jest
      .spyOn((svc as any).logger, 'error')
      .mockImplementation(() => {});
    let shouldFail = true;
    jest.spyOn(svc as any, 'writeFile').mockImplementation(async () => {
      if (shouldFail) throw new Error('ENOSPC');
    });

    // First failure run — triggers CRITICAL
    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD; i++) {
      await svc.write(`key-fail-${i}`, makeEntry(i));
    }
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // Success resets counter
    shouldFail = false;
    await svc.write('key-ok', makeEntry('ok'));

    // Second failure run — CRITICAL fires again
    shouldFail = true;
    for (let i = 0; i < CONSECUTIVE_FAIL_THRESHOLD; i++) {
      await svc.write(`key-fail2-${i}`, makeEntry(i));
    }
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});
