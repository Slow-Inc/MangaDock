import { Inject, Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'crypto';
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
// #234 S5-pre: pure MIT key/config + lang helpers moved out of this god file to
// break the value-import cycle (mit-translation/mit-batch import them too). The
// private delegators below keep BooksService's internal call sites byte-identical.
import { geminiLangName, normalizeGeminiModelName } from './mit-config';
import {
  CACHE_TTL_MS,
  type LandingBook,
  type LandingPayload,
  type LandingRow,
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

const LANDING_CACHE_KEY = 'landing:full:v5';
const QUERY_CACHE_PREFIX = 'books:query:';
const DEFAULT_GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_MODELS_CACHE_KEY = 'gemini:models:v1';
const GEMINI_MODELS_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
type GeminiModel = string;

type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

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

  private geminiModelsCatalog: GeminiModel[] | null = null;
  private geminiModelsCatalogExpiresAt = 0;

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
  ) {
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

  // #229: delegates to the pure free function (single source of truth above).
  private normalizeGeminiModelName(model?: string | null): GeminiModel | null {
    return normalizeGeminiModelName(model);
  }

  private async getAvailableGeminiModels(): Promise<Set<GeminiModel>> {
    const now = Date.now();
    if (this.geminiModelsCatalog && now < this.geminiModelsCatalogExpiresAt) {
      this.logger.log(
        `[Gemini] Model catalog [memory] count=${this.geminiModelsCatalog.length} models=${this.geminiModelsCatalog.join(', ')}`,
      );
      return new Set(this.geminiModelsCatalog);
    }

    const cached = await this.cache.get<{ models: GeminiModel[] }>(GEMINI_MODELS_CACHE_KEY);
    if (cached?.data?.models?.length) {
      this.geminiModelsCatalog = cached.data.models;
      this.geminiModelsCatalogExpiresAt = now + GEMINI_MODELS_CACHE_TTL_MS;
      this.logger.log(
        `[Gemini] Model catalog [${cached.source}] count=${cached.data.models.length} models=${cached.data.models.join(', ')}`,
      );
      return new Set(cached.data.models);
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return new Set();
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(8_000) },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as GeminiModelListResponse;
      const models = [
        ...new Set(
          (payload.models ?? [])
            .filter((entry) => (entry.supportedGenerationMethods ?? []).includes('generateContent'))
            .map((entry) => this.normalizeGeminiModelName(entry.name))
            .filter((model): model is GeminiModel => !!model),
        ),
      ];

      if (models.length > 0) {
        this.geminiModelsCatalog = models;
        this.geminiModelsCatalogExpiresAt = now + GEMINI_MODELS_CACHE_TTL_MS;
        await this.cache.set(
          GEMINI_MODELS_CACHE_KEY,
          { models },
          GEMINI_MODELS_CACHE_TTL_MS,
        );
        this.logger.log(
          `[Gemini] Model catalog [api] count=${models.length} models=${models.join(', ')}`,
        );
        return new Set(models);
      }
    } catch (err) {
      this.logger.warn(`[Gemini] Failed to refresh model catalog: ${String(err)}`);
    }

    return new Set();
  }

  private async filterAvailableGeminiModels(candidates: Array<string | null | undefined>): Promise<GeminiModel[]> {
    const normalizedCandidates = [
      ...new Set(
        candidates
          .map((candidate) => this.normalizeGeminiModelName(candidate))
          .filter((candidate): candidate is GeminiModel => !!candidate),
      ),
    ];

    if (normalizedCandidates.length === 0) {
      return [];
    }

    const availableModels = await this.getAvailableGeminiModels();
    if (availableModels.size === 0) {
      return normalizedCandidates;
    }

    const filtered = normalizedCandidates.filter((model) => availableModels.has(model));
    const skipped = normalizedCandidates.filter((model) => !availableModels.has(model));

    if (skipped.length > 0) {
      this.logger.warn(`[Gemini] Skipping unavailable models: ${skipped.join(', ')}`);
    }

    if (filtered.length > 0) {
      return filtered;
    }

    this.logger.warn(
      `[Gemini] No configured models matched provider catalog; falling back to raw candidates: ${normalizedCandidates.join(', ')}`,
    );
    return normalizedCandidates;
  }

  private async getDescriptionModels(): Promise<GeminiModel[]> {
    return this.filterAvailableGeminiModels([
      process.env.GEMINI_DESCRIPTION_MODEL,
      process.env.GEMINI_DESCRIPTION_FALLBACK_MODEL,
      DEFAULT_GEMINI_PRIMARY_MODEL,
      DEFAULT_GEMINI_FALLBACK_MODEL,
    ]);
  }

  private async getMangaModels(requested?: string): Promise<GeminiModel[]> {
    return this.filterAvailableGeminiModels([
      requested,
      process.env.GEMINI_MANGA_MODEL,
      process.env.GEMINI_MANGA_FALLBACK_MODEL,
      DEFAULT_GEMINI_PRIMARY_MODEL,
      DEFAULT_GEMINI_FALLBACK_MODEL,
    ]);
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

  async translateMangaEpisode(payload: {
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
    const sourceLines = Array.isArray(payload.lines) ? payload.lines : [];
    const lines = sourceLines
      .map((line) => (line ?? '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 60);

    const modelCandidates = await this.getMangaModels(payload.model);
    const preferredModel = modelCandidates[0];

    if (lines.length === 0) {
      return {
        translatedLines: [],
        translated: false,
        model: preferredModel,
        fromCache: 0,
        generated: 0,
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        translatedLines: lines,
        translated: false,
        model: preferredModel,
        fromCache: 0,
        generated: 0,
      };
    }

    const targetLang = (payload.targetLang ?? 'th').toLowerCase();
    const contextHint = (payload.contextHint ?? '').trim().slice(0, 280);
    const chapterTag = payload.chapterId ? `chapter:${payload.chapterId}` : 'chapter:unknown';
    const pageTag = Number.isFinite(payload.page) ? `page:${payload.page}` : 'page:unknown';
    const cacheScope = `${chapterTag}|${pageTag}|lang:${targetLang}|ctx:${contextHint}`;

    const uniqueLineMap = new Map<string, number[]>();
    lines.forEach((line, idx) => {
      const list = uniqueLineMap.get(line) ?? [];
      list.push(idx);
      uniqueLineMap.set(line, list);
    });

    const uniqueLines = [...uniqueLineMap.keys()];
    const translatedByUnique = new Map<string, string>();
    let fromCache = 0;

    // Lines in parallel; model fallback order preserved within each line (#148)
    await Promise.all(
      uniqueLines.map(async (line) => {
        const hash = createHash('sha1').update(`${line}|${cacheScope}`).digest('hex').slice(0, 24);
        for (const modelName of modelCandidates) {
          const cacheKey = `translate:manga:v1:${modelName}:${hash}`;
          const cached = await this.cache.get<{ text: string }>(cacheKey);
          if (!cached?.data?.text) continue;
          translatedByUnique.set(line, cached.data.text);
          fromCache += 1;
          break;
        }
      }),
    );

    const missingLines = uniqueLines.filter((line) => !translatedByUnique.has(line));

    let usedModel: GeminiModel = preferredModel;

    if (missingLines.length > 0) {
      const numberedLines = missingLines.map((line, idx) => `${idx + 1}. ${line}`).join('\n');
      const prompt = [
        `Translate manga dialogue/narration to ${geminiLangName(targetLang)} with natural tone and context consistency.`,
        'Output ONLY valid JSON array of strings in the same order and same length as input.',
        'Do not include explanations, markdown, keys, or extra text.',
        contextHint ? `Context: ${contextHint}` : '',
        '',
        'Input lines:',
        numberedLines,
      ].filter(Boolean).join('\n');

      const genAI = new GoogleGenerativeAI(apiKey);

      for (const modelName of modelCandidates) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
          });

          const raw = result.response.text().trim();
          const normalized = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          let parsed: string[] = [];
          try {
            const json = JSON.parse(normalized);
            if (Array.isArray(json)) {
              parsed = json.map((item) => String(item ?? '').trim());
            }
          } catch {
            parsed = normalized
              .split('\n')
              .map((line) => line.replace(/^\d+\.\s*/, '').trim())
              .filter(Boolean);
          }

          const cacheWrites: Promise<void>[] = [];
          for (let idx = 0; idx < missingLines.length; idx += 1) {
            const source = missingLines[idx];
            const translated = (parsed[idx] ?? source).trim() || source;
            translatedByUnique.set(source, translated);

            const hash = createHash('sha1').update(`${source}|${cacheScope}`).digest('hex').slice(0, 24);
            const cacheKey = `translate:manga:v1:${modelName}:${hash}`;
            cacheWrites.push(this.cache.setMangaCacheWithTiers(cacheKey, { text: translated }));
          }
          await Promise.all(cacheWrites); // parallel writes (#148)

          usedModel = modelName;
          break;
        } catch (err) {
          this.logger.warn(`[Gemini] Manga translation failed on ${modelName}: ${String(err)}`);
        }
      }
    }

    const translatedLines = lines.map((line) => translatedByUnique.get(line) ?? line);
    const generated = missingLines.length;
    const translated = translatedLines.some((line, idx) => line !== lines[idx]);
    return {
      translatedLines,
      translated,
      model: usedModel,
      fromCache,
      generated,
    };
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

  getMangaChapters(mangaId: string, forceLocal = false): Promise<MangaChapter[]> {
    return this.mangaDex.getMangaChapters(mangaId, forceLocal);
  }

  getMangaChapterPages(chapterId: string, forceLocal = false): Promise<MangaChapterPages | null> {
    return this.mangaDex.getMangaChapterPages(chapterId, forceLocal);
  }

  getMangaPreview(mangaId: string): Promise<MangaPreview | null> {
    return this.mangaDex.getMangaPreview(mangaId);
  }

  getMangaDetail(mangaId: string, forceLocal = false): Promise<MangaDetail> {
    return this.mangaDex.getMangaDetail(mangaId, forceLocal);
  }

  getNewReleases(page = 1, limit = 28, tag?: string) {
    return this.mangaDex.getNewReleases(page, limit, tag);
  }

  getGenreManga(slug: string, page = 1, limit = 28) {
    return this.mangaDex.getGenreManga(slug, page, limit);
  }

  // ─── Orchestrated methods ─────────────────────────────────────────────────────

  async translateDescription(text: string): Promise<{ translatedText: string; translated: boolean }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { translatedText: text, translated: false };
    if (!text?.trim()) return { translatedText: text, translated: false };

    // Detect if already Thai — skip if >25% Thai chars
    const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length;
    if (thaiChars / text.length > 0.25) return { translatedText: text, translated: false };

    const models = await this.getDescriptionModels();
    const fingerprint = Buffer.from(text.slice(0, 512)).toString('base64').slice(0, 64);
    const cacheKey = `translate:th:v3:${models.join('|')}:${fingerprint}`;
    const cached = await this.cache.get<{ translatedText: string; translated: boolean }>(cacheKey);
    if (cached) return cached.data;

    const prompt = `Translate the following manga/book description to Thai. Output ONLY the Thai translation. Do not include any reasoning, explanations, thoughts, or notes. Just the translated text:\n\n${text}`;
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
        });
        let translatedText = result.response.text().trim();
        // Strip THOUGHTS section if model still outputs it (fallback)
        if (translatedText.includes('THOUGHTS:') || translatedText.includes('* **')) {
          const lines = translatedText.split('\n');
          const thaiLines = lines.filter((l) => {
            const thaiCount = (l.match(/[\u0E00-\u0E7F]/g) || []).length;
            return thaiCount > 0 && thaiCount / Math.max(l.trim().length, 1) > 0.2;
          });
          if (thaiLines.length > 0) translatedText = thaiLines.join('\n').trim();
        }
        const payload = { translatedText, translated: true };
        await this.cache.setMangaCacheWithTiers(cacheKey, payload);
        return payload;
      } catch (err) {
        this.logger.warn(`[Gemini] Description translation failed on ${modelName}: ${String(err)}`);
      }
    }

    return { translatedText: text, translated: false };
  }

  async getLandingBooks(forceLocal = false): Promise<LandingPayload> {
    const cacheKey = LANDING_CACHE_KEY;
    const cached = await this.cache.get<LandingPayload>(cacheKey);
    if (cached) {
      this.logger.log(`Landing served from [${cached.source}] cache`);
      const enhanced = await this.enhanceLanding(cached.data);
      if (this.imageCache.enabled) {
        this.patchLandingCacheIfNeeded(cacheKey, cached.data, enhanced);
      }
      return forceLocal ? this.applyForceLocalLanding(enhanced) : enhanced;
    }

    this.logger.log(`Cache miss — fetching from MangaDex API`);

    const rows: LandingRow[] = [];
    try {
      for (const def of this.mangaDex.mangaRowDefs) {
        const { items } = await this.mangaDex.fetchMangaForRow(def.order, def.limit ?? 10);
        rows.push({ id: def.id, title: def.title, query: def.order, items });
      }
    } catch (err) {
      this.logger.warn(`API fetch error: ${String(err)} — attempting stale cache fallback`);
      const stale = this.cache.getStale<LandingPayload>(cacheKey);
      if (stale) {
        this.logger.log(`Serving stale landing cache (updatedAt=${stale.updatedAt})`);
        const stalePayload: LandingPayload = {
          ...stale.data,
          fromStaleCache: true,
          staleUpdatedAt: stale.updatedAt,
        };
        const enhanced = await this.enhanceLanding(stalePayload);
        return forceLocal ? this.applyForceLocalLanding(enhanced) : enhanced;
      }
      this.logger.warn('No stale cache available — returning API offline payload');
      return { hero: null, rows: [], updatedAt: new Date().toISOString(), apiOffline: true };
    }

    const hero = rows.find((r) => r.items.length > 0)?.items[0] ?? null;
    const payload: LandingPayload = {
      hero,
      rows,
      updatedAt: new Date().toISOString(),
    };

    if (rows.some((r) => r.items.length > 0)) {
      await this.cache.set(cacheKey, payload, CACHE_TTL_MS);
    } else {
      this.logger.warn('No books returned — trying stale cache fallback');
      const stale = this.cache.getStale<LandingPayload>(cacheKey);
      if (stale) {
        this.logger.log(`Serving stale landing cache (updatedAt=${stale.updatedAt})`);
        const stalePayload: LandingPayload = {
          ...stale.data,
          fromStaleCache: true,
          staleUpdatedAt: stale.updatedAt,
        };
        const enhanced = await this.enhanceLanding(stalePayload);
        return forceLocal ? this.applyForceLocalLanding(enhanced) : enhanced;
      }
      this.logger.warn('No stale cache available — returning API offline payload');
      return { hero: null, rows: [], updatedAt: new Date().toISOString(), apiOffline: true };
    }

    const landingEnhanced = await this.enhanceLanding(payload);
    return forceLocal ? this.applyForceLocalLanding(landingEnhanced) : landingEnhanced;
  }

  async searchBooks(query: string, lang?: string, limit = 100, offset = 0): Promise<{ items: LandingBook[]; total: number }> {
    const cacheKey = `${QUERY_CACHE_PREFIX}${query
      .toLowerCase()
      .replace(/\s+/g, '_')}${lang ? `:${lang}` : ''}:${offset}:${limit}`;

    const cached = await this.cache.get<{ items: LandingBook[]; total: number }>(cacheKey);
    if (cached) {
      this.logger.log(`Search served from [${cached.source}] cache: "${query}" offset=${offset}`);
      return cached.data;
    }

    const result = await this.mangaDex.searchManga(query, lang, limit, offset);

    // Enhance: also match user-uploaded alt names in chapter_versions
    try {
      const existingIds = new Set(result.items.map((b) => b.id));
      const altMatches = await this.findTitleIdsByAltName(query);
      const newIds = altMatches.filter((id) => !existingIds.has(id));
      if (newIds.length > 0) {
        const extra = await this.mangaDex.fetchMangaByIds(newIds);
        result.items.push(...extra);
        result.total += extra.length;
        this.logger.log(`Alt-name search added ${extra.length} extra manga for "${query}"`);
      }
    } catch (err) {
      this.logger.warn(`Alt-name lookup failed: ${String(err)}`);
    }

    if (result.items.length > 0) {
      await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    }

    return result;
  }

  /** Query chapter_versions for title_name / title_alt_name matching the search query. */
  private async findTitleIdsByAltName(query: string): Promise<string[]> {
    const pattern = `%${query}%`;
    const { data, error } = await this.supabase.client
      .from('chapter_versions')
      .select('title_id')
      .or(`title_name.ilike.${pattern},title_alt_name.ilike.${pattern}`)
      .eq('status', 'published');
    if (error) throw error;
    // Deduplicate title_ids
    return [...new Set((data ?? []).map((row: any) => row.title_id as string))];
  }

  // ─── Image cache enhancement (landing-level) ──────────────────────────────────

  private applyForceLocalLanding(payload: LandingPayload): LandingPayload {
    if (!this.imageCache.enabled) return payload;
    const origin = this.backendOrigin;
    const fix = (book: LandingBook): LandingBook => {
      const cached = !!book.thumbnailLocal;
      return {
        ...book,
        thumbnail: cached ? `${origin}${book.thumbnailLocal}` : book.thumbnail,
        thumbnailCached: cached,
      };
    };
    return {
      ...payload,
      hero: payload.hero ? fix(payload.hero) : null,
      rows: payload.rows.map((row) => ({ ...row, items: row.items.map(fix) })),
    };
  }

  private patchLandingCacheIfNeeded(
    cacheKey: string,
    original: LandingPayload,
    enhanced: LandingPayload,
  ): void {
    const allOriginal = [
      ...(original.hero ? [original.hero] : []),
      ...original.rows.flatMap((r) => r.items),
    ];
    const allEnhanced = [
      ...(enhanced.hero ? [enhanced.hero] : []),
      ...enhanced.rows.flatMap((r) => r.items),
    ];

    const newCount = allEnhanced.filter(
      (b, i) => b.thumbnailLocal && !allOriginal[i]?.thumbnailLocal,
    ).length;

    if (newCount === 0) return;

    this.logger.log(
      `[ImageCache] Patching landing cache — ${newCount} new local thumbnail(s) added`,
    );
    this.cache
      .set(cacheKey, enhanced, CACHE_TTL_MS)
      .catch((err) =>
        this.logger.warn(`[ImageCache] Landing cache patch failed: ${String(err)}`),
      );
  }

  private async enhanceLanding(payload: LandingPayload): Promise<LandingPayload> {
    if (!this.imageCache.enabled) return payload;
    
    const enhanceBook = async (book: LandingBook): Promise<LandingBook> => ({
      ...book,
      thumbnailLocal:
        book.thumbnailLocal
          ? book.thumbnailLocal
          : ((await this.imageCache.localThumbnailPath(book.id, book.thumbnail)) ?? undefined),
    });

    const [hero, rows] = await Promise.all([
      payload.hero ? enhanceBook(payload.hero) : Promise.resolve(null),
      Promise.all(
        payload.rows.map(async (row) => ({
          ...row,
          items: await Promise.all(row.items.map(enhanceBook)),
        })),
      ),
    ]);

    return { ...payload, hero, rows };
  }
}

