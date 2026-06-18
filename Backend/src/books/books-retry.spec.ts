import { BooksService } from './books.service';

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
  return { service, cache, storage };
}

describe('BooksService — retry fallback (#82)', () => {
  afterEach(() => jest.restoreAllMocks());

  // Cycle 1 — aborted signal stops retry calls immediately
  it('stops retrying pages when AbortSignal is aborted', async () => {
    const { service } = makeService();
    const patchesSpy = jest.spyOn(service as any, 'translateMangaPagePatches')
      .mockResolvedValue({ patches: [] });

    const controller = new AbortController();
    controller.abort(); // abort before any call

    const notify = jest.fn();
    const pages = [
      { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
      { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
    ];

    await (service as any).batch.stream._retryMissingPagesIndividually(
      'ch1', pages, new Set<number>(), notify, undefined, undefined, undefined, controller.signal,
    );

    expect(patchesSpy).not.toHaveBeenCalled();
  });

  // Cycle 2 — fallback passes maxStartupRetries:3 to translateMangaPagePatches
  it('calls translateMangaPagePatches with maxStartupRetries:3 in fallback path', async () => {
    const { service } = makeService();
    const patchesSpy = jest.spyOn(service as any, 'translateMangaPagePatches')
      .mockResolvedValue({ patches: [] });

    const notify = jest.fn();
    await (service as any).batch.stream._retryMissingPagesIndividually(
      'ch2',
      [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }],
      new Set<number>(),
      notify,
    );

    expect(patchesSpy).toHaveBeenCalledWith(
      'ch2', 0, 'http://example.com/0.jpg', undefined, undefined,
      { maxStartupRetries: 3, imageModel: undefined, derivative: 'hd' },
    );
  });
});
