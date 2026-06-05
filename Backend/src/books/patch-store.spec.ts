import { PatchStore } from './patch-store';
import type { StorageProvider } from '../common/storage/storage-provider.interface';

/**
 * PatchStore (#137): the single owner of Patch Set files on storage.
 *
 * Before it existed, three call sites composed `uploads/patches/...` paths with
 * three different formulas — the webhook one random-suffixed, so every
 * re-translate orphaned the previous files forever. PatchStore names files
 * deterministically (re-translate overwrites), removes stale region files when
 * a page shrinks, and sweeps the legacy random-named backlog.
 */
function fakeStorage(): StorageProvider & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    async put(key, data) {
      files.set(key, Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
    },
    async get(key) {
      const f = files.get(key);
      if (!f) throw new Error('not found');
      return f;
    },
    async delete(key) {
      files.delete(key);
    },
    async deleteDir(prefix) {
      for (const k of [...files.keys()]) if (k.startsWith(prefix)) files.delete(k);
    },
    async exists(key) {
      return files.has(key);
    },
    // Mirrors DiskStorageProvider.list = readdir(dir): ONE directory level,
    // basenames only (a prefix-style fake hid a real-adapter mismatch once).
    async list(dir) {
      const base = dir.endsWith('/') ? dir : `${dir}/`;
      const names = new Set<string>();
      for (const k of files.keys()) {
        if (!k.startsWith(base)) continue;
        names.add(k.slice(base.length).split('/')[0]);
      }
      return [...names];
    },
  };
}

const loc = { chapterId: 'ch1', pageIndex: 3, srcMIT: 'ANY', tgtMIT: 'THA', model: 'default' };
const png = (s: string) => Buffer.from(s);

function makeStore() {
  const storage = fakeStorage();
  const store = new PatchStore(storage, () => 'https://api.example');
  return { storage, store };
}

describe('PatchStore', () => {
  it('writes deterministic keys and returns origin-prefixed urls', async () => {
    const { storage, store } = makeStore();

    const urls = await store.put(loc, [png('a'), png('b')]);

    expect(urls).toEqual([
      'https://api.example/uploads/patches/ch1/ANY__THA__default__p3__r0.png',
      'https://api.example/uploads/patches/ch1/ANY__THA__default__p3__r1.png',
    ]);
    expect(storage.files.size).toBe(2);
  });

  it('re-translating overwrites in place — no new files appear', async () => {
    const { storage, store } = makeStore();

    await store.put(loc, [png('a'), png('b')]);
    await store.put(loc, [png('c'), png('d')]);

    expect(storage.files.size).toBe(2);
    expect(storage.files.get('uploads/patches/ch1/ANY__THA__default__p3__r0.png')!.toString()).toBe('c');
  });

  it('removes stale region files when the page shrinks', async () => {
    const { storage, store } = makeStore();

    await store.put(loc, [png('a'), png('b'), png('x')]);
    await store.put(loc, [png('c')]);

    expect([...storage.files.keys()]).toEqual([
      'uploads/patches/ch1/ANY__THA__default__p3__r0.png',
    ]);
  });

  it('different models never share files', async () => {
    const { storage, store } = makeStore();

    await store.put(loc, [png('a')]);
    await store.put({ ...loc, model: 'gemini-2.5-pro' }, [png('b')]);

    expect(storage.files.size).toBe(2);
  });

  it('a model id containing underscores survives sweepLegacy (Copilot: data-loss class)', async () => {
    const { storage, store } = makeStore();
    // imageModelKey allows \w, so '_' is a legal model character
    await store.put({ ...loc, model: 'my_custom_model' }, [png('a')]);

    const removed = await store.sweepLegacy();

    expect(removed).toBe(0);
    expect(storage.files.size).toBe(1);
  });

  it('rejects path-traversal segments before touching storage', async () => {
    const { storage, store } = makeStore();

    await expect(store.put({ ...loc, chapterId: '../../etc' }, [png('a')])).rejects.toThrow();
    await expect(store.put({ ...loc, srcMIT: 'a/b' }, [png('a')])).rejects.toThrow();
    await expect(store.put({ ...loc, model: 'evil\\model' }, [png('a')])).rejects.toThrow();
    expect(storage.files.size).toBe(0);
  });

  it('normalizes a trailing-slash origin (no double slash in urls)', async () => {
    const storage = fakeStorage();
    const store = new PatchStore(storage, () => 'https://api.example/');

    const urls = await store.put(loc, [png('a')]);

    expect(urls[0]).toBe('https://api.example/uploads/patches/ch1/ANY__THA__default__p3__r0.png');
  });

  it('sweepLegacy keeps going when one delete fails (e.g. a stray directory)', async () => {
    const { storage, store } = makeStore();
    storage.files.set('uploads/patches/ch1/3_0_aaaa.png', png('legacy1'));
    storage.files.set('uploads/patches/ch1/stray-dir', png('pretend-directory'));
    storage.files.set('uploads/patches/ch1/3_1_bbbb.png', png('legacy2'));
    const realDelete = storage.delete.bind(storage);
    storage.delete = async (key: string) => {
      if (key.endsWith('stray-dir')) throw new Error('EISDIR');
      return realDelete(key);
    };

    const removed = await store.sweepLegacy();

    expect(removed).toBe(2); // both real legacy files gone despite the throw
    expect(storage.files.has('uploads/patches/ch1/3_0_aaaa.png')).toBe(false);
    expect(storage.files.has('uploads/patches/ch1/3_1_bbbb.png')).toBe(false);
  });

  it('sweepLegacy removes only legacy-format files, never PatchStore-named ones', async () => {
    const { storage, store } = makeStore();
    await store.put(loc, [png('a')]);
    // legacy formats from the three old call sites
    storage.files.set('uploads/patches/ch1/3_0_ab12cd34.png', png('old-webhook'));
    storage.files.set('uploads/patches/ch1/ch1-ANY-THA-p3-r0.png', png('old-single'));

    const removed = await store.sweepLegacy();

    expect(removed).toBe(2);
    expect([...storage.files.keys()]).toEqual([
      'uploads/patches/ch1/ANY__THA__default__p3__r0.png',
    ]);
  });
});
