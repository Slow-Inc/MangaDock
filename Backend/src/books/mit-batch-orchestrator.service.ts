import { Logger } from '@nestjs/common';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { MitClient } from './mit-client';
import { type TextLayerRegion } from './translation-memory.repository';
import { MitBatchStream } from './mit-batch-stream';
import {
  type PatchEntry,
  type PageResult,
  type BatchPageListener,
  type MitBatchDeps,
} from './mit-batch-types';
import {
  mitLangPair,
  buildJobKey,
  patchCacheKey,
  parseJobKey,
} from './mit-config';

// Re-export the shared types so existing importers (e.g. books.service) keep
// their import path unchanged. The definitions now live in ./mit-batch-types.
export type {
  PatchEntry,
  PageResult,
  BatchPageListener,
  MitBatchDeps,
} from './mit-batch-types';

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

  /** Transport/stream driver (#294): HTTP submit + NDJSON read loop. The
   *  orchestrator stays the job-state machine and delegates the wire work here. */
  private readonly stream: MitBatchStream;

  constructor(
    private readonly mitClient: MitClient,
    private readonly cache: CacheOrchestratorService,
    private readonly deps: MitBatchDeps,
  ) {
    this.stream = new MitBatchStream(this.mitClient, this.deps);
  }

  // ─── #229 pure-helper delegators (env-bound; single source of truth in mit-config) ───
  private mitLangPair(
    sourceLang?: string,
    targetLang?: string,
  ): { srcMIT: string; tgtMIT: string } {
    return mitLangPair(process.env, sourceLang, targetLang);
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
      try {
        await existing.promise;
      } finally {
        // #234 S5d: drain even if the job rejected (15-min timeout / abort) —
        // the post-await delete used to be skipped on reject, leaking this
        // latecomer's listener.
        existing.listeners.delete(listener);
      }
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
    // #524 cache-safety: when rolling cross-page context is enabled (MIT_CONTEXT_PAGES>0),
    // page N's translation depends on pages <N. Serving SOME pages from cache while
    // re-translating the rest would build MIT's RollingContext from an INCOMPLETE page set,
    // caching a context-free result under a context-on patch key. So when context is on and
    // the batch is not fully cached, send the whole ordered chapter to MIT (complete context)
    // and do not pre-serve the partial cache — MIT regenerates every page under full context.
    // Context off (default) → unchanged, byte-identical. (renderConfigHash folds MIT_CONTEXT_PAGES,
    // so context-on and context-off patches already live in separate cache namespaces.)
    const contextPages = Number(process.env.MIT_CONTEXT_PAGES);
    const contextEnabled = Number.isFinite(contextPages) && contextPages > 0;
    const allCached = cachedResults.every((c) => c?.data?.patches);

    const uncachedPages: Array<{ pageIndex: number; pageUrl: string }> = [];
    if (contextEnabled && !allCached) {
      uncachedPages.push(...pages); // full ordered chapter; no partial pre-serve
    } else {
      pages.forEach((p, i) => {
        const cached = cachedResults[i];
        if (cached?.data?.patches) {
          // Serve from cache immediately — direct call
          listener(p.pageIndex, { patches: cached.data.patches });
          // FR-8: record in completedPages so latecomers receive cached pages on attach
          placeholderJob.completedPages.set(p.pageIndex, {
            patches: cached.data.patches,
          });
        } else {
          uncachedPages.push(p);
        }
      });
    }

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
    // expectedCount stays at pages.length (set at placeholder creation) — FR-8:
    // completedPages now holds cached pages from the start, so expectedCount must
    // equal the TOTAL page count or maybeComplete would fire too early.
    const job = placeholderJob;

    // 3. Inner notify: record completion + fan-out through the shared deliver() sink.
    const notify = (pageIndex: number, result: PageResult) => {
      job.completedPages.set(pageIndex, result);
      this.deliver(job, pageIndex, result);
    };

    // 4. Start background MIT processing (#294: transport delegated to MitBatchStream).
    // We pass the jobKey so MIT can send it back in the webhook
    this.stream
      .run(
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
      this.finalize(jobKey, job);
    }
  }

  /** Single teardown for a finished/failed job (#234 S5d): drop the original-caller
   *  reference, drain any remaining latecomer listeners, zero the caller count, and
   *  remove the job from the registry. Called from the owner's finally on BOTH
   *  resolve and reject (timeout/abort), so neither path can leak listeners or leave
   *  the registry / caller count inconsistent. */
  private finalize(jobKey: string, job: BatchJobState): void {
    job.originalListener = undefined;
    job.listeners.clear();
    job.activeCallerCount = 0;
    if (this.activeBatchJobs.get(jobKey) === job) {
      this.activeBatchJobs.delete(jobKey);
      this.logger.log(
        `[BatchRegistry] job=${jobKey} completed & removed from registry`,
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
