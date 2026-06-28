import { DiskStorageProvider } from './disk-storage.provider';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';

// Characterization tests for DiskStorageProvider. These lock the observable
// behavior of every method so the sync->async (fs/promises) refactor for FR-4
// can be verified non-destructive. All keys are absolute paths under a temp
// dir (getAbsPath uses the key directly when it is absolute).
describe('DiskStorageProvider', () => {
  let provider: DiskStorageProvider;
  let tmp: string;
  const abs = (...p: string[]) => path.join(tmp, ...p);

  beforeEach(() => {
    provider = new DiskStorageProvider();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'disk-storage-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('put then get round-trips a Buffer (creating parent dirs)', async () => {
    const key = abs('nested', 'deep', 'file.bin');
    await provider.put(key, Buffer.from('hello world'));

    const out = await provider.get(key);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString()).toBe('hello world');
  });

  it('put accepts a Readable stream', async () => {
    const key = abs('streamed.txt');
    await provider.put(key, Readable.from([Buffer.from('a'), Buffer.from('b')]));

    expect((await provider.get(key)).toString()).toBe('ab');
  });

  it('exists reflects whether the file is present', async () => {
    const key = abs('present.txt');
    expect(await provider.exists(key)).toBe(false);
    await provider.put(key, 'x');
    expect(await provider.exists(key)).toBe(true);
  });

  it('list returns the filenames in a directory', async () => {
    await provider.put(abs('dir', 'a.txt'), 'a');
    await provider.put(abs('dir', 'b.txt'), 'b');

    const names = await provider.list(abs('dir'));
    expect(names.sort()).toEqual(['a.txt', 'b.txt']);
  });

  it('list returns [] for a non-existent prefix', async () => {
    expect(await provider.list(abs('nope'))).toEqual([]);
  });

  it('delete removes a file and is a no-op when absent', async () => {
    const key = abs('gone.txt');
    await provider.put(key, 'x');
    await provider.delete(key);
    expect(await provider.exists(key)).toBe(false);
    await expect(provider.delete(key)).resolves.toBeUndefined(); // no throw when missing
  });

  it('deleteDir removes a directory recursively', async () => {
    await provider.put(abs('d', 'one.txt'), '1');
    await provider.put(abs('d', 'sub', 'two.txt'), '2');

    await provider.deleteDir(abs('d'));
    expect(await provider.exists(abs('d'))).toBe(false);
  });

  it('ensureDir creates a directory', async () => {
    const dir = abs('made', 'here');
    await provider.ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });
});
