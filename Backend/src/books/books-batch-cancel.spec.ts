import { BooksService } from './books.service';

/**
 * Regression for the batch-cancel jobKey asymmetry.
 *
 * `startOrAttachBatchJob` builds the registry key via `shouldSendMitSourceLang()`
 * (so srcMIT collapses to 'ANY' when MIT_SEND_SOURCE_LANG=false), but
 * `removeBatchListener` used to rebuild the key with its own formula that ignored
 * that flag. Result: under MIT_SEND_SOURCE_LANG=false the remove path looked up a
 * key the start path never registered, the last-listener-gone branch never ran,
 * and MIT kept translating. Both paths must build the key identically.
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

function seedJob(service: BooksService, jobKey: string) {
  const cancelController = new AbortController();
  const job = {
    completedPages: new Map(),
    processingPages: new Set<number>(),
    listeners: new Set<any>(),
    activeCallerCount: 1,
    expectedCount: 1,
    resolve: jest.fn(),
    reject: jest.fn(),
    cancelController,
  };
  (service as any).batch.activeBatchJobs.set(jobKey, job);
  return job;
}

describe('BooksService — batch cancel jobKey symmetry', () => {
  let fetchSpy: jest.SpyInstance;
  const prevEnv = process.env.MIT_SEND_SOURCE_LANG;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }) as any);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (prevEnv === undefined) delete process.env.MIT_SEND_SOURCE_LANG;
    else process.env.MIT_SEND_SOURCE_LANG = prevEnv;
  });

  it('removeBatchListener cancels the started job when MIT_SEND_SOURCE_LANG=false', () => {
    process.env.MIT_SEND_SOURCE_LANG = 'false';
    const { service } = makeService();

    // The key the START path registers (single source of truth).
    const jobKey: string = (service as any).batch.buildJobKey(
      'ch1',
      'ja',
      'th',
    );
    // Sanity: the flag is honored — source collapses to ANY.
    expect(jobKey).toContain(':ANY:');

    const job = seedJob(service, jobKey);
    const listener = jest.fn();

    service.removeBatchListener('ch1', 'ja', 'th', listener);

    expect(job.activeCallerCount).toBe(0);
    expect(job.cancelController.signal.aborted).toBe(true);
    // Best-effort POST /cancel/{jobKey} to MIT.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('/cancel/');
  });

  it('removeBatchListener cancels the started job in the default config too', () => {
    delete process.env.MIT_SEND_SOURCE_LANG; // defaults to "true"
    const { service } = makeService();

    const jobKey: string = (service as any).batch.buildJobKey(
      'ch2',
      'ja',
      'th',
    );
    const job = seedJob(service, jobKey);

    service.removeBatchListener('ch2', 'ja', 'th', jest.fn());

    expect(job.cancelController.signal.aborted).toBe(true);
  });
});
