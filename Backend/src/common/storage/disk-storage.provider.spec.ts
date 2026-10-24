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
    await provider.put(
      key,
      Readable.from([Buffer.from('a'), Buffer.from('b')]),
    );

    expect((await provider.get(key)).toString()).toBe('ab');
  });

  it('put rejects when the source stream errors', async () => {
    const bad = new Readable({
      read() {
        this.destroy(new Error('boom'));
      },
    });
    await expect(provider.put(abs('partial.bin'), bad)).rejects.toThrow('boom');
  });

  it('get rejects when the file is absent', async () => {
    await expect(provider.get(abs('nope.bin'))).rejects.toThrow();
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
    // no-op (no throw) on a path that never existed
    await expect(
      provider.deleteDir(abs('never-existed')),
    ).resolves.toBeUndefined();
  });

  it('ensureDir creates a directory', async () => {
    const dir = abs('made', 'here');
    await provider.ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });

  // #1007: a relative key must stay inside the provider's root. The root is a temp dir (process.cwd is mocked), with
  // a sentinel file in it and beside it, so even a build without the guard can only touch the temp tree.
  describe('relative keys are contained in the root (#1007)', () => {
    let root: string;
    let contained: DiskStorageProvider;
    let cwdSpy: jest.SpyInstance;

    beforeEach(() => {
      root = path.join(tmp, 'root');
      fs.mkdirSync(path.join(root, 'uploads'), { recursive: true });
      fs.writeFileSync(path.join(root, 'sentinel.txt'), 'root');
      fs.writeFileSync(path.join(tmp, 'outside.txt'), 'outside');
      cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(root);
      contained = new DiskStorageProvider();
    });

    afterEach(() => cwdSpy.mockRestore());

    it.each([
      ['delete', () => contained.delete('../outside.txt')],
      ['deleteDir', () => contained.deleteDir('../')],
      ['deleteDir of the root itself', () => contained.deleteDir('uploads/..')],
      ['exists', () => contained.exists('../outside.txt')],
      ['get', () => contained.get('../outside.txt')],
      ['put', () => contained.put('../outside.txt', Buffer.from('x'))],
      [
        'a nested climb',
        () => contained.delete('uploads/avatars/u1_/../../../../outside.txt'),
      ],
    ])('%s refuses a key outside the root', async (_m, call) => {
      await expect(call()).rejects.toThrow(/outside the storage root/);
      expect(fs.readFileSync(path.join(tmp, 'outside.txt'), 'utf8')).toBe(
        'outside',
      );
      expect(fs.existsSync(path.join(root, 'sentinel.txt'))).toBe(true);
    });

    it('a name that merely starts with two dots is not a climb', async () => {
      await contained.put('..cache.bin', Buffer.from('x'));
      await expect(contained.exists('..cache.bin')).resolves.toBe(true);
    });

    it('a relative key inside the root still works', async () => {
      await contained.put('uploads/a.bin', Buffer.from('x'));
      await expect(contained.get('uploads/a.bin')).resolves.toEqual(
        Buffer.from('x'),
      );
    });

    it('absolute keys keep their behaviour', async () => {
      const key = abs('a.txt');
      await contained.put(key, Buffer.from('ok'));
      await expect(contained.exists(key)).resolves.toBe(true);
    });
  });
});
