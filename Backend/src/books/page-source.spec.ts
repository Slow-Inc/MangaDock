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
