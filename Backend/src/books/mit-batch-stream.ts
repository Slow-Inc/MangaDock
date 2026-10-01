import { Logger } from '@nestjs/common';
import { MitClient } from './mit-client';
import { loadPageBytes } from './page-source';
import { parseNdjsonChunk } from './mit-batch-ndjson';
import { type MitBatchDeps, type PageResult } from './mit-batch-types';
import { patchCacheKey, buildMitConfig, imageModelKey } from './mit-config';

/**
 * Race a single stream `read()` against a `timeoutMs` deadline, ALWAYS clearing
 * the loser timer in a `finally` so a fast read (the common case, every chunk)
 * does not leave a dangling ~90s timer pending. Those accumulated across a long
 * NDJSON stream and delayed event-loop settling / process exit (#544).
 */
export async function readWithTimeout<T>(
  read: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`MIT stream read timeout after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * MIT batch transport + NDJSON stream driver (#294).
 *
 * Carved out of MitBatchOrchestrator so the HTTP-to-MIT submit and the stream
 * read loop — the riskiest, most deeply nested part of the batch path — own a
 * single file with one responsibility. It fetches the source images, builds the
 * multipart form, POSTs to MIT, and consumes the NDJSON stream (via the pure
 * `parseNdjsonChunk` decoder), persisting each page through the injected
 * `deps.persistPage` and recovering dropped pages individually.
 *
 * It knows NOTHING about jobs, listeners, or the registry: it reports every page
 * through the `notify` callback the orchestrator passes in, which is where job
 * state (completedPages / fan-out) is mutated. Persistence and the single-page
 * fallback are injected (`deps`), keeping the dependency one-way
 * (BooksService → MitBatchOrchestrator → MitBatchStream). Behaviour is
 * byte-identical to the inline `_runMitBatch` it replaces.
 */
export class MitBatchStream {
  private readonly logger = new Logger(MitBatchStream.name);

  constructor(
    private readonly mitClient: MitClient,
    private readonly deps: MitBatchDeps,
  ) {}

  /** Origin used specifically for MIT webhook callbacks.
   *  When MIT runs on the same machine as the backend, use localhost
   *  instead of the public URL to avoid going through Cloudflare Tunnel. */
  private get mitCallbackOrigin(): string {
    return (
      process.env.MIT_CALLBACK_ORIGIN ??
      process.env.BACKEND_PUBLIC_ORIGIN ??
      `http://localhost:${process.env.PORT ?? 3001}`
    );
  }

  /**
   * Fetch images, POST to MIT batch endpoint, stream & cache results.
   * Calls `notify` for each page as it completes.
   */
  async run(
    chapterId: string,
    pages: Array<{ pageIndex: number; pageUrl: string }>,
    notify: (pageIndex: number, result: PageResult) => void,
    signal: AbortSignal,
    srcMIT: string,
    tgtMIT: string,
    taskId: string,
    sourceLangIso?: string,
    targetLangIso?: string,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
    mangaId?: string,
  ): Promise<void> {
    // ── 1. Fetch all source images in parallel ─────────────────────────────
    let imageBuffers: Buffer[];
    try {
      imageBuffers = await Promise.all(
        // Display-derivative aware (#156): /img-cache paths read from disk,
        // external URLs fetched (cancellable via the job signal).
        pages.map(({ pageUrl }) =>
          loadPageBytes(pageUrl, {
            imgCacheRoot: 'img-cache',
            uploadsRoot: 'uploads',
            signal,
          }),
        ),
      );
    } catch (err) {
      if (signal.aborted) {
        this.logger.log(
          `[BatchPatches] chapter=${chapterId} cancelled during image fetch`,
        );
        return;
      }
      throw err;
    }

    // ── 2. Build multipart form ───────────────────────────────────────────
    const mitConfig = buildMitConfig(
      process.env,
      srcMIT,
      tgtMIT,
      sourceLangIso ?? '',
      imageModel,
      await this.deps.seriesContextFor(mangaId),
    );

    const form = new FormData();
    for (const buf of imageBuffers) {
      form.append(
        'images',
        new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }),
        'page.jpg',
      );
    }
    form.append('config', mitConfig);
    form.append('page_indices', pages.map((p) => p.pageIndex).join(','));

    // T4-STANDARD Pillar 2: Asynchronous Fire-and-forget preparation
    // Pass taskId and callbackUrl to MIT Server
    form.append('taskId', taskId);
    form.append(
      'callback_url',
      `${this.mitCallbackOrigin}/webhooks/mit/callback`,
    );
    if (process.env.MIT_WEBHOOK_SECRET) {
      form.append('callback_secret', process.env.MIT_WEBHOOK_SECRET);
    }

    // ── 3. POST to MIT ────────────────────────────────────────────────────────
    // Do NOT pass the cancel signal here — once MIT accepts the job it processes
    // asynchronously and sends webhook callbacks even if the SSE caller disconnects.
    // Passing the signal would kill the TCP connection to MIT mid-POST, causing
    // MIT's BLAS/Fortran runtime to crash (forrtl error 200: window-CLOSE event).
    if (signal.aborted) {
      this.logger.log(
        `[BatchPatches] chapter=${chapterId} cancelled before MIT submit`,
      );
      return;
    }
    let mitRes: Response;
    try {
      mitRes = await this.mitClient.submitBatch(form);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[BatchPatches] chapter=${chapterId} MIT batch fetch failed: ${msg}`,
      );
      await this._retryMissingPagesIndividually(
        chapterId,
        pages,
        new Set<number>(),
        notify,
        sourceLangIso,
        targetLangIso,
        imageModel,
        signal,
        derivative,
        mangaId,
      );
      return;
    }

    // Handle Async Acceptance (202 Accepted)
    if (mitRes.status === 202 || mitRes.status === 200) {
      const contentType = mitRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await mitRes.json().catch(() => ({}));
        if (body.status === 'accepted') {
          this.logger.log(
            `[BatchPatches] chapter=${chapterId} MIT accepted job async with taskId=${taskId}`,
          );
          return; // The webhook will handle the rest of the results
        }
      }
    }

    if (!mitRes.ok || !mitRes.body) {
      const errText = await mitRes.text().catch(() => '');
      this.logger.warn(
        `[BatchPatches] chapter=${chapterId} MIT HTTP ${mitRes.status}: ${errText.slice(0, 200)}`,
      );
      await this._retryMissingPagesIndividually(
        chapterId,
        pages,
        new Set<number>(),
        notify,
        sourceLangIso,
        targetLangIso,
        imageModel,
        signal,
        derivative,
        mangaId,
      );
      return;
    }

    // ── 4. Read NDJSON stream, save patches, cache, notify ────────────────
    const reader = (
      mitRes.body as unknown as ReadableStream<Uint8Array>
    ).getReader();
    const decoder = new TextDecoder();
    let carry = '';
    let receivedCount = 0;
    const expectedCount = pages.length;
    const processedPageIndexes = new Set<number>();
    const pageUrlByIndex = new Map(pages.map((p) => [p.pageIndex, p.pageUrl]));

    const streamReadTimeoutMs = Math.max(
      30_000,
      Number(process.env.MIT_BATCH_STREAM_READ_TIMEOUT_MS ?? 90_000),
    );
    let streamFailedError: string | null = null;

    try {
      outer: while (true) {
        const { done, value } = await readWithTimeout(
          () => reader.read(),
          streamReadTimeoutMs,
        );
        if (done) break;
        const { events, carry: nextCarry } = parseNdjsonChunk(
          decoder.decode(value, { stream: true }),
          carry,
        );
        carry = nextCarry;

        for (const ev of events) {
          // Sentinel: MIT signals it has finished all pages
          if (ev.type === 'done') break outer;

          // A line that failed JSON.parse — logged + skipped, identical to the
          // original inline catch (this is the only path that reaches here
          // without entering the per-page try below).
          if (ev.type === 'malformed') {
            this.logger.warn(
              `[BatchPatches] NDJSON parse failed: ${ev.line.slice(0, 120)}`,
            );
            continue;
          }

          // The per-page try wraps persist + notify so ANY throw (including a
          // missing `patches` array) surfaces as "NDJSON parse failed" and the
          // page stays uncounted → retried as missing, exactly as before.
          try {
            if (ev.type === 'error') {
              this.logger.warn(
                `[BatchPatches] chapter=${chapterId} page=${ev.pageIndex} error: ${ev.error}`,
              );
              notify(ev.pageIndex, { patches: [], error: ev.error });
              if (!processedPageIndexes.has(ev.pageIndex)) {
                processedPageIndexes.add(ev.pageIndex);
                receivedCount++;
                if (receivedCount >= expectedCount) break outer;
              }
              continue;
            }

            const imgW = ev.imgWidth;
            const imgH = ev.imgHeight;
            // Cache so single-page endpoint & future batch requests skip MIT
            const cacheKey = patchCacheKey(
              process.env,
              chapterId,
              ev.pageIndex,
              srcMIT,
              tgtMIT,
              imageModel,
              derivative,
            );
            // #232: shared per-page persist — PatchStore write + percent-map + tiered
            // cache. recoverIfEmpty runs the source_lang_only fallback BEFORE the
            // single cache write, so an empty first pass never caches stale-empty.
            const patches = await this.deps.persistPage({
              chapterId,
              pageIndex: ev.pageIndex,
              srcMIT,
              tgtMIT,
              storeModel: imageModelKey(imageModel),
              cacheKey,
              cacheStrategy: 'tiered',
              rects: ev.patches,
              buffers: ev.patches.map((p) => Buffer.from(p.img_b64, 'base64')),
              imgW,
              imgH,
              recoverIfEmpty:
                srcMIT === 'ANY'
                  ? undefined
                  : async () => {
                      const pageUrl = pageUrlByIndex.get(ev.pageIndex);
                      if (!pageUrl) return [];
                      try {
                        const fallback = await this.deps.translateSinglePage(
                          chapterId,
                          ev.pageIndex,
                          pageUrl,
                          undefined,
                          targetLangIso,
                          { imageModel },
                        );
                        if (fallback.patches.length > 0) {
                          this.logger.log(
                            `[BatchPatches] chapter=${chapterId} page=${ev.pageIndex} source_lang_only fallback recovered ${fallback.patches.length} patches`,
                          );
                          return fallback.patches;
                        }
                      } catch (fallbackErr) {
                        this.logger.warn(
                          `[BatchPatches] chapter=${chapterId} page=${ev.pageIndex} fallback(no source filter) failed: ${String(fallbackErr)}`,
                        );
                      }
                      return [];
                    },
            });

            this.logger.log(
              `[BatchPatches] chapter=${chapterId} page=${ev.pageIndex} → ${patches.length} patches`,
            );
            notify(ev.pageIndex, { patches });

            if (!processedPageIndexes.has(ev.pageIndex)) {
              processedPageIndexes.add(ev.pageIndex);
              receivedCount++;
              if (receivedCount >= expectedCount) break outer;
            }
          } catch {
            this.logger.warn(
              `[BatchPatches] NDJSON parse failed: ${ev.line.slice(0, 120)}`,
            );
          }
        }
      }
    } catch (err) {
      if (signal.aborted) {
        this.logger.log(
          `[BatchPatches] chapter=${chapterId} cancelled by user after ${processedPageIndexes.size}/${pages.length} pages — cache retained`,
        );
        reader.cancel().catch(() => {});
        return; // skip retry — user explicitly stopped
      }
      streamFailedError = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[BatchPatches] chapter=${chapterId} stream interrupted: ${streamFailedError}`,
      );
    }

    // Release reader to free underlying TCP resources
    reader.cancel().catch(() => {});

    // ── 6. Auto-recover missing pages (if stream dropped/skipped randomly) ──
    if (streamFailedError) {
      this.logger.warn(
        `[BatchPatches] chapter=${chapterId} continuing with per-page fallback after stream failure`,
      );
    }
    await this._retryMissingPagesIndividually(
      chapterId,
      pages,
      processedPageIndexes,
      notify,
      sourceLangIso,
      targetLangIso,
      imageModel,
      signal,
      derivative,
      mangaId,
    );
  }

  private async _retryMissingPagesIndividually(
    chapterId: string,
    pages: Array<{ pageIndex: number; pageUrl: string }>,
    processedPageIndexes: Set<number>,
    notify: (pageIndex: number, result: PageResult) => void,
    sourceLangIso?: string,
    targetLangIso?: string,
    imageModel?: string,
    signal?: AbortSignal,
    derivative: 'hd' | 'saver' = 'hd',
    mangaId?: string,
  ): Promise<void> {
    const missingPages = pages.filter(
      (p) => !processedPageIndexes.has(p.pageIndex),
    );
    if (missingPages.length > 0) {
      this.logger.warn(
        `[BatchPatches] chapter=${chapterId} missing ${missingPages.length} pages; retrying individually`,
      );
    }

    let recovered = 0;
    let failed = 0;

    // Bounded worker pool (FR-20): recover missing pages a few at a time instead
    // of one serial `for await`. Workers share a cursor into `missingPages`; each
    // re-checks `signal?.aborted` before pulling the next page, so an abort
    // mid-recovery stops the whole pool from issuing further MIT calls (not just
    // the next serial iteration). JS is single-threaded, so `cursor++` and the
    // recovered/failed counters need no locking.
    const POOL_SIZE = 4;
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < missingPages.length) {
        if (signal?.aborted) return;
        const missing = missingPages[cursor++];
        try {
          const single = await this.deps.translateSinglePage(
            chapterId,
            missing.pageIndex,
            missing.pageUrl,
            sourceLangIso,
            targetLangIso,
            { maxStartupRetries: 3, imageModel, derivative, mangaId },
          );
          notify(missing.pageIndex, { patches: single.patches });
          recovered += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `[BatchPatches] fallback failed chapter=${chapterId} page=${missing.pageIndex}: ${msg}`,
          );
          notify(missing.pageIndex, { patches: [], error: msg });
          failed += 1;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(POOL_SIZE, missingPages.length) }, () =>
        worker(),
      ),
    );

    if (missingPages.length > 0) {
      this.logger.log(
        `[BatchPatches] chapter=${chapterId} fallback summary: expected=${pages.length}, streamed=${pages.length - missingPages.length}, recovered=${recovered}, failed=${failed}`,
      );
    }
  }
}
