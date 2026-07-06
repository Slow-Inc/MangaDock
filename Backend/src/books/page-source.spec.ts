/**
 * Tests for page byte loading (#156).
 *
 * The Reader sends translation sources that are either raw CDN URLs or
 * backend-local /img-cache paths (the exact derivative it displays). The
 * loader must read local paths from disk — never re-fetch a different encode —
 * and must not let a crafted path escape the cache root.
 */
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { loadPageBytes } from './page-source';
import type { StorageProvider } from '../common/storage/storage-provider.interface';

describe('loadPageBytes', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'imgcache-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reads an /img-cache path from the cache root on disk', async () => {
    const dir = path.join(root, '_chapters', 'chapters', 'ch1');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'p0.jpg'), Buffer.from('jpeg-bytes'));

    const buf = await loadPageBytes(
      '/img-cache/_chapters/chapters/ch1/p0.jpg',
      {
        imgCacheRoot: root,
      },
    );

    expect(buf.toString()).toBe('jpeg-bytes');
  });

  it('reads an /img-cache path via StorageProvider.get when storage is provided', async () => {
    const storage = {
      get: jest.fn().mockResolvedValue(Buffer.from('r2-bytes')),
    } as unknown as Pick<StorageProvider, 'get'>;

    const buf = await loadPageBytes('/img-cache/_chapters/chapters/ch1/p0.jpg', {
      imgCacheRoot: root,
      storage,
    });

    expect((storage as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
      'img-cache/_chapters/chapters/ch1/p0.jpg',
    );
    expect(buf.toString()).toBe('r2-bytes');
  });

  it.each([
    '/img-cache/../secrets.txt',
    '/img-cache/a/../../secrets.txt',
    '/img-cache/%2e%2e/secrets.txt',
    '/img-cache/..\\secrets.txt',
  ])('rejects a path escaping the cache root: %s', async (evil) => {
    await fs
      .writeFile(path.join(path.dirname(root), 'secrets.txt'), 'top secret')
      .catch(() => {});

    await expect(loadPageBytes(evil, { imgCacheRoot: root })).rejects.toThrow(
      /escapes|invalid/i,
    );
  });

  it.each([
    '/uploads/chapters/ch1/p0.jpg',
    '/api/proxy/uploads/chapters/ch1/p0.jpg', // the Reader's proxy-prefixed src
  ])('reads an uploaded chapter page from the uploads root on disk: %s', async (url) => {
    const dir = path.join(root, 'chapters', 'ch1');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'p0.jpg'), Buffer.from('upload-bytes'));

    const buf = await loadPageBytes(url, {
      imgCacheRoot: path.join(root, '_nope'),
      uploadsRoot: root,
    });

    expect(buf.toString()).toBe('upload-bytes');
  });

  it.each([
    '/uploads/../secrets.txt',
    '/api/proxy/uploads/a/../../secrets.txt',
    '/uploads/%2e%2e/secrets.txt',
  ])('rejects an uploads path escaping the uploads root: %s', async (evil) => {
    await fs
      .writeFile(path.join(path.dirname(root), 'secrets.txt'), 'top secret')
      .catch(() => {});

    await expect(
      loadPageBytes(evil, { imgCacheRoot: root, uploadsRoot: root }),
    ).rejects.toThrow(/escapes|invalid/i);
  });

  it('fetches an external URL and returns its bytes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode('cdn-bytes').buffer),
    });

    const buf = await loadPageBytes(
      'https://uploads.mangadex.org/data/h/1.jpg',
      {
        imgCacheRoot: root,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(buf.toString()).toBe('cdn-bytes');
    const [calledUrl, calledInit] = fetchImpl.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe('https://uploads.mangadex.org/data/h/1.jpg');
    expect(calledInit.headers).toBeDefined();
  });

  it('throws on a non-OK upstream response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(
      loadPageBytes('https://uploads.mangadex.org/data/h/404.jpg', {
        imgCacheRoot: root,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP 404/);
  });
});
