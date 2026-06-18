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
import { MitBatchStream } from './mit-batch-stream';

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
