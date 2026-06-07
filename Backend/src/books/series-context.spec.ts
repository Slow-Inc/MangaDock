import { BooksService } from './books.service';
import { composeSeriesContext } from './series-context';

/**
 * Series context (#157): a pure composer turns already-fetched catalog
 * metadata into the context string MIT appends to the translator system
 * prompt. No metadata → undefined → behavior identical to today (local-first).
 */
describe('composeSeriesContext', () => {
  it('composes title + synopsis into a translator-facing context string', () => {
    const ctx = composeSeriesContext({
      title: 'Mob Seka',
      description: 'An office worker is reincarnated into an otome game world.',
    });
    expect(ctx).toContain('Mob Seka');
    expect(ctx).toContain('reincarnated into an otome game world');
  });

  it('returns title-only context when the synopsis is missing', () => {
    const ctx = composeSeriesContext({ title: 'Mob Seka' });
    expect(ctx).toContain('Mob Seka');
    expect(ctx).not.toContain('Synopsis');
  });

  it('returns undefined when there is no title (synopsis alone is not anchorable)', () => {
    expect(composeSeriesContext({ description: 'some synopsis' })).toBeUndefined();
    expect(composeSeriesContext({})).toBeUndefined();
    expect(composeSeriesContext(undefined)).toBeUndefined();
  });

  it('treats whitespace-only fields as absent', () => {
    expect(composeSeriesContext({ title: '   ' })).toBeUndefined();
    const ctx = composeSeriesContext({ title: 'Mob Seka', description: '  \n ' });
    expect(ctx).toContain('Mob Seka');
    expect(ctx).not.toContain('Synopsis');
  });

  it('collapses internal whitespace and caps a runaway synopsis', () => {
    const long = 'word '.repeat(500); // 2500 chars of synopsis
    const ctx = composeSeriesContext({ title: 'T', description: long })!;
    expect(ctx.length).toBeLessThanOrEqual(700);
    expect(ctx).not.toContain('\n\n'); // collapsed
  });
});

/** mangaId rides the translate request; the service fetches catalog metadata
 *  itself (never trusting client content) and threads the composed context
 *  into the MIT config. Catalog failure degrades to context-free translate. */
describe('series context plumbing — translate paths', () => {
  function makeService(detail: unknown | Error) {
    const mangaDex = {
      getMangaDetail: jest.fn(
        detail instanceof Error
          ? () => Promise.reject(detail)
          : () => Promise.resolve(detail),
      ),
    };
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
    };
    const storage = { put: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(undefined) };
    const service = new BooksService(
      mangaDex as any,
      cache as any,
      { enabled: false } as any,
      {} as any,
      storage as any,
    );
    return { service, mangaDex };
  }

  afterEach(() => jest.restoreAllMocks());

  /** Mock the network: image fetches return bytes; the MIT submission is
   *  captured (config form field) and answered 202-accepted, so the batch
   *  path runs for real up to the wire. */
  function mockMitFetch(onConfig: (cfg: string) => void) {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any, init?: any) => {
      if (String(url).includes('/translate/with-form/patches')) {
        onConfig(String((init.body as FormData).get('config')));
        return {
          ok: true,
          status: 202,
          headers: { get: () => 'application/json' },
          json: async () => ({ status: 'accepted' }),
        } as any;
      }
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as any;
    });
  }

  async function runBatchJob(service: BooksService) {
    const submitted = new Promise<string>((resolve) => mockMitFetch(resolve));
    const jobPromise = service.startOrAttachBatchJob(
      'ch1',
      [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }],
      jest.fn() as any,
      'ja',
      'th',
      undefined,
      'hd',
      'manga-123',
    );
    const config = await submitted;
    // Deliver the webhook so the job promise resolves.
    const jobKey = (service as any).buildJobKey('ch1', 'ja', 'th', undefined, 'hd');
    await service.handleMitCallback(jobKey, 0, { imgWidth: 1, imgHeight: 1, patches: [] }, undefined);
    await jobPromise;
    return JSON.parse(config);
  }

  it('batch job composes series context from the catalog and sends it to MIT', async () => {
    const { service, mangaDex } = makeService({ title: 'Mob Seka', description: 'Otome game world.' });
    const cfg = await runBatchJob(service);
    expect(mangaDex.getMangaDetail).toHaveBeenCalledWith('manga-123');
    expect(cfg.translator.series_context).toContain('Mob Seka');
  });

  it('catalog failure degrades to a context-free batch run (local-first rule)', async () => {
    const { service } = makeService(new Error('mangadex down'));
    const cfg = await runBatchJob(service);
    expect(cfg.translator.series_context).toBeUndefined();
  });

  it('single-page translate sends series_context inside the MIT config form', async () => {
    const { service } = makeService({ title: 'Mob Seka', description: 'Otome game world.' });

    let mitConfig = '';
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any, init?: any) => {
      if (String(url).includes('/translate/with-form/patches')) {
        mitConfig = String((init.body as FormData).get('config'));
        return {
          ok: true,
          json: async () => ({ img_width: 1, img_height: 1, patches: [] }),
        } as any;
      }
      // The page image fetch.
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as any;
    });

    await service.translateMangaPagePatches('ch1', 0, 'http://example.com/0.jpg', 'ja', 'th', {
      mangaId: 'manga-123',
    });

    const cfg = JSON.parse(mitConfig);
    expect(cfg.translator.series_context).toContain('Mob Seka');
  });
});
