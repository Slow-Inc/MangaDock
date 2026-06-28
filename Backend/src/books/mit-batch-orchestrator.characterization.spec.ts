/**
 * #294 characterization net — locks the CURRENT behaviour of MitBatchOrchestrator
 * BEFORE the transport/stream split, so the byte-identical extraction can be proven
 * against it. Covers the part with zero prior coverage: the NDJSON stream-read loop
 * (`_runMitBatch`, ~607-939) driven through `startOrAttachBatchJob`, plus the webhook
 * lifecycle and the deliberate landmines (dead-worker guard, malformed-line skip,
 * persist-fail-as-error). Must stay green identically through every refactor commit.
 *
 * page-source is mocked so the loop never hits the network — `loadPageBytes` for an
 * external URL does a real fetch otherwise.
 */
jest.mock('./page-source', () => ({
  loadPageBytes: jest.fn().mockResolvedValue(Buffer.from('img-bytes')),
}));

import { Logger } from '@nestjs/common';
import { MitBatchOrchestrator } from './mit-batch-orchestrator.service';

// ── Fixtures ────────────────────────────────────────────────────────────────
function makeOrchestrator() {
  const mitClient = {
    baseUrl: 'http://mit',
    ready: jest.fn(),
    submitBatch: jest.fn(),
    submitSinglePage: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
  };
  const cache = {
    get: jest.fn().mockResolvedValue(null), // nothing cached → everything goes to MIT
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

/** A fake MIT Response whose body streams the given chunks as UTF-8 bytes. Each
 *  array element is enqueued as a SEPARATE chunk so tests control line boundaries. */
function ndjsonResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return {
    status: 200,
    ok: true,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-type' ? 'application/x-ndjson' : null,
    },
    body,
    json: async () => ({}),
    text: async () => '',
  } as unknown as Response;
}

/** A 202-accepted async response — MIT took the job, results arrive via webhook. */
function acceptedResponse(): Response {
  return {
    status: 202,
    ok: true,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    body: null,
    json: async () => ({ status: 'accepted' }),
    text: async () => '',
  } as unknown as Response;
}

const pageLine = (i: number, patches: any[] = []) =>
  JSON.stringify({
    pageIndex: i,
    imgWidth: 100,
    imgHeight: 200,
    patches,
    error: null,
  });
const errorLine = (i: number, error: string) =>
  JSON.stringify({
    pageIndex: i,
    imgWidth: 0,
    imgHeight: 0,
    patches: [],
    error,
  });
const DONE = JSON.stringify({ done: true });

const flush = () => new Promise((r) => setImmediate(r));

function recorder() {
  const received: Array<{ pageIndex: number; result: any }> = [];
  const listener = (pageIndex: number, result: any) =>
    received.push({ pageIndex, result });
  return { received, listener };
}

// jobKey for ('ch1', src=undefined→ANY, tgt='th'→THA, model default, hd)
const JOB_KEY = 'ch1:ANY:THA:default:hd';
const TWO_PAGES = [
  { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
  { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
];

describe('MitBatchOrchestrator characterization (#294) — NDJSON stream path', () => {
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    // Silence + observe the deliberate-landmine warnings.
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('streams a clean 2-page batch: delivers both, resolves, cleans the registry', async () => {
    const { orch, mitClient, deps } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([pageLine(0) + '\n' + pageLine(1) + '\n' + DONE + '\n']),
    );
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    expect(deps.persistPage).toHaveBeenCalledTimes(2);
    expect((orch as any).activeBatchJobs.size).toBe(0); // finalize ran
  });

  it('reassembles a page JSON split across two stream chunks (carry)', async () => {
    const { orch, mitClient } = makeOrchestrator();
    const p0 = pageLine(0);
    const splitAt = 30;
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([
        p0.slice(0, splitAt), // first chunk: partial line, no newline
        p0.slice(splitAt) + '\n' + pageLine(1) + '\n' + DONE + '\n',
      ]),
    );
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
  });

  it('skips empty keep-alive lines and tolerates a trailing partial before done', async () => {
    const { orch, mitClient } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([
        '\n',
        pageLine(0) + '\n',
        '\n',
        pageLine(1) + '\n',
        DONE + '\n',
      ]),
    );
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
  });

  it('logs and skips a malformed JSON line, still processes valid pages (landmine ~897)', async () => {
    const { orch, mitClient } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([
        'this is not json\n' +
          pageLine(0) +
          '\n' +
          pageLine(1) +
          '\n' +
          DONE +
          '\n',
      ]),
    );
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('NDJSON parse failed'),
    );
  });

  it('skips a line with a non-numeric pageIndex without counting it', async () => {
    const { orch, mitClient, deps } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([
        JSON.stringify({ pageIndex: null, patches: [] }) +
          '\n' +
          pageLine(0) +
          '\n' +
          pageLine(1) +
          '\n' +
          DONE +
          '\n',
      ]),
    );
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    expect(deps.persistPage).toHaveBeenCalledTimes(2); // the null-pageIndex line did not persist
  });

  it('delivers a stream error event as an error page result', async () => {
    const { orch, mitClient } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([
        errorLine(0, 'boom') + '\n' + pageLine(1) + '\n' + DONE + '\n',
      ]),
    );
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    const p0 = received.find((r) => r.pageIndex === 0);
    expect(p0?.result.error).toBe('boom');
    expect(p0?.result.patches).toEqual([]);
  });

  it('all-error batch still resolves and warns — dead-worker guard (2026-06-06 incident)', async () => {
    const { orch, mitClient } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([
        errorLine(0, 'dead') + '\n' + errorLine(1, 'dead') + '\n' + DONE + '\n',
      ]),
    );
    const { received, listener } = recorder();

    // Must not hang: an all-error batch resolves (it does not read as "fully completed").
    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(received).toHaveLength(2);
    expect(received.every((r) => r.result.error === 'dead')).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('completed with 2/2 page errors'),
    );
  });

  it('retries pages the stream dropped via translateSinglePage', async () => {
    const { orch, mitClient, deps } = makeOrchestrator();
    // Stream emits page 0 only, then done — page 1 is "missing".
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([pageLine(0) + '\n' + DONE + '\n']),
    );
    deps.translateSinglePage.mockResolvedValue({ patches: [] });
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(deps.translateSinglePage).toHaveBeenCalledWith(
      'ch1',
      1,
      'http://example.com/1.jpg',
      undefined,
      'th',
      expect.objectContaining({ maxStartupRetries: 3 }),
    );
    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
  });

  it('falls back to per-page retry when the MIT submit throws', async () => {
    const { orch, mitClient, deps } = makeOrchestrator();
    mitClient.submitBatch.mockRejectedValue(new Error('connection refused'));
    const { received, listener } = recorder();

    await orch.startOrAttachBatchJob(
      'ch1',
      TWO_PAGES,
      listener,
      undefined,
      'th',
    );

    expect(deps.translateSinglePage).toHaveBeenCalledTimes(2);
    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
  });
});

describe('MitBatchOrchestrator characterization (#294) — webhook (202-async) lifecycle', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('202-accepted: no stream persist; completion driven by handleMitCallback; fan-out to original + latecomer', async () => {
    const { orch, mitClient, deps } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(acceptedResponse());

    const a = recorder();
    const original = orch
      .startOrAttachBatchJob('ch1', TWO_PAGES, a.listener, undefined, 'th')
      .catch(() => {});
    await flush(); // job registers, submitBatch returns 202, _runMitBatch returns early

    expect(deps.persistPage).not.toHaveBeenCalled(); // stream not read on the async path

    // A latecomer attaches to the running job and shares delivery.
    const b = recorder();
    const latecomer = orch
      .startOrAttachBatchJob('ch1', TWO_PAGES, b.listener, undefined, 'th')
      .catch(() => {});
    await flush();

    // MIT calls back per page (the webhook path).
    await orch.handleMitCallback(JOB_KEY, 0, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    });
    await orch.handleMitCallback(JOB_KEY, 1, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    });

    await original;
    await latecomer;

    expect(deps.persistPage).toHaveBeenCalledTimes(2);
    expect(a.received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    expect(b.received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    expect((orch as any).activeBatchJobs.size).toBe(0); // finalize drained both
  });

  it('handleMitCallback is idempotent — a duplicate page callback persists once', async () => {
    const { orch, mitClient, deps } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(acceptedResponse());

    const a = recorder();
    const original = orch
      .startOrAttachBatchJob('ch1', TWO_PAGES, a.listener, undefined, 'th')
      .catch(() => {});
    await flush();

    await orch.handleMitCallback(JOB_KEY, 0, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    });
    await orch.handleMitCallback(JOB_KEY, 0, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    }); // duplicate
    await orch.handleMitCallback(JOB_KEY, 1, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    });

    await original;

    expect(deps.persistPage).toHaveBeenCalledTimes(2); // page 0 persisted once, not twice
  });

  it('handleMitCallback surfaces a persistence failure as a page error, never a throw', async () => {
    const { orch, mitClient, deps } = makeOrchestrator();
    mitClient.submitBatch.mockResolvedValue(acceptedResponse());
    deps.persistPage.mockRejectedValueOnce(new Error('disk full'));

    const a = recorder();
    const original = orch
      .startOrAttachBatchJob('ch1', TWO_PAGES, a.listener, undefined, 'th')
      .catch(() => {});
    await flush();

    // Must not throw despite the persist rejection.
    await expect(
      orch.handleMitCallback(JOB_KEY, 0, {
        imgWidth: 100,
        imgHeight: 200,
        patches: [],
      }),
    ).resolves.toBeUndefined();
    await orch.handleMitCallback(JOB_KEY, 1, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    });
    await original;

    const p0 = a.received.find((r) => r.pageIndex === 0);
    expect(p0?.result.error).toContain('persistence failed');
  });
});

describe('MitBatchOrchestrator — FR-8: cached-page replay for latecomers', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('latecomer receives cached pages replayed on attach (regression for FR-8)', async () => {
    const { orch, mitClient, cache } = makeOrchestrator();
    // page 0 cached, page 1 not — so uncachedPages = [page1], job stays open
    const CACHED_PATCHES = [{ x: 0, y: 0, w: 10, h: 10, url: 'p0.png' }];
    cache.get.mockImplementation((key: string) =>
      key.includes(':ch1:0:')
        ? Promise.resolve({ data: { patches: CACHED_PATCHES } })
        : Promise.resolve(null),
    );
    // 202 so the job stays in the registry until handleMitCallback fires
    mitClient.submitBatch.mockResolvedValue(acceptedResponse());

    const a = recorder();
    const original = orch
      .startOrAttachBatchJob('ch1', TWO_PAGES, a.listener, undefined, 'th')
      .catch(() => {});
    await flush(); // cache checked; page 0 → a.listener; stream started (202 returned)

    // original caller receives page 0 immediately from cache
    expect(a.received.find((r) => r.pageIndex === 0)).toBeDefined();

    // Latecomer attaches while page 1 is still in-flight
    const b = recorder();
    const latecomer = orch
      .startOrAttachBatchJob('ch1', TWO_PAGES, b.listener, undefined, 'th')
      .catch(() => {});
    await flush(); // attach path replays existing.completedPages

    // FR-8: latecomer MUST receive cached page 0 via completedPages replay
    expect(b.received.find((r) => r.pageIndex === 0)).toBeDefined();
    // page 1 not yet done — webhook hasn't fired
    expect(b.received.find((r) => r.pageIndex === 1)).toBeUndefined();

    // MIT delivers page 1 via webhook — both listeners receive it
    await orch.handleMitCallback(JOB_KEY, 1, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    });

    await original;
    await latecomer;

    expect(a.received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    expect(b.received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    expect((orch as any).activeBatchJobs.size).toBe(0);
  });

  it('expectedCount alignment: job does not resolve prematurely when cached pages fill completedPages early', async () => {
    // Guards the partial-fix regression: adding cached pages to completedPages but
    // leaving expectedCount = uncachedPages.length (old line 469) would make
    // maybeComplete fire too early — the cached entries alone could satisfy it.
    // With the full fix, expectedCount stays at pages.length so maybeComplete fires
    // only when cached + all streamed/webhook pages are present.
    const { orch, mitClient, cache } = makeOrchestrator();
    // 3 pages: 0 and 2 cached, 1 not — uncachedPages.length = 1; pages.length = 3
    const CACHED_PATCHES = [{ x: 1, y: 1, w: 5, h: 5, url: 'p.png' }];
    const THREE_PAGES = [
      { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
      { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
      { pageIndex: 2, pageUrl: 'http://example.com/2.jpg' },
    ];
    cache.get.mockImplementation((key: string) =>
      key.includes(':ch1:0:') || key.includes(':ch1:2:')
        ? Promise.resolve({ data: { patches: CACHED_PATCHES } })
        : Promise.resolve(null),
    );
    mitClient.submitBatch.mockResolvedValue(acceptedResponse());

    const a = recorder();
    const original = orch
      .startOrAttachBatchJob('ch1', THREE_PAGES, a.listener, undefined, 'th')
      .catch(() => {});
    await flush(); // pages 0 and 2 served from cache; page 1 in-flight

    // pages 0 and 2 delivered immediately; page 1 still pending
    expect(a.received.find((r) => r.pageIndex === 0)).toBeDefined();
    expect(a.received.find((r) => r.pageIndex === 2)).toBeDefined();
    expect(a.received.find((r) => r.pageIndex === 1)).toBeUndefined();
    // job must NOT have resolved yet (page 1 still in-flight)
    expect((orch as any).activeBatchJobs.size).toBe(1);

    // MIT delivers page 1 via webhook — job should NOW resolve
    await orch.handleMitCallback(JOB_KEY, 1, {
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
    });

    await original;

    expect(a.received.map((r) => r.pageIndex).sort()).toEqual([0, 1, 2]);
    expect((orch as any).activeBatchJobs.size).toBe(0);
  });
});
