import { Logger } from '@nestjs/common';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { MitClient } from './mit-client';
import { type TextLayerRegion } from './translation-memory.repository';
import { loadPageBytes } from './page-source';
import {
  mitLangPair,
  buildJobKey,
  patchCacheKey,
  buildMitConfig,
  imageModelKey,
  parseJobKey,
} from './mit-config';

type PatchEntry = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  url: string;
};
type PageResult = { patches: PatchEntry[]; error?: string };
export type BatchPageListener = (pageIndex: number, result: PageResult) => void;

interface BatchJobState {
  /** Pages that have already been processed (cached + saved) */
  completedPages: Map<number, PageResult>;
  /** Pages currently being processed — prevents duplicate concurrent webhooks */
  processingPages: Set<number>;
  /** Active SSE listeners — removed on client disconnect */
  listeners: Set<BatchPageListener>;
  /** Direct reference to the original SSE caller — guaranteed direct delivery */
  originalListener?: BatchPageListener;
  /** Total active callers (original caller + latecomer listeners). Used for the
   *  abort decision so the count is correct regardless of delivery path. */
  activeCallerCount: number;
  /** Resolves when ALL pages in the batch are done (or MIT closes) */
  promise: Promise<void>;
  /** Abort this to stop MIT processing when the last listener disconnects */
  cancelController: AbortController;
  /** Resolver for the promise */
  resolve?: () => void;
  /** Rejecter for the promise */
  reject?: (err: any) => void;
  /** Number of pages we are waiting for */
  expectedCount: number;
}

/**
 * Collaborators BooksService injects so the batch path can persist a page,
 * resolve series context, and fall back to the single-page translate without
 * owning PatchStore / TranslationMemory / MangaDex / MitTranslationService.
 * These stay in BooksService (shared with the single-page path), so the
 * dependency stays one-way (BooksService → MitBatchOrchestrator).
 */
export interface MitBatchDeps {
  persistPage: (p: {
    chapterId: string;
    pageIndex: number;
    srcMIT: string;
    tgtMIT: string;
    storeModel?: string;
    cacheKey: string;
    cacheStrategy: 'plain7d' | 'tiered';
    rects: Array<{ x: number; y: number; w: number; h: number }>;
    buffers: Buffer[];
    imgW: number;
    imgH: number;
    regions?: TextLayerRegion[];
    tmModel?: string;
    recoverIfEmpty?: () => Promise<PatchEntry[]>;
  }) => Promise<PatchEntry[]>;
  seriesContextFor: (mangaId?: string) => Promise<string | undefined>;
  translateSinglePage: (
    chapterId: string,
    pageIndex: number,
    pageUrl: string,
    sourceLang?: string,
    targetLang?: string,
    opts?: {
      maxStartupRetries?: number;
      imageModel?: string;
      derivative?: 'hd' | 'saver';
      mangaId?: string;
    },
  ) => Promise<{ patches: PatchEntry[] }>;
}

/**
 * The MIT batch (full-chapter) translation state machine, carved out of
 * BooksService (#234). Owns the job registry plus start/attach, stream-run,
 * per-page retry, webhook callback, listener-remove, and progress-notify. Depends
 * on MitClient (#230), the pure #229 helpers, and BooksService's shared
 * persist/series-context/single-page translate via injection — so with MitClient
 * faked the whole batch lifecycle is unit-testable. Behaviour is byte-identical to
 * the inline version it replaces.
 */
export class MitBatchOrchestrator {
  private readonly logger = new Logger(MitBatchOrchestrator.name);

  /** Active background batch-translate jobs keyed by "chapterId:srcMIT:tgtMIT" */
  private readonly activeBatchJobs = new Map<string, BatchJobState>();

  constructor(
    private readonly mitClient: MitClient,
    private readonly cache: CacheOrchestratorService,
    private readonly deps: MitBatchDeps,
  ) {}

  // ─── #229 pure-helper delegators (env-bound; single source of truth in mit-config) ───
  private mitLangPair(
    sourceLang?: string,
    targetLang?: string,
  ): { srcMIT: string; tgtMIT: string } {
    return mitLangPair(process.env, sourceLang, targetLang);
  }
  private imageModelKey(imageModel?: string): string | undefined {
    return imageModelKey(imageModel);
  }
  private patchCacheKey(
    chapterId: string,
    pageIndex: number,
    srcMIT: string,
    tgtMIT: string,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
  ): string {
    return patchCacheKey(
      process.env,
      chapterId,
      pageIndex,
      srcMIT,
      tgtMIT,
      imageModel,
      derivative,
    );
  }
  private buildJobKey(
    chapterId: string,
    sourceLang?: string,
    targetLang?: string,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
  ): string {
    return buildJobKey(
      process.env,
      chapterId,
      sourceLang,
      targetLang,
      imageModel,
      derivative,
    );
  }
  private buildMitConfig(
    srcMIT: string,
    tgtMIT: string,
    sourceIso: string,
    imageModel?: string,
    seriesContext?: string,
  ): string {
    return buildMitConfig(
      process.env,
      srcMIT,
      tgtMIT,
      sourceIso,
      imageModel,
      seriesContext,
    );
  }

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
   * Forward a live MIT stage update to everyone watching this Batch Job.
   * Informational only (UX): never recorded in completedPages, never resolves
   * the job — a lost progress event costs nothing.
   */
  notifyBatchProgress(jobKey: string, pageIndex: number, stage: string): void {
    const job = this.activeBatchJobs.get(jobKey);
    if (!job) return;
    const event = { patches: [], stage, progress: true } as PageResult & {
      stage: string;
      progress: true;
    };
    this.deliver(job, pageIndex, event);
  }

  /** The single fan-out sink (#234): deliver one page result to the original SSE
   *  caller and every attached latecomer. Each listener is isolated — one that
   *  disconnected and throws never blocks the rest. Callers that record completion
   *  set job.completedPages before calling; the progress path does not. */
  private deliver(
    job: BatchJobState,
    pageIndex: number,
    result: PageResult,
  ): void {
    try {
      job.originalListener?.(pageIndex, result);
    } catch {
      /* caller may be gone */
    }
    for (const l of job.listeners) {
      try {
        l(pageIndex, result);
      } catch {
        /* listener may be gone */
      }
    }
  }

  /** The single terminal-state decision (#234): once every expected page is in,
   *  report error pages truthfully (an all-error batch must not read as "fully
   *  completed" — that hid a dead MIT worker, 2026-06-06 incident) and resolve the
   *  job. Idempotent — resolve() no-ops once settled. Both the webhook and the
   *  stream completion paths funnel through here so terminal state is decided once. */
  private maybeComplete(job: BatchJobState, jobKey: string): void {
    if (job.completedPages.size < job.expectedCount) return;
    const errorPages = [...job.completedPages.values()].filter((r) => r.error);
    if (errorPages.length > 0) {
      this.logger.warn(
        `[BatchRegistry] Job ${jobKey} completed with ${errorPages.length}/${job.expectedCount} page errors (first: ${errorPages[0].error})`,
      );
    } else {
      this.logger.log(`[BatchRegistry] Job ${jobKey} fully completed`);
    }
    job.resolve?.();
  }

  async handleMitCallback(
    jobKey: string,
    pageIndex: number,
    result: any,
    error?: string,
  ): Promise<void> {
    const job = this.activeBatchJobs.get(jobKey);
    if (!job) {
      this.logger.warn(
        `[Webhook] Received callback for unknown/expired job: ${jobKey}`,
      );
      return;
    }

    // Idempotency: lock synchronously before any await to prevent concurrent duplicate webhooks
    if (
      job.completedPages.has(pageIndex) ||
      job.processingPages?.has(pageIndex)
    ) {
      this.logger.debug(
        `[Webhook] Skipping duplicate callback for job=${jobKey} page=${pageIndex}`,
      );
      return;
    }
    job.processingPages?.add(pageIndex);

    // jobKey = chapterId:srcMIT:tgtMIT:model:derivative (model = 'default'
    // when unset; derivative = 'hd' | 'saver', #156)
    const {
      chapterId,
      srcMIT,
      tgtMIT,
      model: jobModel,
      derivative: jobDerivative,
    } = parseJobKey(jobKey);

    let pageResult: PageResult;

    // Persistence failures must surface as a page error, never an exception:
    // a throw here used to exit before processingPages.delete, permanently
    // locking the page against retries (latent bug noted 2026-06-04, caught
    // by review on PR #144).
    try {
      if (error) {
        pageResult = { patches: [], error };
      } else {
        const imgW = result.imgWidth > 0 ? result.imgWidth : 0;
        const imgH = result.imgHeight > 0 ? result.imgHeight : 0;

        // Enforce the per-patch size bound (#95 S3) before handing the accepted
        // set to PatchStore, which owns naming/lifecycle (#137).
        const accepted: Array<{
          x: number;
          y: number;
          w: number;
          h: number;
          buf: Buffer;
        }> = [];
        for (const [i, p] of (result.patches || []).entries()) {
          if (p.img_b64.length > 5_000_000) {
            this.logger.warn(
              `[Webhook] patch ${i} for job=${jobKey} page=${pageIndex} exceeds size limit — skipped`,
            );
            continue;
          }
          accepted.push({
            x: p.x,
            y: p.y,
            w: p.w,
            h: p.h,
            buf: Buffer.from(p.img_b64, 'base64'),
          });
        }

        // Cache key MUST match the batch pre-check and the single-page endpoint
        // (patchCacheKey), or webhook results are never served from cache again
        // (found live during the #87 v4 migration).
        const cacheKey = this.patchCacheKey(
          chapterId,
          pageIndex,
          srcMIT,
          tgtMIT,
          jobModel,
          jobDerivative === 'saver' ? 'saver' : 'hd',
        );
        // #232: shared per-page persist — PatchStore write + percent-map + 7-day
        // cache set + translation-memory save.
        const patches = await this.deps.persistPage({
          chapterId,
          pageIndex,
          srcMIT,
          tgtMIT,
          storeModel: jobModel,
          cacheKey,
          cacheStrategy: 'plain7d',
          rects: accepted,
          buffers: accepted.map((a) => a.buf),
          imgW,
          imgH,
          regions: result.regions as TextLayerRegion[] | undefined,
          tmModel: jobModel,
        });

        pageResult = { patches };
      }
    } catch (persistErr) {
      const msg =
        persistErr instanceof Error ? persistErr.message : String(persistErr);
      this.logger.error(
        `[Webhook] persistence failed job=${jobKey} page=${pageIndex}: ${msg}`,
      );
      pageResult = { patches: [], error: `persistence failed: ${msg}` };
    }

    job.processingPages?.delete(pageIndex);
    job.completedPages.set(pageIndex, pageResult);
    this.deliver(job, pageIndex, pageResult);

    // Terminal-state decision is shared with the stream path (#234).
    this.maybeComplete(job, jobKey);
  }

  /**
   * Remove an SSE listener from an active batch job.
   * Call this when the client disconnects — the job continues in the background
   * and caches all remaining pages.
   */
  removeBatchListener(
    chapterId: string,
    sourceLang: string | undefined,
    targetLang: string | undefined,
    listener: BatchPageListener,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
  ): void {
    const jobKey = this.buildJobKey(
      chapterId,
      sourceLang,
      targetLang,
      imageModel,
      derivative,
    );
    const job = this.activeBatchJobs.get(jobKey);
    if (job) {
      job.listeners.delete(listener);
      job.activeCallerCount = Math.max(0, job.activeCallerCount - 1);
      this.logger.log(
        `[BatchRegistry] job=${jobKey} − listener removed (${job.activeCallerCount} active callers remaining)`,
      );
      if (job.activeCallerCount === 0) {
        this.logger.log(
          `[BatchRegistry] job=${jobKey} last caller gone — cancelling MIT job`,
        );
        job.cancelController.abort();
        // Tell MIT to stop the in-flight background batch for this taskId so it
        // doesn't keep burning GPU on a job nobody is listening to. Best-effort,
        // fire-and-forget; MIT no-ops an unknown/finished taskId.
        void this.mitClient
          .cancel(jobKey)
          .catch((err) =>
            this.logger.debug(
              `[BatchRegistry] MIT cancel request failed for job=${jobKey}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }
    }
  }

  /**
   * Start or attach to a background batch-translate job for a chapter.
   *
   * - If no job is running: pre-checks cache per page, sends only uncached pages to MIT,
   *   immediately emits already-cached pages, then streams the rest as MIT finishes.
   * - If a job is already running: replays all already-completed pages to the new
   *   listener immediately, then streams subsequent results as they arrive.
   * - The returned Promise resolves when the job fully completes (all pages done or
   *   MIT closes). If the client disconnects, call `removeBatchListener()` — the job
   *   continues caching in the background.
   */
  async startOrAttachBatchJob(
    chapterId: string,
    pages: Array<{ pageIndex: number; pageUrl: string }>,
    listener: BatchPageListener,
    sourceLang?: string,
    targetLang?: string,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
    mangaId?: string,
  ): Promise<void> {
    const { srcMIT, tgtMIT } = this.mitLangPair(sourceLang, targetLang);
    const jobKey = this.buildJobKey(
      chapterId,
      sourceLang,
      targetLang,
      imageModel,
      derivative,
    );

    const existing = this.activeBatchJobs.get(jobKey);

    // Only attach to a job that hasn't been cancelled yet
    if (existing && !existing.cancelController.signal.aborted) {
      // Replay already-completed pages to this latecomer immediately
      for (const [pageIndex, result] of existing.completedPages) {
        listener(pageIndex, result);
      }
      existing.listeners.add(listener);
      existing.activeCallerCount++;
      this.logger.log(`[BatchRegistry] job=${jobKey} attached to running job`);
      await existing.promise;
      existing.listeners.delete(listener);
      return;
    }

    // ── No active job: create one ──────────────────────────────────────────

    // 1. Pre-check cache to avoid re-processing already-translated pages.
    // Register a placeholder first so concurrent callers attach as latecomers
    // instead of creating a second job (closes the TOCTOU window at cache.get).
    const cancelController = new AbortController();
    let resolve: () => void;
    let reject: (err: any) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const placeholderJob: BatchJobState = {
      completedPages: new Map(),
      processingPages: new Set(),
      // Latecomers add themselves to job.listeners via the attach path.
      // Original caller is always delivered directly via originalListener.
      listeners: new Set(),
      originalListener: listener,
      activeCallerCount: 1,
      promise,
      cancelController,
      resolve: resolve!,
      reject: reject!,
      expectedCount: pages.length,
    };
    this.activeBatchJobs.set(jobKey, placeholderJob);

    // All page lookups in parallel (#148) — serial gets cost N cold-path RTTs
    // before MIT even started. Replay stays in page order: results are
    // consumed by index, not by resolution order.
    const cachedResults = await Promise.all(
      pages.map((p) =>
        this.cache.get<{ patches: PatchEntry[] }>(
          this.patchCacheKey(
            chapterId,
            p.pageIndex,
            srcMIT,
            tgtMIT,
            imageModel,
            derivative,
          ),
        ),
      ),
    );
    const uncachedPages: Array<{ pageIndex: number; pageUrl: string }> = [];
    pages.forEach((p, i) => {
      const cached = cachedResults[i];
      if (cached?.data?.patches) {
        // Serve from cache immediately — direct call
        listener(p.pageIndex, { patches: cached.data.patches });
      } else {
        uncachedPages.push(p);
      }
    });

    if (uncachedPages.length === 0) {
      this.logger.log(
        `[BatchRegistry] job=${jobKey} all ${pages.length} pages were cached — skipping MIT`,
      );
      placeholderJob.resolve?.();
      // Remove the placeholder from the registry (mirrors the finally-cleanup of
      // the MIT path). Leaving it behind poisons every later batch-translate for
      // this jobKey: callers attach to the resolved job, replay an empty
      // completedPages, and return with nothing (Issue #127).
      if (this.activeBatchJobs.get(jobKey) === placeholderJob) {
        this.activeBatchJobs.delete(jobKey);
      }
      return;
    }

    // 2. Finalize job state using the placeholder already in the registry
    const job = placeholderJob;
    job.expectedCount = uncachedPages.length;

    // 3. Inner notify: record completion + fan-out through the shared deliver() sink.
    const notify = (pageIndex: number, result: PageResult) => {
      job.completedPages.set(pageIndex, result);
      this.deliver(job, pageIndex, result);
    };

    // 4. Start background MIT processing
    // We pass the jobKey so MIT can send it back in the webhook
    this._runMitBatch(
      chapterId,
      uncachedPages,
      notify,
      cancelController.signal,
      srcMIT,
      tgtMIT,
      jobKey,
      sourceLang,
      targetLang,
      imageModel,
      derivative,
      mangaId,
    )
      .then(() => {
        this.maybeComplete(job, jobKey);
      })
      .catch((err) => {
        job.reject?.(err);
      });

    // Guarantee the promise is eventually settled so activeBatchJobs never leaks.
    const timeoutHandle = setTimeout(
      () =>
        job.reject?.(
          new Error(`[BatchRegistry] job=${jobKey} timed out after 15 minutes`),
        ),
      15 * 60 * 1000,
    );
    job.cancelController.signal.addEventListener('abort', () => {
      job.reject?.(new Error(`[BatchRegistry] job=${jobKey} cancelled`));
    });

    this.logger.log(
      `[BatchRegistry] job=${jobKey} started (${uncachedPages.length} pages to process)`,
    );

    try {
      await promise;
    } finally {
      clearTimeout(timeoutHandle);
      job.originalListener = undefined;
      if (this.activeBatchJobs.get(jobKey) === job) {
        this.activeBatchJobs.delete(jobKey);
        this.logger.log(
          `[BatchRegistry] job=${jobKey} completed & removed from registry`,
        );
      }
    }
  }

  /**
   * Internal: fetch images, POST to MIT batch endpoint, stream & cache results.
   * Calls `notify` for each page as it completes.
   */
  private async _runMitBatch(
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
    const mitConfig = this.buildMitConfig(
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
        undefined,
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
        undefined,
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
    let lineBuf = '';
    let receivedCount = 0;
    const expectedCount = pages.length;
    const processedPageIndexes = new Set<number>();
    const pageUrlByIndex = new Map(pages.map((p) => [p.pageIndex, p.pageUrl]));

    const streamReadTimeoutMs = Math.max(
      30_000,
      Number(process.env.MIT_BATCH_STREAM_READ_TIMEOUT_MS ?? 90_000),
    );
    const readWithTimeout = async () => {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `MIT stream read timeout after ${streamReadTimeoutMs}ms`,
                ),
              ),
            streamReadTimeoutMs,
          );
        }),
      ]);
    };

    let streamFailedError: string | null = null;

    try {
      outer: while (true) {
        const { done, value } = await readWithTimeout();
        if (done) break;
        lineBuf += decoder.decode(value, { stream: true });

        const lines = lineBuf.split('\n');
        lineBuf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const raw = JSON.parse(line) as Record<string, unknown>;

            // Sentinel: MIT signals it has finished all pages
            if (raw['done'] === true) break outer;

            const data = raw as {
              pageIndex: number;
              imgWidth: number;
              imgHeight: number;
              patches: Array<{
                x: number;
                y: number;
                w: number;
                h: number;
                img_b64: string;
              }>;
              error: string | null;
            };

            if (
              typeof data.pageIndex !== 'number' ||
              Number.isNaN(data.pageIndex)
            ) {
              continue;
            }

            if (data.error) {
              this.logger.warn(
                `[BatchPatches] chapter=${chapterId} page=${data.pageIndex} error: ${data.error}`,
              );
              notify(data.pageIndex, { patches: [], error: data.error });
              if (!processedPageIndexes.has(data.pageIndex)) {
                processedPageIndexes.add(data.pageIndex);
                receivedCount++;
                if (receivedCount >= expectedCount) break outer;
              }
              continue;
            }

            const imgW = data.imgWidth;
            const imgH = data.imgHeight;
            // Cache so single-page endpoint & future batch requests skip MIT
            const cacheKey = this.patchCacheKey(
              chapterId,
              data.pageIndex,
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
              pageIndex: data.pageIndex,
              srcMIT,
              tgtMIT,
              storeModel: this.imageModelKey(imageModel),
              cacheKey,
              cacheStrategy: 'tiered',
              rects: data.patches,
              buffers: data.patches.map((p) =>
                Buffer.from(p.img_b64, 'base64'),
              ),
              imgW,
              imgH,
              recoverIfEmpty:
                srcMIT === 'ANY'
                  ? undefined
                  : async () => {
                      const pageUrl = pageUrlByIndex.get(data.pageIndex);
                      if (!pageUrl) return [];
                      try {
                        const fallback = await this.deps.translateSinglePage(
                          chapterId,
                          data.pageIndex,
                          pageUrl,
                          undefined,
                          targetLangIso,
                          { imageModel },
                        );
                        if (fallback.patches.length > 0) {
                          this.logger.log(
                            `[BatchPatches] chapter=${chapterId} page=${data.pageIndex} source_lang_only fallback recovered ${fallback.patches.length} patches`,
                          );
                          return fallback.patches;
                        }
                      } catch (fallbackErr) {
                        this.logger.warn(
                          `[BatchPatches] chapter=${chapterId} page=${data.pageIndex} fallback(no source filter) failed: ${String(fallbackErr)}`,
                        );
                      }
                      return [];
                    },
            });

            this.logger.log(
              `[BatchPatches] chapter=${chapterId} page=${data.pageIndex} → ${patches.length} patches`,
            );
            notify(data.pageIndex, { patches });

            if (!processedPageIndexes.has(data.pageIndex)) {
              processedPageIndexes.add(data.pageIndex);
              receivedCount++;
              if (receivedCount >= expectedCount) break outer;
            }
          } catch {
            this.logger.warn(
              `[BatchPatches] NDJSON parse failed: ${line.slice(0, 120)}`,
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
      undefined,
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

    for (const missing of missingPages) {
      if (signal?.aborted) break;
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

    if (missingPages.length > 0) {
      this.logger.log(
        `[BatchPatches] chapter=${chapterId} fallback summary: expected=${pages.length}, streamed=${pages.length - missingPages.length}, recovered=${recovered}, failed=${failed}`,
      );
    }
  }

  // Kept for backwards compat with any direct callers (single-page endpoint)
  /** @deprecated Use startOrAttachBatchJob instead */
  async translateMangaChapterBatchPatches(
    chapterId: string,
    pages: Array<{ pageIndex: number; pageUrl: string }>,
    onPage: (data: {
      pageIndex: number;
      patches: PatchEntry[];
      error?: string;
    }) => void,
  ): Promise<void> {
    const listener: BatchPageListener = (pageIndex, result) =>
      onPage({ pageIndex, ...result });
    return this.startOrAttachBatchJob(chapterId, pages, listener);
  }
}
