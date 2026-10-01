import { MitBatchOrchestrator } from './mit-batch-orchestrator.service';

/**
 * #234 S5d — listener/caller bookkeeping. With MitClient faked, the orchestrator's
 * registry is unit-testable directly. The race: a latecomer attaches to a running
 * job and awaits its promise; if the job REJECTS (15-min timeout or abort), the
 * latecomer's post-await `listeners.delete` was skipped, leaking the listener.
 */
function makeOrchestrator() {
  const mitClient = {
    baseUrl: 'http://mit',
    ready: jest.fn(),
    submitBatch: jest.fn(),
    submitSinglePage: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
  };
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const deps = {
    persistPage: jest.fn().mockResolvedValue([]),
    seriesContextFor: jest.fn().mockResolvedValue(undefined),
    translateSinglePage: jest.fn().mockResolvedValue({ patches: [] }),
  };
  const orch = new MitBatchOrchestrator(mitClient as any, cache as any, deps);
  return { orch, mitClient, cache, deps };
}

/** A running job seeded straight into the registry with a controllable promise. */
function seedRunningJob(orch: MitBatchOrchestrator, jobKey: string) {
  let reject!: (err: any) => void;
  const promise = new Promise<void>((_res, rej) => {
    reject = rej;
  });
  promise.catch(() => {}); // avoid unhandled-rejection noise
  const job = {
    completedPages: new Map(),
    processingPages: new Set(),
    listeners: new Set(),
    originalListener: undefined,
    activeCallerCount: 1,
    promise,
    cancelController: new AbortController(),
    resolve: jest.fn(),
    reject: jest.fn(),
    expectedCount: 1,
  };
  (orch as any).activeBatchJobs.set(jobKey, job);
  return { job, reject };
}

describe('MitBatchOrchestrator — #524 rolling-context cache-safety', () => {
  const PAGES = [
    { pageIndex: 0, pageUrl: 'u0' },
    { pageIndex: 1, pageUrl: 'u1' },
  ];
  // page 0 cached, page 1 a miss — the exact poison shape from #524.
  const partialCache = (key: string) =>
    key.includes(':ch1:0:') ? { data: { patches: [{ x: 1 }] } } : null;

  /** Replace the transport with a stub that delivers each sent page via `notify`
   *  (so the job completes) and lets us inspect which pages were sent to MIT. */
  function stubStream(orch: MitBatchOrchestrator) {
    return jest
      .spyOn((orch as any).stream, 'run')
      .mockImplementation(async (...args: any[]) => {
        const [, sentPages, notify] = args;
        for (const p of sentPages) notify(p.pageIndex, { patches: [] });
      });
  }

  let prevCtx: string | undefined;
  beforeEach(() => {
    prevCtx = process.env.MIT_CONTEXT_PAGES;
  });
  afterEach(() => {
    if (prevCtx === undefined) delete process.env.MIT_CONTEXT_PAGES;
    else process.env.MIT_CONTEXT_PAGES = prevCtx;
  });

  it('with MIT_CONTEXT_PAGES>0, a partially-cached batch sends the FULL ordered chapter to MIT (not just the misses)', async () => {
    process.env.MIT_CONTEXT_PAGES = '3';
    const { orch, cache } = makeOrchestrator();
    cache.get.mockImplementation(async (key: string) => partialCache(key));
    const runSpy = stubStream(orch);
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob('ch1', PAGES, listener, undefined, 'th');

    expect(runSpy).toHaveBeenCalledTimes(1);
    const sent = runSpy.mock.calls[0][1] as Array<{ pageIndex: number }>;
    expect(sent.map((p) => p.pageIndex)).toEqual([0, 1]); // complete context, in order
    // the cached page is NOT pre-served (MIT re-delivers it under full context) → not doubled.
    expect(received.filter((r) => r.pageIndex === 0)).toHaveLength(1);
  });

  it('with context OFF (default), a partially-cached batch still sends ONLY the uncached pages (byte-identical)', async () => {
    delete process.env.MIT_CONTEXT_PAGES;
    const { orch, cache } = makeOrchestrator();
    cache.get.mockImplementation(async (key: string) => partialCache(key));
    const runSpy = stubStream(orch);
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob('ch1', PAGES, listener, undefined, 'th');

    const sent = runSpy.mock.calls[0][1] as Array<{ pageIndex: number }>;
    expect(sent.map((p) => p.pageIndex)).toEqual([1]); // only the miss goes to MIT
    expect(received.map((r) => r.pageIndex)).toContain(0); // cached page pre-served
  });
});

function recorder() {
  const received: Array<{ pageIndex: number; result: any }> = [];
  const listener = (pageIndex: number, result: any) =>
    received.push({ pageIndex, result });
  return { received, listener };
}

describe('MitBatchOrchestrator — listener bookkeeping (#234 S5d)', () => {
  it('drains a latecomer listener even when the job rejects (timeout/abort)', async () => {
    const { orch } = makeOrchestrator();
    // buildJobKey('ch1', undefined, 'th', undefined, 'hd') === 'ch1:ANY:THA:default:hd'
    const jobKey = 'ch1:ANY:THA:default:hd';
    const { job, reject } = seedRunningJob(orch, jobKey);

    const latecomer = jest.fn();
    const attach = orch
      .startOrAttachBatchJob(
        'ch1',
        [{ pageIndex: 0, pageUrl: 'u' }],
        latecomer,
        undefined,
        'th',
      )
      .catch(() => {});

    // Let the attach path run up to `await existing.promise`.
    await Promise.resolve();
    expect(job.listeners.has(latecomer)).toBe(true);

    // The job fails (e.g. the 15-minute timeout fires).
    reject(new Error('[BatchRegistry] job timed out'));
    await attach;

    // The latecomer must be removed despite the rejection — no leak.
    expect(job.listeners.has(latecomer)).toBe(false);
  });
});
