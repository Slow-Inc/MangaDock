import { BooksService } from './books.service';

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    available: true,
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => {}),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeService(redis: any = makeRedis()) {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { put: jest.fn().mockResolvedValue(undefined) };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    storage as any,
    redis,
  );
  return { service, cache, storage, redis };
}

function seedJob(service: BooksService, jobKey: string, overrides: Partial<any> = {}) {
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
  (service as any).activeBatchJobs.set(jobKey, job);
  return job;
}

describe('BooksService — Redis pub/sub batch translation (#88)', () => {
  afterEach(() => jest.restoreAllMocks());

  // ─── handleMitCallback publish ────────────────────────────────────────────

  it('publishes pageIndex to translate:{taskId} channel after caching webhook result', async () => {
    const redis = makeRedis();
    const { service } = makeService(redis);
    seedJob(service, 'ch1:ANY:THA');

    await service.handleMitCallback('ch1:ANY:THA', 0, { imgWidth: 800, imgHeight: 1200, patches: [] }, undefined);

    expect(redis.publish).toHaveBeenCalledWith(
      'translate:ch1:ANY:THA',
      expect.objectContaining({ pageIndex: 0 }),
    );
  });

  it('publish payload includes patches array', async () => {
    const redis = makeRedis();
    const { service, storage } = makeService(redis);
    seedJob(service, 'ch1:ANY:THA');

    await service.handleMitCallback(
      'ch1:ANY:THA', 0,
      { imgWidth: 800, imgHeight: 1200, patches: [{ x: 0, y: 0, w: 100, h: 100, img_b64: '' }] },
      undefined,
    );

    const payload = redis.publish.mock.calls[0][1];
    expect(payload).toHaveProperty('patches');
    expect(payload.patches).toHaveLength(1);
  });

  it('publishes error field when webhook carries an error', async () => {
    const redis = makeRedis();
    const { service } = makeService(redis);
    seedJob(service, 'ch1:ANY:THA');

    await service.handleMitCallback('ch1:ANY:THA', 0, {}, 'translation failed');

    expect(redis.publish).toHaveBeenCalledWith(
      'translate:ch1:ANY:THA',
      expect.objectContaining({ pageIndex: 0, error: 'translation failed' }),
    );
  });

  it('does not publish when redis is unavailable (null)', async () => {
    const { service } = makeService(null);
    const job = seedJob(service, 'ch1:ANY:THA');

    await service.handleMitCallback('ch1:ANY:THA', 0, { imgWidth: 800, imgHeight: 1200, patches: [] }, undefined);

    // No throw — graceful no-op; listener still notified via job.listeners fan-out
    expect(job.resolve).toHaveBeenCalled();
  });

  // ─── startOrAttachBatchJob subscribe ─────────────────────────────────────

  it('subscribes to translate:{jobKey} channel with correct name', async () => {
    const redis = makeRedis();
    const { service } = makeService(redis);
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, jest.fn() as any);

    await new Promise(resolve => setImmediate(resolve));
    expect(redis.subscribe).toHaveBeenCalledWith('translate:ch1:ANY:THA', expect.any(Function));

    const job = (service as any).activeBatchJobs.get('ch1:ANY:THA');
    job?.resolve?.();
    await jobPromise;
  });

  it('SSE handler subscribes and forwards page results to listener', async () => {
    const capturedHandler = { fn: null as any };
    const redis = makeRedis({
      subscribe: jest.fn().mockImplementation((_channel: string, handler: any) => {
        capturedHandler.fn = handler;
        return () => {};
      }),
    });
    const { service } = makeService(redis);
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const received: number[] = [];
    const listener = (pageIndex: number) => received.push(pageIndex);

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, listener as any);

    await new Promise(resolve => setImmediate(resolve));
    capturedHandler.fn?.({ pageIndex: 0, patches: [] });
    expect(received).toContain(0);

    const job = (service as any).activeBatchJobs.get('ch1:ANY:THA');
    job?.resolve?.();
    await jobPromise;
  });

  it('forwards error from Redis message to listener', async () => {
    const capturedHandler = { fn: null as any };
    const redis = makeRedis({
      subscribe: jest.fn().mockImplementation((_channel: string, handler: any) => {
        capturedHandler.fn = handler;
        return () => {};
      }),
    });
    const { service } = makeService(redis);
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const received: Array<{ pageIndex: number; error?: string }> = [];
    const listener = (pageIndex: number, result: any) => received.push({ pageIndex, error: result.error });

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, listener as any);

    await new Promise(resolve => setImmediate(resolve));
    capturedHandler.fn?.({ pageIndex: 0, patches: [], error: 'translation failed' });

    expect(received[0]).toMatchObject({ pageIndex: 0, error: 'translation failed' });

    const job = (service as any).activeBatchJobs.get('ch1:ANY:THA');
    job?.resolve?.();
    await jobPromise;
  });

  // ─── Double-delivery fix ──────────────────────────────────────────────────

  it('delivers each page to listener exactly once when Redis is available (no double-delivery)', async () => {
    // Wire publish → subscriber so both code paths fire in one test
    let capturedSubHandler: ((data: unknown) => void) | null = null;
    const redis = makeRedis({
      subscribe: jest.fn().mockImplementation((_channel: string, handler: any) => {
        capturedSubHandler = handler;
        return () => {};
      }),
      // Simulate real Redis: publish immediately delivers to subscriber
      publish: jest.fn().mockImplementation(async (_channel: string, data: unknown) => {
        capturedSubHandler?.(data);
      }),
    });
    const { service } = makeService(redis);

    let capturedJobKey: string;
    jest.spyOn(service as any, '_runMitBatch').mockImplementation(async (...args: any[]) => {
      capturedJobKey = args[6];
    });

    const received: number[] = [];
    const listener = (pageIndex: number) => received.push(pageIndex);

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, listener as any);

    await new Promise(resolve => setImmediate(resolve));

    // Webhook arrives → handleMitCallback → redis.publish → subscriber fires listener
    await service.handleMitCallback(capturedJobKey!, 0, { imgWidth: 800, imgHeight: 1200, patches: [] }, undefined);

    expect(received.filter(x => x === 0)).toHaveLength(1); // exactly once, not twice

    const job = (service as any).activeBatchJobs.get(capturedJobKey!);
    job?.resolve?.();
    await jobPromise;
  });

  it('original listener is NOT in job.listeners when Redis is available', async () => {
    const { service } = makeService(makeRedis());
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const listener = jest.fn();
    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, listener as any);

    await new Promise(resolve => setImmediate(resolve));

    const job = (service as any).activeBatchJobs.get('ch1:ANY:THA');
    expect(job.listeners.has(listener)).toBe(false); // Redis handles original caller

    job?.resolve?.();
    await jobPromise;
  });

  // ─── Unsubscribe / cleanup ────────────────────────────────────────────────

  it('calls unsubscribeRedis in finally block after job resolves', async () => {
    const unsubscribeFn = jest.fn();
    const redis = makeRedis({
      subscribe: jest.fn().mockReturnValue(unsubscribeFn),
    });
    const { service } = makeService(redis);
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, jest.fn() as any);

    await new Promise(resolve => setImmediate(resolve));

    const job = (service as any).activeBatchJobs.get('ch1:ANY:THA');
    job?.resolve?.();
    await jobPromise;

    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
  });

  it('calls unsubscribeRedis in finally block when job times out', async () => {
    jest.useFakeTimers();
    const unsubscribeFn = jest.fn();
    const redis = makeRedis({
      subscribe: jest.fn().mockReturnValue(unsubscribeFn),
    });
    const { service } = makeService(redis);
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service
      .startOrAttachBatchJob('ch1', pages, jest.fn() as any)
      .catch(() => {}); // expect rejection

    await Promise.resolve();
    jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    await jobPromise;

    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  // ─── Graceful degradation — Redis unavailable ─────────────────────────────

  it('falls back to job.listeners fan-out when Redis is not provided', async () => {
    const { service } = makeService(null); // no Redis
    const listener = jest.fn();
    seedJob(service, 'ch1:ANY:THA', { listeners: new Set([listener]) });

    await service.handleMitCallback('ch1:ANY:THA', 0, { imgWidth: 800, imgHeight: 1200, patches: [] }, undefined);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(0, expect.objectContaining({ patches: [] }));
  });

  it('adds original listener to job.listeners when Redis is not provided', async () => {
    const { service } = makeService(null);
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const listener = jest.fn();
    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, listener as any);

    await new Promise(resolve => setImmediate(resolve));

    const job = (service as any).activeBatchJobs.get('ch1:ANY:THA');
    expect(job.listeners.has(listener)).toBe(true); // fan-out is only delivery path

    job?.resolve?.();
    await jobPromise;
  });

  it('does not call subscribe when Redis is not provided', async () => {
    const { service } = makeService(null);
    jest.spyOn(service as any, '_runMitBatch').mockResolvedValue(undefined);

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    const jobPromise = service.startOrAttachBatchJob('ch1', pages, jest.fn() as any);

    await new Promise(resolve => setImmediate(resolve));
    // No redis → subscribe is never called (no error thrown)

    const job = (service as any).activeBatchJobs.get('ch1:ANY:THA');
    job?.resolve?.();
    await jobPromise;
  });

  // ─── Early return — all pages cached ─────────────────────────────────────

  it('does not subscribe to Redis when all pages are already cached', async () => {
    const redis = makeRedis();
    const { service, cache } = makeService(redis);

    // All pages are cached
    cache.get.mockResolvedValue({ data: { patches: [{ xPct: 0, yPct: 0, wPct: 1, hPct: 1, url: 'http://x/p.png' }] } });

    const listener = jest.fn();
    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];
    await service.startOrAttachBatchJob('ch1', pages, listener as any);

    expect(redis.subscribe).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1); // served from cache directly
  });

  // ─── Latecomer — no Redis subscribe, receives via job.listeners ───────────

  it('latecomer does not subscribe to Redis and still receives via job.listeners fan-out', async () => {
    const redis = makeRedis();
    const { service } = makeService(redis);

    let capturedJobKey: string;
    jest.spyOn(service as any, '_runMitBatch').mockImplementation(async (...args: any[]) => {
      capturedJobKey = args[6];
    });

    const pages = [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }];

    // First caller starts the job
    service.startOrAttachBatchJob('ch1', pages, jest.fn() as any);
    await new Promise(resolve => setImmediate(resolve));

    const subscribeCallCountBefore = (redis.subscribe as jest.Mock).mock.calls.length;

    // Latecomer attaches
    const lateReceived: number[] = [];
    const latePromise = service.startOrAttachBatchJob(
      'ch1', pages, (idx: number) => lateReceived.push(idx) as any,
    );
    await new Promise(resolve => setImmediate(resolve));

    // Latecomer should NOT have triggered a new Redis subscribe
    expect((redis.subscribe as jest.Mock).mock.calls.length).toBe(subscribeCallCountBefore);

    // Deliver page — latecomer receives via job.listeners fan-out
    await service.handleMitCallback(capturedJobKey!, 0, { imgWidth: 800, imgHeight: 1200, patches: [] }, undefined);
    await latePromise;

    expect(lateReceived).toContain(0);
  });

  it('latecomer receives replay of completed pages immediately on attach', async () => {
    const redis = makeRedis();
    const { service } = makeService(redis);

    let capturedJobKey: string;
    jest.spyOn(service as any, '_runMitBatch').mockImplementation(async (...args: any[]) => {
      capturedJobKey = args[6];
    });

    const pages = [
      { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
      { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
    ];

    // First caller
    service.startOrAttachBatchJob('ch1', pages, jest.fn() as any);
    await new Promise(resolve => setImmediate(resolve));

    // Deliver page 0 before latecomer attaches
    await service.handleMitCallback(capturedJobKey!, 0, { imgWidth: 800, imgHeight: 1200, patches: [] }, undefined);

    // Latecomer attaches — must replay page 0 immediately
    const lateReceived: number[] = [];
    const latePromise = service.startOrAttachBatchJob(
      'ch1', pages, (idx: number) => lateReceived.push(idx) as any,
    );
    await new Promise(resolve => setImmediate(resolve));
    expect(lateReceived).toContain(0); // replayed

    // Deliver page 1 — latecomer receives live
    await service.handleMitCallback(capturedJobKey!, 1, { imgWidth: 800, imgHeight: 1200, patches: [] }, undefined);
    await latePromise;
    expect(lateReceived).toContain(1);
  });

  // ─── Reconnect — cache-hit after job completes ────────────────────────────

  it('serves all pages from cache and does not subscribe when user reconnects after job completed', async () => {
    const redis = makeRedis();
    const { service, cache } = makeService(redis);

    // Simulate: job is gone from registry, all pages already in cache
    cache.get.mockResolvedValue({ data: { patches: [] } });

    const listener = jest.fn();
    const pages = [
      { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
      { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
    ];
    await service.startOrAttachBatchJob('ch1', pages, listener as any);

    expect(redis.subscribe).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(2); // all pages from cache
  });
});
