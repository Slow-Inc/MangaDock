import { BooksService } from './books.service';

/**
 * GET /books/models payload (Issue #133, PRD #131).
 *
 * The Reader decides whether to show the Gemini model selector based on the
 * `imageTranslator` reported here — sourced from MIT's `/ready` (#132). MIT
 * being down must never break the endpoint: `imageTranslator` degrades to
 * null (Frontend fail-open) while `models` still returns.
 */
function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    put: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    storage as any,
  );
  return { service };
}

const readyResponse = (translator?: string) =>
  new Response(
    JSON.stringify({
      ready: true,
      workers: 1,
      ...(translator ? { translator } : {}),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );

describe('BooksService — image translator discovery (#133)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports the translator MIT announces on /ready', async () => {
    const { service } = makeService();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(readyResponse('qwen3') as any);

    await expect(service.getImageTranslator()).resolves.toBe('qwen3');
  });

  it('degrades to null when MIT is unreachable', async () => {
    const { service } = makeService();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.getImageTranslator()).resolves.toBeNull();
  });

  it('degrades to null on 503 (worker not registered yet)', async () => {
    const { service } = makeService();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ready: false, status: 'starting' }), {
        status: 503,
      }) as any,
    );

    await expect(service.getImageTranslator()).resolves.toBeNull();
  });

  it('degrades to null when /ready predates #132 (no translator field)', async () => {
    const { service } = makeService();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(readyResponse(undefined) as any);

    await expect(service.getImageTranslator()).resolves.toBeNull();
  });

  it('caches the answer so menu opens do not hammer MIT', async () => {
    const { service } = makeService();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(readyResponse('qwen3') as any);

    await service.getImageTranslator();
    await service.getImageTranslator();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('getMangaModelsInfo returns models alongside the translator', async () => {
    const { service } = makeService();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(readyResponse('qwen3') as any);
    jest
      .spyOn(service as any, 'getMangaModels')
      .mockResolvedValue(['gemini-2.5-flash', 'gemini-2.5-flash-lite']);

    await expect(service.getMangaModelsInfo()).resolves.toEqual({
      models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      imageTranslator: 'qwen3',
    });
  });
});
