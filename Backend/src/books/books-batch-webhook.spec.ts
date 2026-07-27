import { BooksService } from './books.service';

function seedJob(
  service: BooksService,
  jobKey: string,
  overrides: Partial<any> = {},
) {
  const job = {
    completedPages: new Map(),
    processingPages: new Set<number>(),
    listeners: new Set<any>(),
    expectedCount: 1,
    resolve: jest.fn(),
    reject: jest.fn(),
    cancelController: new AbortController(),
    ...overrides,
  };
  (service as any).batch.activeBatchJobs.set(jobKey, job);
  return job;
}

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
  return { service, cache, storage };
}

describe('BooksService — batch webhook pipeline', () => {
  afterEach(() => {
    jest.useRealTimers(); // a failing fake-timer test must not poison the rest
    jest.restoreAllMocks();
  });

  // Cycle 2 — #73: startOrAttachBatchJob promise does not resolve until all pages delivered
  it('startOrAttachBatchJob resolves only after handleMitCallback delivers all expected pages', async () => {
    const { service } = makeService();

    let capturedJobKey!: string;
    jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        capturedJobKey = args[6];
      });

    const pages = [
      { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
      { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
    ];
    let resolved = false;
    const jobPromise = service
      .startOrAttachBatchJob('ch2', pages, jest.fn() as any)
      .then(() => {
        resolved = true;
      });

    await new Promise((resolve) => setImmediate(resolve));

    // Deliver page 0 only — job should still be pending
    await service.handleMitCallback(
      capturedJobKey,
      0,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );
    expect(resolved).toBe(false);

    // Deliver page 1 — job should now resolve
    await service.handleMitCallback(
      capturedJobKey,
      1,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );
    await jobPromise;
    expect(resolved).toBe(true);
  });

  // Cycle 3 — #73: promise rejects if timeout fires before all webhooks arrive
  it('rejects with timeout error when not all webhooks arrive within time limit', async () => {
    jest.useFakeTimers();
    const { service } = makeService();

    jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async () => {});

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob(
      'ch3',
      pages,
      jest.fn() as any,
    );

    // Drain microtasks until the job reaches steady state (the parallel
    // cache pre-check (#148) takes a few ticks; setImmediate is faked here)
    for (let i = 0; i < 20; i += 1) await Promise.resolve();

    jest.advanceTimersByTime(15 * 60 * 1000 + 1);

    await expect(jobPromise).rejects.toThrow(/timed out/);
    jest.useRealTimers();
  });

  // Cycle 4 — #73: abort signal rejects promise and cleans up job
  it('rejects when cancelController is aborted and removes job from registry', async () => {
    const { service } = makeService();

    let capturedJobKey!: string;
    jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        capturedJobKey = args[6];
      });

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob(
      'ch4',
      pages,
      jest.fn() as any,
    );

    await new Promise((resolve) => setImmediate(resolve));

    // Abort the job via its cancelController
    const job = (service as any).batch.activeBatchJobs.get(capturedJobKey);
    job.cancelController.abort();

    await expect(jobPromise).rejects.toThrow(/cancelled/);
    expect((service as any).batch.activeBatchJobs.has(capturedJobKey)).toBe(
      false,
    );
  });

  // Cycle 5 — #74: coords are normalized by image dimensions
  it('normalizes patch coordinates to fractions using imgWidth and imgHeight', async () => {
    const { service, cache } = makeService();
    const jobKey = 'ch5:ANY:THA:default:hd';
    (service as any).batch.activeBatchJobs.set(jobKey, {
      completedPages: new Map(),
      processingPages: new Set(),
      listeners: new Set(),
      expectedCount: 1,
      resolve: jest.fn(),
      reject: jest.fn(),
      cancelController: new AbortController(),
    });

    await service.handleMitCallback(
      jobKey,
      0,
      {
        imgWidth: 1000,
        imgHeight: 2000,
        patches: [{ x: 100, y: 400, w: 50, h: 80, img_b64: '' }],
      },
      undefined,
    );

    const cached = cache.set.mock.calls.find((c: any[]) =>
      String(c[0]).includes('translate:manga-patches'),
    );
    expect(cached[1].patches[0]).toMatchObject({
      xPct: 0.1,
      yPct: 0.2,
      wPct: 0.05,
      hPct: 0.04,
    });
  });

  // Cycle 6 — #74: imgWidth or imgHeight = 0 → no NaN
  it('clamps coordinates to 0 when imgWidth or imgHeight is 0', async () => {
    const { service, cache } = makeService();
    const jobKey = 'ch6:ANY:THA:default:hd';
    (service as any).batch.activeBatchJobs.set(jobKey, {
      completedPages: new Map(),
      processingPages: new Set(),
      listeners: new Set(),
      expectedCount: 1,
      resolve: jest.fn(),
      reject: jest.fn(),
      cancelController: new AbortController(),
    });

    await service.handleMitCallback(
      jobKey,
      0,
      {
        imgWidth: 0,
        imgHeight: 0,
        patches: [{ x: 100, y: 100, w: 50, h: 50, img_b64: '' }],
      },
      undefined,
    );

    const cached = cache.set.mock.calls.find((c: any[]) =>
      String(c[0]).includes('translate:manga-patches'),
    );
    const p = cached[1].patches[0];
    expect(Number.isNaN(p.xPct)).toBe(false);
    expect(Number.isNaN(p.yPct)).toBe(false);
    expect(p.xPct).toBe(0);
  });

  // Cycle 7 — #74: patch URL includes backendOrigin
  it('builds patch URL with backendOrigin prefix', async () => {
    const { service, cache } = makeService();
    const jobKey = 'ch7:ANY:THA:default:hd';
    (service as any).batch.activeBatchJobs.set(jobKey, {
      completedPages: new Map(),
      processingPages: new Set(),
      listeners: new Set(),
      expectedCount: 1,
      resolve: jest.fn(),
      reject: jest.fn(),
      cancelController: new AbortController(),
    });

    await service.handleMitCallback(
      jobKey,
      0,
      {
        imgWidth: 800,
        imgHeight: 1200,
        patches: [{ x: 0, y: 0, w: 100, h: 100, img_b64: '' }],
      },
      undefined,
    );

    const cached = cache.set.mock.calls.find((c: any[]) =>
      String(c[0]).includes('translate:manga-patches'),
    );
    expect(cached[1].patches[0].url).toMatch(/^http:\/\/localhost/);
  });

  // Cycle 8 — #76: duplicate concurrent webhooks → exactly one storage.put()
  it('processes a duplicate webhook for the same pageIndex exactly once', async () => {
    const { service, storage } = makeService();
    const jobKey = 'ch8:ANY:THA:default:hd';
    const resolveFn = jest.fn();
    (service as any).batch.activeBatchJobs.set(jobKey, {
      completedPages: new Map(),
      processingPages: new Set<number>(),
      listeners: new Set(),
      expectedCount: 1,
      resolve: resolveFn,
      reject: jest.fn(),
      cancelController: new AbortController(),
    });

    const payload = {
      imgWidth: 800,
      imgHeight: 1200,
      patches: [{ x: 0, y: 0, w: 100, h: 100, img_b64: '' }],
    };
    // Fire two concurrent calls for the same page
    await Promise.all([
      service.handleMitCallback(jobKey, 0, payload, undefined),
      service.handleMitCallback(jobKey, 0, payload, undefined),
    ]);

    expect(storage.put).toHaveBeenCalledTimes(1);
  });

  // Cycle 9 — #76: listener notified exactly once even with duplicate webhook
  it('notifies listener exactly once per pageIndex even with duplicate webhooks', async () => {
    const { service } = makeService();
    const jobKey = 'ch9:ANY:THA:default:hd';
    const listener = jest.fn();
    (service as any).batch.activeBatchJobs.set(jobKey, {
      completedPages: new Map(),
      processingPages: new Set<number>(),
      listeners: new Set([listener]),
      expectedCount: 1,
      resolve: jest.fn(),
      reject: jest.fn(),
      cancelController: new AbortController(),
    });

    const payload = { imgWidth: 800, imgHeight: 1200, patches: [] };
    await Promise.all([
      service.handleMitCallback(jobKey, 0, payload, undefined),
      service.handleMitCallback(jobKey, 0, payload, undefined),
    ]);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  // Cycle 10 — #77: latecomer receives pages delivered before attachment via replay
  it('replays already-completed pages to latecomer immediately on attach', async () => {
    const { service } = makeService();

    let capturedJobKey!: string;
    jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        capturedJobKey = args[6];
      });

    const pages = [
      { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
      { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
    ];

    // First caller starts the job
    const firstReceived: number[] = [];
    const firstPromise = service.startOrAttachBatchJob(
      'ch10',
      pages,
      (idx: number) => firstReceived.push(idx) as any,
    );

    await new Promise((resolve) => setImmediate(resolve));

    // Deliver page 0 to the first caller
    await service.handleMitCallback(
      capturedJobKey,
      0,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );
    expect(firstReceived).toContain(0);

    // Latecomer attaches — should immediately receive page 0 via replay
    const lateReceived: number[] = [];
    const latePromise = service.startOrAttachBatchJob(
      'ch10',
      pages,
      (idx: number) => lateReceived.push(idx) as any,
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(lateReceived).toContain(0); // replayed immediately

    // Deliver page 1 — both should receive it
    await service.handleMitCallback(
      capturedJobKey,
      1,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );
    await Promise.all([firstPromise, latePromise]);

    expect(lateReceived).toContain(1);
  });

  // Cycle 11 — #77: latecomer does not miss pages that arrive between replay and listener.add()
  it('does not miss a page delivered concurrently during latecomer attach', async () => {
    const { service } = makeService();

    let capturedJobKey!: string;
    jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        capturedJobKey = args[6];
      });

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];

    // First caller
    service.startOrAttachBatchJob('ch11', pages, jest.fn() as any);
    await new Promise((resolve) => setImmediate(resolve));

    // Latecomer attaches and immediately receives via replay+live
    const lateReceived: number[] = [];
    const latePromise = service.startOrAttachBatchJob(
      'ch11',
      pages,
      (idx: number) => lateReceived.push(idx) as any,
    );

    // Deliver page 0 right as latecomer is attaching
    await service.handleMitCallback(
      capturedJobKey,
      0,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );

    await latePromise;
    expect(lateReceived).toContain(0);
  });

  // Cycle 12 — #78: job added to registry synchronously before first cache.get yield (closes TOCTOU window)
  it('registers job in activeBatchJobs before first cache.get yield', async () => {
    const { service } = makeService();

    let jobInRegistryAtYield: boolean | null = null;
    (service as any).cache.get = jest.fn().mockImplementation(async () => {
      // At this yield point, job must already be in the registry
      jobInRegistryAtYield = (service as any).batch.activeBatchJobs.size > 0;
      return null;
    });

    jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        const jobKey = args[6];
        // Yield until after activeBatchJobs.set() runs synchronously
        await new Promise((resolve) => setImmediate(resolve));
        await service.handleMitCallback(
          jobKey,
          0,
          { imgWidth: 800, imgHeight: 1200, patches: [] },
          undefined,
        );
      });

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    await service.startOrAttachBatchJob('ch12', pages, jest.fn() as any);

    expect(jobInRegistryAtYield).toBe(true);
  });

  // Cycle 13 — #78: sequential second call attaches as latecomer when job is already running
  it('attaches second call as latecomer when same chapter job is already in registry', async () => {
    const { service } = makeService();

    let capturedJobKey!: string;
    const runMitSpy = jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        capturedJobKey = args[6];
        // Do not deliver pages yet — let latecomer attach first
      });

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];

    // Start first job (does NOT resolve yet — no handleMitCallback called)
    service.startOrAttachBatchJob('ch13', pages, jest.fn() as any);
    await new Promise((resolve) => setImmediate(resolve)); // let _runMitBatch mock run

    // Second call should find the running job and attach as latecomer
    const secondReceived: number[] = [];
    const secondPromise = service.startOrAttachBatchJob(
      'ch13',
      pages,
      (idx: number) => secondReceived.push(idx) as any,
    );

    // Now deliver the page — both listeners should receive it
    await service.handleMitCallback(
      capturedJobKey,
      0,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );
    await secondPromise;

    expect(runMitSpy).toHaveBeenCalledTimes(1);
    expect(secondReceived).toContain(0);
  });

  // Cycle 1 — #73: listener receives results via handleMitCallback even when _runMitBatch resolves early
  it('delivers webhook page result to listener even when _runMitBatch resolves before webhooks arrive', async () => {
    const { service } = makeService();

    let capturedJobKey!: string;
    jest
      .spyOn((service as any).batch.stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        capturedJobKey = args[6]; // taskId = jobKey
      });

    const received: number[] = [];
    const listener = (_pageIndex: number, _result: any) =>
      received.push(_pageIndex);

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob(
      'ch1',
      pages,
      listener as any,
    );

    // Yield: allow _runMitBatch mock to resolve and .finally() to fire
    await new Promise((resolve) => setImmediate(resolve));

    // Simulate webhook arriving after _runMitBatch has already returned
    await service.handleMitCallback(
      capturedJobKey,
      0,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );

    expect(received).toContain(0);

    await jobPromise;
  });

  // Cycle — #90 S3: img_b64 size limit prevents OOM from oversized blob
  it('skips patch and does not call storage.put when img_b64 exceeds size limit', async () => {
    const { service, storage, cache } = makeService();
    const jobKey = 'ch1:ANY:THA:default:hd';
    seedJob(service, jobKey);

    const oversizedB64 = 'A'.repeat(5_000_001); // > 5 MB encoded
    await service.handleMitCallback(
      jobKey,
      0,
      {
        imgWidth: 800,
        imgHeight: 1200,
        patches: [{ x: 0, y: 0, w: 100, h: 100, img_b64: oversizedB64 }],
      },
      undefined,
    );

    expect(storage.put).not.toHaveBeenCalled(); // oversized patch skipped
  });

  it('still processes remaining patches when one patch exceeds size limit', async () => {
    const { service, storage, cache } = makeService();
    const jobKey = 'ch1:ANY:THA:default:hd';
    seedJob(service, jobKey, { expectedCount: 1 });

    const oversizedB64 = 'A'.repeat(5_000_001);
    await service.handleMitCallback(
      jobKey,
      0,
      {
        imgWidth: 800,
        imgHeight: 1200,
        patches: [
          { x: 0, y: 0, w: 100, h: 100, img_b64: oversizedB64 }, // skip
          { x: 10, y: 10, w: 50, h: 50, img_b64: '' }, // keep
        ],
      },
      undefined,
    );

    expect(storage.put).toHaveBeenCalledTimes(1); // only the valid patch
  });

  // 2026-06-06 incident: an all-error batch (dead MIT worker) logged
  // "fully completed via webhooks" — the completion summary must report page errors.
  it('logs a truthful summary when the job completes with page errors', async () => {
    const { service } = makeService();
    const jobKey = 'ch-err:ANY:THA:default:hd';
    const job = seedJob(service, jobKey, { expectedCount: 2 });
    const warnSpy = jest
      .spyOn((service as any).batch.logger, 'warn')
      .mockImplementation(() => {});
    const logSpy = jest
      .spyOn((service as any).batch.logger, 'log')
      .mockImplementation(() => {});

    await service.handleMitCallback(
      jobKey,
      0,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );
    await service.handleMitCallback(
      jobKey,
      1,
      { imgWidth: 0, imgHeight: 0, patches: [] },
      'Translation service is starting up, please wait a moment and try again.',
    );

    expect(job.resolve).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1/2 page errors'),
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('fully completed'),
    );
  });

  it('keeps the "fully completed" log when every page succeeds', async () => {
    const { service } = makeService();
    const jobKey = 'ch-ok:ANY:THA:default:hd';
    const job = seedJob(service, jobKey, { expectedCount: 1 });
    const warnSpy = jest
      .spyOn((service as any).batch.logger, 'warn')
      .mockImplementation(() => {});
    const logSpy = jest
      .spyOn((service as any).batch.logger, 'log')
      .mockImplementation(() => {});

    await service.handleMitCallback(
      jobKey,
      0,
      { imgWidth: 800, imgHeight: 1200, patches: [] },
      undefined,
    );

    expect(job.resolve).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('fully completed'),
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('page errors'),
    );
  });
});
