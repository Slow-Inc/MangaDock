import { BooksService } from './books.service';

/**
 * Regression for the all-cached batch registry leak (Issue #127).
 *
 * When every page of a chapter is already cached, `startOrAttachBatchJob`
 * early-returns after serving the cache — but used to leave its placeholder
 * job in `activeBatchJobs` with an already-resolved promise. Every subsequent
 * batch-translate call for the same jobKey then attached to that stale job,
 * replayed its empty `completedPages`, awaited the resolved promise, and
 * returned immediately: the caller received nothing (no cache, no MIT call).
 *
 * The observable contract: every caller of an all-cached batch job receives
 * every cached page — not just the first caller.
 */
function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { put: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(undefined) };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    storage as any,
  );
  return { service, cache };
}

describe('BooksService — all-cached batch job registry lifecycle', () => {
  const pages = [
    { pageIndex: 0, pageUrl: 'http://img/0.jpg' },
    { pageIndex: 1, pageUrl: 'http://img/1.jpg' },
  ];
  const cachedEntry = {
    data: { patches: [{ xPct: 0, yPct: 0, wPct: 1, hPct: 1, url: 'http://b/p.png' }] },
  };

  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    // Guard: the all-cached path must never reach MIT.
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
  });
  afterEach(() => jest.restoreAllMocks());

  it('serves cached pages to a second caller, not just the first', async () => {
    const { service, cache } = makeService();
    cache.get.mockResolvedValue(cachedEntry);

    const first = jest.fn();
    await service.startOrAttachBatchJob('ch-cached', pages, first, 'ja', 'th');
    expect(first).toHaveBeenCalledTimes(pages.length);

    const second = jest.fn();
    await service.startOrAttachBatchJob('ch-cached', pages, second, 'ja', 'th');
    expect(second).toHaveBeenCalledTimes(pages.length);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not leave a finished all-cached job in the registry', async () => {
    const { service, cache } = makeService();
    cache.get.mockResolvedValue(cachedEntry);

    await service.startOrAttachBatchJob('ch-cached-2', pages, jest.fn(), 'ja', 'th');

    expect((service as any).activeBatchJobs.size).toBe(0);
  });
});
