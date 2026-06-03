import { BooksService } from './books.service';

function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BooksService(
    {} as any, cache as any, { enabled: false } as any, {} as any, {} as any,
  );
  return { service };
}

describe('BooksService — health check (#83)', () => {
  afterEach(() => jest.restoreAllMocks());

  // Cycle 1 — checkMitHealth calls /ready not root /
  it('calls /ready endpoint instead of root /', async () => {
    const { service } = makeService();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    await service.checkMitHealth();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/ready'),
      expect.any(Object),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/localhost:\d+\/$/),
      expect.any(Object),
    );
  });

  // Cycle 2 — /ready returning 503 means not available
  it('reports unavailable when /ready returns 503', async () => {
    const { service } = makeService();
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);

    const result = await service.checkMitHealth();

    expect(result.available).toBe(false);
  });
});
