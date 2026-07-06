import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { ImageCacheService } from '../cache/image-cache.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MangaDexService } from './mangadex.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../common/storage/storage-provider.interface';
import { PatchStore } from './patch-store';
import { TranslationMemoryRepository, type TextLayerRegion } from './translation-memory.repository';
import { MitClient } from './mit-client';
import { MitTranslationService } from './mit-translation.service';
import { MitBatchOrchestrator, type BatchPageListener } from './mit-batch-orchestrator.service';
import { loadPageBytes } from './page-source';
import { composeSeriesContext } from './series-context';
import { GeminiModelCatalog, type GeminiModel } from './gemini-model-catalog';
import { MangaCatalogService } from './manga-catalog.service';
import { LandingService } from './landing.service';
import { LlmService } from './llm.service';
import {
  type LandingBook,
  type LandingPayload,
  type MangaChapter,
  type MangaChapterPages,
  type MangaDetail,
  type MangaPreview,
} from './books.types';

// Re-export types so the controller imports from one place
export type {
  MangaCover,
  MangaDetail,
  MangaPreview,
  MangaChapter,
  MangaChapterPages,
  LandingBook,
} from './books.types';

// ─── Patch geometry ───────────────────────────────────────────────────────────
type PatchEntry = { xPct: number; yPct: number; wPct: number; hPct: number; url: string };

/** Map raw MIT patch rects (px) + their already-stored URLs into percent-geometry
 *  patch entries. Pure — the single source of truth for the percent math that was
 *  previously triplicated across the single-page, batch-stream, and webhook paths
 *  (#232). A zero image dimension degrades that axis to 0. The `url` is taken
 *  positionally, so `rects[i]` must line up with `urls[i]` (PatchStore.put order). */
export function toPatchEntries(
  rects: Array<{ x: number; y: number; w: number; h: number }>,
  urls: string[],
  imgW: number,
  imgH: number,
): PatchEntry[] {
  return rects.map((r, i) => ({
    xPct: imgW > 0 ? r.x / imgW : 0,
    yPct: imgH > 0 ? r.y / imgH : 0,
    wPct: imgW > 0 ? r.w / imgW : 0,
    hPct: imgH > 0 ? r.h / imgH : 0,
    url: urls[i],
  }));
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);
  private readonly env: NodeJS.ProcessEnv = process.env;

  /** Gemini model-selection catalog (#231) — memory/cache/api availability +
   *  per-purpose candidate selection. Constructed here so it shares this service's
   *  cache; BooksService keeps thin delegators. */
  private readonly geminiCatalog: GeminiModelCatalog;

  /** MangaDex catalog passthrough + search (#231). Constructed here so it shares
   *  this service's mangaDex/supabase/cache; BooksService keeps thin delegators. */
  private readonly catalog: MangaCatalogService;

  /** Landing assembly + Gemini text translation (description/episode) (#231).
   *  Constructed here so it shares this service's cache/imageCache/mangaDex/
   *  geminiCatalog + backendOrigin; BooksService keeps thin delegators. */
  private readonly landing: LandingService;

  /** Single owner of Patch Set files (#137) — deterministic names, legacy sweep. */
  private readonly patchStore: PatchStore;
  private readonly translationMemory: TranslationMemoryRepository;
  /** Single-page MIT translation + health/probe (#233). Constructed here (like
   *  PatchStore) so it shares this service's MitClient/cache and the #232/#157
   *  persist/series-context helpers, keeping the dependency one-way. */
  private readonly mitTranslation: MitTranslationService;
  /** MIT batch (full-chapter) translation state machine (#234). Constructed here so
   *  it shares this service's MitClient/cache and the shared persist/series-context/
   *  single-page helpers via injected callbacks — one-way dependency. */
  private readonly batch: MitBatchOrchestrator;

  constructor(
    private readonly mangaDex: MangaDexService,
    private readonly cache: CacheOrchestratorService,
    private readonly imageCache: ImageCacheService,
    private readonly supabase: SupabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    // #230: the single HTTP boundary to MIT. Injected in production (registered in
    // BooksModule); the default keeps the manual `new BooksService(...)` in unit
    // tests working unchanged (those that exercise MIT fake global.fetch).
    private readonly mitClient: MitClient = new MitClient(),
    private readonly llmService: LlmService = new LlmService(),
  ) {
    this.geminiCatalog = new GeminiModelCatalog(this.cache);
    this.catalog = new MangaCatalogService(this.mangaDex, this.supabase, this.cache);
    this.landing = new LandingService(
      this.cache,
      this.imageCache,
      this.mangaDex,
      this.geminiCatalog,
      () => this.backendOrigin,
      this.env,
      this.llmService,
    );
    this.patchStore = new PatchStore(this.storage, () => this.backendOrigin);
    // #160: translation memory rides the already-injected service-role client;
    // best-effort, so a missing/broken Supabase never affects translation.
    this.translationMemory = new TranslationMemoryRepository(this.supabase);
    // #233: single-page MIT path delegates here. persistPage (#232) + seriesContextFor
    // (#157) stay in BooksService — shared with the batch/webhook path — and are
    // injected as callbacks so the dependency stays one-way (no circular DI).
    this.mitTranslation = new MitTranslationService(this.mitClient, this.cache, {
      persistPage: (p) => this.persistPage(p),
      seriesContextFor: (mangaId) => this.seriesContextFor(mangaId),
    });
    // #234: batch state machine delegates here. Same shared callbacks, plus the
    // single-page translate (the per-page fallback) — late-bound so a test spy on
    // translateMangaPagePatches is still observed by the batch retry path.
    this.batch = new MitBatchOrchestrator(this.mitClient, this.cache, {
      persistPage: (p) => this.persistPage(p),
      seriesContextFor: (mangaId) => this.seriesContextFor(mangaId),
      translateSinglePage: (chapterId, pageIndex, pageUrl, sourceLang, targetLang, opts) =>
        this.translateMangaPagePatches(chapterId, pageIndex, pageUrl, sourceLang, targetLang, opts),
    });
  }

  onModuleInit(): void {
    // Clean the pre-#137 random-named patch backlog on boot, then daily.
    this.patchStore.startSweeping(
      (removed) => {
        if (removed > 0) this.logger.log(`[PatchStore] swept ${removed} legacy patch files`);
      },
      (err) => this.logger.warn(`[PatchStore] sweep failed: ${String(err)}`),
    );
  }

  // #234: batch translation is delegated to MitBatchOrchestrator. These delegators
  // keep the controller + MIT-webhook call sites byte-identical (signatures unchanged).
  notifyBatchProgress(jobKey: string, pageIndex: number, stage: string): void {
    this.batch.notifyBatchProgress(jobKey, pageIndex, stage);
  }

  /** Shared per-page persist (#232): PatchStore write → percent-map (toPatchEntries)
   *  → cache set (via the #229 patch cache key) → optional translation-memory save,
   *  in one place. Cache strategy + TM save are parametrized so the webhook,
   *  batch-stream, and single-page callers each keep byte-identical behaviour.
   *  `recoverIfEmpty` lets the batch path swap in a source_lang_only fallback
   *  before the single cache write. Returns the final patch entries. */
  private async persistPage(p: {
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
  }): Promise<PatchEntry[]> {
    const urls = await this.patchStore.put(
      { chapterId: p.chapterId, pageIndex: p.pageIndex, srcMIT: p.srcMIT, tgtMIT: p.tgtMIT, model: p.storeModel },
      p.buffers,
    );
    let patches = toPatchEntries(p.rects, urls, p.imgW, p.imgH);
    if (patches.length === 0 && p.recoverIfEmpty) {
      patches = await p.recoverIfEmpty();
    }
    if (p.cacheStrategy === 'plain7d') {
      await this.cache.set(p.cacheKey, { patches }, 1000 * 60 * 60 * 24 * 7); // 7 days
    } else {
      await this.cache.setMangaCacheWithTiers(p.cacheKey, { patches });
    }
    // Translation memory (#160): persist this page's text layer (#158 regions).
    // Fire-and-forget — the repository swallows its own errors, so persistence
    // never adds latency to or fails page delivery (local-first).
    if (Array.isArray(p.regions) && p.regions.length > 0) {
      void this.translationMemory.savePageText(p.chapterId, p.pageIndex, p.tgtMIT, p.regions, p.tmModel);
    }
    return patches;
  }

  async handleMitCallback(jobKey: string, pageIndex: number, result: any, error?: string): Promise<void> {
    return this.batch.handleMitCallback(jobKey, pageIndex, result, error);
  }

  private get backendOrigin(): string {
    return (
      process.env.BACKEND_PUBLIC_ORIGIN ??
      `http://localhost:${process.env.PORT ?? 3001}`
    );
  }

  // #231: Gemini model selection lives in GeminiModelCatalog. These delegators keep
  // the internal callers — and the books-models spy on getMangaModels — byte-identical.
  private async getDescriptionModels(): Promise<string[]> {
    const provider = this.env.LLM_PROVIDER ?? 'gemini';
    if (provider === 'gemini') return this.geminiCatalog.getDescriptionModels();
    return [this.llmService.getDescriptionModel()];
  }

  private async getMangaModels(requested?: string): Promise<string[]> {
    const provider = this.env.LLM_PROVIDER ?? 'gemini';
    if (provider === 'gemini') return this.geminiCatalog.getMangaModels(requested);
    return [this.llmService.getMangaModel()];
  }

  /** Cache for getImageTranslator() — one MIT round-trip per minute at most. */
  /** The translator family MIT actually runs (from /ready, #132) — e.g. 'qwen3'
   *  or 'gemini'. null when MIT is down, not ready, or predates #132; consumers
   *  treat null as "unknown" (Reader fails open — PRD #131). #233: delegated. */
  async getImageTranslator(): Promise<string | null> {
    return this.mitTranslation.getImageTranslator();
  }

  /** Payload for GET /books/models (#133): the Gemini catalog the Reader can
   *  offer, plus the translator MIT actually runs so the Reader knows whether
   *  offering Gemini models makes sense at all. */
  async getMangaModelsInfo(): Promise<{ models: GeminiModel[]; imageTranslator: string | null }> {
    const [models, imageTranslator] = await Promise.all([
      this.getMangaModels(),
      this.getImageTranslator(),
    ]);
    return { models, imageTranslator };
  }

  /** Series context (#157): resolve catalog metadata for the manga being
   *  translated into the prompt-context string. Catalog failure or missing id
   *  degrades to undefined — translate must never break because metadata is
   *  unavailable (local-first rule). */
  private async seriesContextFor(mangaId?: string): Promise<string | undefined> {
    if (!mangaId) return undefined;
    try {
      const detail = await this.mangaDex.getMangaDetail(mangaId);
      return composeSeriesContext(detail);
    } catch (err) {
      this.logger.warn(`[SeriesContext] catalog lookup failed manga=${mangaId}: ${String(err)}`);
      return undefined;
    }
  }

  // #231: Gemini text translation (episode + description) lives in LandingService.
  // Delegators keep the controller call sites + the books-translate spec byte-identical.
  translateMangaEpisode(payload: {
    lines?: string[];
    contextHint?: string;
    chapterId?: string;
    page?: number;
    model?: string;
    targetLang?: string;
  }): Promise<{
    translatedLines: string[];
    translated: boolean;
    model: GeminiModel;
    fromCache: number;
    generated: number;
  }> {
    return this.landing.translateMangaEpisode(payload);
  }

  // ─── Manga page image translation (manga-image-translator) ──────────────────

  // #233: delegated to MitTranslationService (signature unchanged for callers).
  async checkMitHealth(): Promise<{ available: boolean; url: string; message?: string }> {
    return this.mitTranslation.checkMitHealth();
  }

  

  async translateMangaPagePatches(
    chapterId: string,
    pageIndex: number,
    pageUrl: string,
    sourceLang?: string,
    targetLang?: string,
    opts?: { maxStartupRetries?: number; imageModel?: string; derivative?: 'hd' | 'saver'; mangaId?: string },
  ): Promise<{ patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }> }> {
    // #233: single-page flow lives in MitTranslationService. Kept as a delegator so
    // the controller and the internal batch/retry callers (which spy on this method)
    // are byte-identical.
    return this.mitTranslation.translateMangaPagePatches(
      chapterId,
      pageIndex,
      pageUrl,
      sourceLang,
      targetLang,
      opts,
    );
  }

  removeBatchListener(
    chapterId: string,
    sourceLang: string | undefined,
    targetLang: string | undefined,
    listener: BatchPageListener,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
  ): void {
    this.batch.removeBatchListener(chapterId, sourceLang, targetLang, listener, imageModel, derivative);
  }

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
    return this.batch.startOrAttachBatchJob(chapterId, pages, listener, sourceLang, targetLang, imageModel, derivative, mangaId);
  }

  /** @deprecated Use startOrAttachBatchJob instead */
  async translateMangaChapterBatchPatches(
    chapterId: string,
    pages: Array<{ pageIndex: number; pageUrl: string }>,
    onPage: (data: { pageIndex: number; patches: PatchEntry[]; error?: string }) => void,
  ): Promise<void> {
    return this.batch.translateMangaChapterBatchPatches(chapterId, pages, onPage);
  }

  // ─── Delegated MangaDex methods ───────────────────────────────────────────────

  // #231: MangaDex catalog passthrough + search live in MangaCatalogService.
  // These delegators keep the controller call sites byte-identical.
  getMangaChapters(mangaId: string, forceLocal = false): Promise<MangaChapter[]> {
    return this.catalog.getMangaChapters(mangaId, forceLocal);
  }

  getMangaChapterPages(chapterId: string, forceLocal = false): Promise<MangaChapterPages | null> {
    return this.catalog.getMangaChapterPages(chapterId, forceLocal);
  }

  getMangaPreview(mangaId: string): Promise<MangaPreview | null> {
    return this.catalog.getMangaPreview(mangaId);
  }

  getMangaDetail(mangaId: string, forceLocal = false): Promise<MangaDetail> {
    return this.catalog.getMangaDetail(mangaId, forceLocal);
  }

  getNewReleases(page = 1, limit = 28, tag?: string) {
    return this.catalog.getNewReleases(page, limit, tag);
  }

  getGenreManga(slug: string, page = 1, limit = 28) {
    return this.catalog.getGenreManga(slug, page, limit);
  }

  // ─── Orchestrated methods ─────────────────────────────────────────────────────

  translateDescription(text: string): Promise<{ translatedText: string; translated: boolean }> {
    return this.landing.translateDescription(text);
  }

  getLandingBooks(forceLocal = false): Promise<LandingPayload> {
    return this.landing.getLandingBooks(forceLocal);
  }

  // #231: search + alt-name lookup live in MangaCatalogService. Delegator keeps the
  // controller call site byte-identical.
  searchBooks(query: string, lang?: string, limit = 100, offset = 0, status?: 'ongoing' | 'completed' | 'hiatus', yearFrom?: number, yearTo?: number): Promise<{ items: LandingBook[]; total: number }> {
    return this.catalog.searchBooks(query, lang, limit, offset, status, yearFrom, yearTo);
  }

  getRelated(id: string, limit = 10): Promise<LandingBook[]> {
    return this.catalog.getRelated(id, limit);
  }

}

