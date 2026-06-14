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
