import { ImageCacheService } from './image-cache.service';
import type { StorageProvider } from '../common/storage/storage-provider.interface';

/**
 * Test double for StorageProvider that records how many times each method
 * is called, so we can assert the cache-hit path batches existence checks
 * into a single list(dir) call instead of N individual exists() calls.
 */
class CountingStorage implements StorageProvider {
  existsCalls = 0;
  listCalls = 0;
  /** Bare filenames present under every prefix (disk-style listing). */
  constructor(private readonly files: string[]) {}

  async put(): Promise<void> {}
  async get(): Promise<Buffer> {
    return Buffer.alloc(0);
  }
  async delete(): Promise<void> {}
  async deleteDir(): Promise<void> {}
  async exists(): Promise<boolean> {
    this.existsCalls++;
    return true;
  }
  async list(): Promise<string[]> {
    this.listCalls++;
    return this.files;
  }
}

describe('ImageCacheService — batched exists on cache hit (FR-19)', () => {
  const prev = process.env.IMAGE_CACHE_ENABLED;

  beforeAll(() => {
    process.env.IMAGE_CACHE_ENABLED = 'true';
  });

  afterAll(() => {
    if (prev === undefined) delete process.env.IMAGE_CACHE_ENABLED;
    else process.env.IMAGE_CACHE_ENABLED = prev;
  });

  it('localCoverPaths uses a single list(dir) call, not one exists() per cover', async () => {
    const urls = [
      'https://x/c0.jpg',
      'https://x/c1.jpg',
      'https://x/c2.jpg',
      'https://x/c3.jpg',
    ];
    const storage = new CountingStorage(['c0.jpg', 'c1.jpg', 'c2.jpg', 'c3.jpg']);
    const svc = new ImageCacheService(storage);

    const result = await svc.localCoverPaths('manga1', urls);

    expect(storage.listCalls).toBe(1);
    expect(storage.existsCalls).toBe(0);
    expect(result).toEqual([
      '/img-cache/manga1/covers/c0.jpg',
      '/img-cache/manga1/covers/c1.jpg',
      '/img-cache/manga1/covers/c2.jpg',
      '/img-cache/manga1/covers/c3.jpg',
    ]);
  });

  it('localPagePaths uses a single list(dir) call, not one exists() per page', async () => {
    const urls = ['https://x/a.png', 'https://x/b.png', 'https://x/c.png'];
    const storage = new CountingStorage(['p0.png', 'p1.png', 'p2.png']);
    const svc = new ImageCacheService(storage);

    const result = await svc.localPagePaths('book1', 'chap1', urls, 'p');

    expect(storage.listCalls).toBe(1);
    expect(storage.existsCalls).toBe(0);
    expect(result).toEqual([
      '/img-cache/book1/chapters/chap1/p0.png',
      '/img-cache/book1/chapters/chap1/p1.png',
      '/img-cache/book1/chapters/chap1/p2.png',
    ]);
  });

  it('localPagePaths returns external URL for pages not in the listing', async () => {
    const urls = ['https://x/a.png', 'https://x/b.png'];
    // only p0 is cached; p1 is missing
    const storage = new CountingStorage(['p0.png']);
    const svc = new ImageCacheService(storage);

    const result = await svc.localPagePaths('book1', 'chap1', urls, 'p');

    expect(storage.listCalls).toBe(1);
    expect(result[0]).toBe('/img-cache/book1/chapters/chap1/p0.png');
    expect(result[1]).toBe('https://x/b.png');
  });

  it('tolerates full-key listings (R2-style) by matching on basename', async () => {
    const urls = ['https://x/c0.jpg', 'https://x/c1.jpg'];
    const storage = new CountingStorage([
      'img-cache/manga1/covers/c0.jpg',
      'img-cache/manga1/covers/c1.jpg',
    ]);
    const svc = new ImageCacheService(storage);

    const result = await svc.localCoverPaths('manga1', urls);

    expect(storage.listCalls).toBe(1);
    expect(result).toEqual([
      '/img-cache/manga1/covers/c0.jpg',
      '/img-cache/manga1/covers/c1.jpg',
    ]);
  });
});
