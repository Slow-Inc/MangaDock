/**
 * #294 — MitBatchStream in isolation. Constructed directly with a fake MitClient
 * and fake deps: no Nest runtime, no orchestrator, no BooksService. Proves the
 * transport/stream unit owns its behaviour (submit → NDJSON read → persist →
 * retry) independently of the job-state machine.
 *
 * page-source is mocked so run() never hits the network.
 */
jest.mock('./page-source', () => ({
  loadPageBytes: jest.fn().mockResolvedValue(Buffer.from('img-bytes')),
}));

import { Logger } from '@nestjs/common';
import { MitBatchStream, readWithTimeout } from './mit-batch-stream';

function makeStream() {
  const mitClient = {
    baseUrl: 'http://mit',
    ready: jest.fn(),
    submitBatch: jest.fn(),
    submitSinglePage: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
  };
  const deps = {
    persistPage: jest.fn().mockResolvedValue([]),
    seriesContextFor: jest.fn().mockResolvedValue(undefined),
    translateSinglePage: jest.fn().mockResolvedValue({ patches: [] }),
  };
  const stream = new MitBatchStream(mitClient as any, deps as any);
  return { stream, mitClient, deps };
}

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
const DONE = JSON.stringify({ done: true });

function recorder() {
  const received: Array<{ pageIndex: number; result: any }> = [];
  const notify = (pageIndex: number, result: any) =>
    received.push({ pageIndex, result });
  return { received, notify };
}

const TWO_PAGES = [
  { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
  { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
];

describe('MitBatchStream.run (#294)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('streams pages: persists each and notifies the caller', async () => {
    const { stream, mitClient, deps } = makeStream();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([pageLine(0) + '\n' + pageLine(1) + '\n' + DONE + '\n']),
    );
    const { received, notify } = recorder();

    await stream.run(
      'ch1',
      TWO_PAGES,
      notify,
      new AbortController().signal,
      'ANY',
      'THA',
      'ch1:ANY:THA:default:hd',
    );

    expect(deps.persistPage).toHaveBeenCalledTimes(2);
    expect(received.map((r) => r.pageIndex).sort()).toEqual([0, 1]);
    // Pin the cacheKey so a transposed srcMIT/tgtMIT (both string — invisible to
    // tsc) can't silently split the cache from the single-page endpoint.
    expect(deps.persistPage).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheKey: expect.stringContaining('ch1:0:ANY:THA:default:hd'),
      }),
    );
  });

  it('202-accepted async: does not persist (webhook delivers later)', async () => {
    const { stream, mitClient, deps } = makeStream();
    mitClient.submitBatch.mockResolvedValue(acceptedResponse());
    const { notify } = recorder();

    await stream.run(
      'ch1',
      TWO_PAGES,
      notify,
      new AbortController().signal,
      'ANY',
      'THA',
      'ch1:ANY:THA:default:hd',
    );

    expect(deps.persistPage).not.toHaveBeenCalled();
  });

  it('falls back to per-page translate when the MIT submit throws', async () => {
    const { stream, mitClient, deps } = makeStream();
    mitClient.submitBatch.mockRejectedValue(new Error('connection refused'));
    const { notify } = recorder();

    await stream.run(
      'ch1',
      TWO_PAGES,
      notify,
      new AbortController().signal,
      'ANY',
      'THA',
      'ch1:ANY:THA:default:hd',
    );

    expect(deps.translateSinglePage).toHaveBeenCalledTimes(2);
  });

  it('retries pages the stream dropped', async () => {
    const { stream, mitClient, deps } = makeStream();
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([pageLine(0) + '\n' + DONE + '\n']),
    );
    const { notify } = recorder();

    await stream.run(
      'ch1',
      TWO_PAGES,
      notify,
      new AbortController().signal,
      'ANY',
      'THA',
      'ch1:ANY:THA:default:hd',
      undefined, // sourceLangIso
      'THA', // targetLangIso
    );

    expect(deps.translateSinglePage).toHaveBeenCalledWith(
      'ch1',
      1,
      'http://example.com/1.jpg',
      undefined,
      'THA',
      expect.objectContaining({ maxStartupRetries: 3 }),
    );
  });
});

describe('MitBatchStream.run — abort signal threaded into auto-recover (FR-7)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('stops the auto-recover retry loop when signal aborts mid-retry (call site 3)', async () => {
    const { stream, mitClient, deps } = makeStream();
    const controller = new AbortController();

    const THREE_PAGES = [
      { pageIndex: 0, pageUrl: 'http://example.com/0.jpg' },
      { pageIndex: 1, pageUrl: 'http://example.com/1.jpg' },
      { pageIndex: 2, pageUrl: 'http://example.com/2.jpg' },
    ];

    // Stream delivers only page 0; pages 1 and 2 are "missing" → auto-recover fires
    mitClient.submitBatch.mockResolvedValue(
      ndjsonResponse([pageLine(0) + '\n' + DONE + '\n']),
    );

    // On the first per-page retry call, abort the controller — simulates the SSE
    // reader disconnecting while recovery is in progress.
    deps.translateSinglePage.mockImplementationOnce(async () => {
      controller.abort();
      return { patches: [] };
    });

    const { notify } = recorder();
    await stream.run(
      'ch1',
      THREE_PAGES,
      notify,
      controller.signal,
      'ANY',
      'THA',
      'taskId-fr7',
    );

    // With signal threaded: loop guard fires after 1st call → only called once.
    // Without fix (signal was undefined): guard never fires → called twice.
    expect(deps.translateSinglePage).toHaveBeenCalledTimes(1);
  });
});

describe('MitBatchStream._retryMissingPagesIndividually (#82, relocated from #294)', () => {
  it('stops retrying when the AbortSignal is already aborted', async () => {
    const { stream, deps } = makeStream();
    const controller = new AbortController();
    controller.abort();

    await (stream as any)._retryMissingPagesIndividually(
      'ch1',
      TWO_PAGES,
      new Set<number>(),
      jest.fn(),
      undefined,
      undefined,
      undefined,
      controller.signal,
    );

    expect(deps.translateSinglePage).not.toHaveBeenCalled();
  });

  it('runs recovery with bounded concurrency (pool > 1), not one page at a time (FR-20)', async () => {
    const { stream, deps } = makeStream();

    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<() => void> = [];
    deps.translateSinglePage.mockImplementation(
      () =>
        new Promise((resolve) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          releases.push(() => {
            inFlight -= 1;
            resolve({ patches: [] });
          });
        }),
    );

    const SIX = Array.from({ length: 6 }, (_, i) => ({
      pageIndex: i,
      pageUrl: `http://example.com/${i}.jpg`,
    }));

    const done = (stream as any)._retryMissingPagesIndividually(
      'ch',
      SIX,
      new Set<number>(),
      jest.fn(),
    );

    // Let the pool spin up all its workers.
    await new Promise((r) => setImmediate(r));

    // Serial loop would keep exactly 1 retry in flight; the pool keeps 4.
    expect(maxInFlight).toBe(4);
    expect(deps.translateSinglePage).toHaveBeenCalledTimes(4);

    // Drain: releasing each wave lets the pool pull the remaining pages.
    for (let round = 0; round < 4 && releases.length > 0; round++) {
      releases.splice(0).forEach((r) => r());
      await new Promise((r) => setImmediate(r));
    }
    await done;
    expect(deps.translateSinglePage).toHaveBeenCalledTimes(6);
  });

  it('stops issuing new pool work once the signal aborts mid-recovery (FR-20 preserves FR-7)', async () => {
    const { stream, deps } = makeStream();
    const controller = new AbortController();

    let calls = 0;
    deps.translateSinglePage.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) controller.abort(); // abort during the first wave
      return { patches: [] };
    });

    const EIGHT = Array.from({ length: 8 }, (_, i) => ({
      pageIndex: i,
      pageUrl: `http://example.com/${i}.jpg`,
    }));

    await (stream as any)._retryMissingPagesIndividually(
      'ch',
      EIGHT,
      new Set<number>(),
      jest.fn(),
      undefined,
      undefined,
      undefined,
      controller.signal,
    );

    // Pool must check the signal before starting each unit: no new MIT calls
    // are issued after the abort, so far fewer than all 8 pages are attempted.
    expect(calls).toBeLessThanOrEqual(4);
    expect(calls).toBeLessThan(8);
  });

  it('passes maxStartupRetries:3 to translateSinglePage in the fallback path', async () => {
    const { stream, deps } = makeStream();

    await (stream as any)._retryMissingPagesIndividually(
      'ch2',
      [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }],
      new Set<number>(),
      jest.fn(),
    );

    expect(deps.translateSinglePage).toHaveBeenCalledWith(
      'ch2',
      0,
      'http://example.com/0.jpg',
      undefined,
      undefined,
      {
        maxStartupRetries: 3,
        imageModel: undefined,
        derivative: 'hd',
        mangaId: undefined,
      },
    );
  });
});

describe('readWithTimeout (#544) — no dangling race-loser timer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('clears the timeout timer when the read wins (resolve-first)', async () => {
    const result = await readWithTimeout(
      () => Promise.resolve('chunk'),
      90_000,
    );

    expect(result).toBe('chunk');
    // The loser (timeout) timer must be cleared — none left pending. Before the
    // fix every fast read leaked a ~90s timer that accumulated across the stream.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects and clears the timer when the timeout wins (timeout-first)', async () => {
    const neverResolves = new Promise<never>(() => {});
    const raced = readWithTimeout(() => neverResolves, 90_000);
    const assertion = expect(raced).rejects.toThrow(
      'MIT stream read timeout after 90000ms',
    );

    await jest.advanceTimersByTimeAsync(90_000);
    await assertion;

    expect(jest.getTimerCount()).toBe(0);
  });
});
