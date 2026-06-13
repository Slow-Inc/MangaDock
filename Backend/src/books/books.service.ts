import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
import { TranslationMemoryRepository } from './translation-memory.repository';
import { loadPageBytes } from './page-source';
import { composeSeriesContext } from './series-context';
import { RedisService } from '../cache/redis.service';
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

// ─── MIT language helpers ────────────────────────────────────────────────────
/** Map MangaDex ISO language code → MIT target_lang / source_lang code.
 *  Every value must be a member of VALID_LANGUAGES in
 *  MIT/manga_translator/translators/common.py — pinned by
 *  mit-lang-map.spec.ts (#165: es/pt/vi had drifted to codes MIT rejects). */
export const MIT_LANG_MAP: Record<string, string> = {
  en: 'ENG', ja: 'JPN', ko: 'KOR',
  zh: 'CHS', 'zh-hk': 'CHT', 'zh-ro': 'CHS',
  fr: 'FRA', es: 'ESP', de: 'DEU', ru: 'RUS',
  pt: 'PTB', 'pt-br': 'PTB', it: 'ITA', vi: 'VIN',
  th: 'THA', id: 'IND', ar: 'ARA',
};
export function mitLangCode(isoLang: string): string {
  return MIT_LANG_MAP[isoLang.toLowerCase()] ?? isoLang.toUpperCase();
}

/** Parse a batch jobKey `chapterId:srcMIT:tgtMIT:model:derivative`. Splits from
 *  the RIGHT because a "ver:<uuid>" chapterId contains a colon — a left split
 *  would mis-parse it (chapterId="ver"). The last 4 segments are colon-free. */
export function parseJobKey(jobKey: string): {
  chapterId: string; srcMIT: string; tgtMIT: string; model: string; derivative: string;
} {
  const parts = jobKey.split(':');
  const derivative = parts.pop() ?? '';
  const model = parts.pop() ?? '';
  const tgtMIT = parts.pop() ?? '';
  const srcMIT = parts.pop() ?? '';
  return { chapterId: parts.join(':'), srcMIT, tgtMIT, model, derivative };
}

const GEMINI_LANG_NAME: Record<string, string> = {
  th: 'Thai', en: 'English', ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese (Simplified)', 'zh-hk': 'Chinese (Traditional)', 'zh-ro': 'Chinese (Romanized)',
  fr: 'French', es: 'Spanish', de: 'German', ru: 'Russian',
  pt: 'Portuguese', 'pt-br': 'Brazilian Portuguese', it: 'Italian',
  vi: 'Vietnamese', id: 'Indonesian', ar: 'Arabic',
};

function geminiLangName(isoLang: string): string {
  return GEMINI_LANG_NAME[isoLang.toLowerCase()] ?? isoLang;
}
/** RTL reading order — panels sort right→left for these original languages */
function isRtlLang(isoLang: string): boolean {
  return ['ja', 'ko', 'zh', 'zh-hk', 'zh-ro'].includes(isoLang.toLowerCase());
}

// ─── Batch job registry types ─────────────────────────────────────────────────
type PatchEntry = { xPct: number; yPct: number; wPct: number; hPct: number; url: string };
type PageResult = { patches: PatchEntry[]; error?: string };
type BatchPageListener = (pageIndex: number, result: PageResult) => void;

interface BatchJobState {
  /** Pages that have already been processed (cached + saved) */
  completedPages: Map<number, PageResult>;
  /** Pages currently being processed — prevents duplicate concurrent webhooks */
  processingPages: Set<number>;
  /** Active SSE listeners — removed on client disconnect */
  listeners: Set<BatchPageListener>;
  /** Direct reference to the original SSE caller — guaranteed delivery regardless of Redis state */
  originalListener?: BatchPageListener;
  /** Total active callers (Redis subscribers + job.listeners members). Used for
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

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  /** Active background batch-translate jobs keyed by "chapterId:srcMIT:tgtMIT" */
  private readonly activeBatchJobs = new Map<string, BatchJobState>();
  private geminiModelsCatalog: GeminiModel[] | null = null;
  private geminiModelsCatalogExpiresAt = 0;

  /** Single owner of Patch Set files (#137) — deterministic names, legacy sweep. */
  private readonly patchStore: PatchStore;
  private readonly translationMemory: TranslationMemoryRepository;

  constructor(
    private readonly mangaDex: MangaDexService,
    private readonly cache: CacheOrchestratorService,
    private readonly imageCache: ImageCacheService,
    private readonly supabase: SupabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Optional() private readonly redis?: RedisService,
  ) {
    this.patchStore = new PatchStore(this.storage, () => this.backendOrigin);
    // #160: translation memory rides the already-injected service-role client;
    // best-effort, so a missing/broken Supabase never affects translation.
    this.translationMemory = new TranslationMemoryRepository(this.supabase);
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

  /**
   * Handle an asynchronous callback from the MIT Server.
   * T4-STANDARD Pillar 2: Idempotent Webhook Processing.
   */
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
    try {
      job.originalListener?.(pageIndex, event);
    } catch {
      /* caller may be gone */
    }
    for (const l of job.listeners) {
      try {
        l(pageIndex, event);
      } catch {
        /* listener might have disconnected */
      }
    }
  }

  async handleMitCallback(
    jobKey: string,
    pageIndex: number,
    result: any,
    error?: string,
  ): Promise<void> {
    const job = this.activeBatchJobs.get(jobKey);
    if (!job) {
      this.logger.warn(`[Webhook] Received callback for unknown/expired job: ${jobKey}`);
      return;
    }

    // Idempotency: lock synchronously before any await to prevent concurrent duplicate webhooks
    if (job.completedPages.has(pageIndex) || job.processingPages?.has(pageIndex)) {
      this.logger.debug(`[Webhook] Skipping duplicate callback for job=${jobKey} page=${pageIndex}`);
      return;
    }
    job.processingPages?.add(pageIndex);

    // jobKey = chapterId:srcMIT:tgtMIT:model:derivative (model = 'default'
    // when unset; derivative = 'hd' | 'saver', #156)
    const { chapterId, srcMIT, tgtMIT, model: jobModel, derivative: jobDerivative } =
      parseJobKey(jobKey);

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
      const accepted: Array<{ x: number; y: number; w: number; h: number; buf: Buffer }> = [];
      for (const [i, p] of (result.patches || []).entries()) {
        if (p.img_b64.length > 5_000_000) {
          this.logger.warn(`[Webhook] patch ${i} for job=${jobKey} page=${pageIndex} exceeds size limit — skipped`);
          continue;
        }
        accepted.push({ x: p.x, y: p.y, w: p.w, h: p.h, buf: Buffer.from(p.img_b64, 'base64') });
      }

      const urls = await this.patchStore.put(
        { chapterId, pageIndex, srcMIT, tgtMIT, model: jobModel },
        accepted.map((a) => a.buf),
      );
      const patches: PatchEntry[] = accepted.map((a, i) => ({
        xPct: imgW > 0 ? a.x / imgW : 0,
        yPct: imgH > 0 ? a.y / imgH : 0,
        wPct: imgW > 0 ? a.w / imgW : 0,
        hPct: imgH > 0 ? a.h / imgH : 0,
        url: urls[i],
      }));

      // Cache the result — MUST be the same key the batch pre-check and the
      // single-page endpoint read (patchCacheKey), or webhook results are never
      // served from cache again (found live during the #87 v4 migration).
      const cacheKey = this.patchCacheKey(
        chapterId,
        pageIndex,
        srcMIT,
        tgtMIT,
        jobModel,
        jobDerivative === 'saver' ? 'saver' : 'hd',
      );
      await this.cache.set(cacheKey, { patches }, 1000 * 60 * 60 * 24 * 7); // 7 days

      // Translation memory (#160): persist this page's text layer (#158 regions).
      // Fire-and-forget — the repository swallows its own errors, so persistence
      // never adds latency to or fails page delivery (local-first).
      if (Array.isArray(result.regions) && result.regions.length > 0) {
        void this.translationMemory.savePageText(
          chapterId, pageIndex, tgtMIT, result.regions, jobModel,
        );
      }

      pageResult = { patches };
    }
    } catch (persistErr) {
      const msg = persistErr instanceof Error ? persistErr.message : String(persistErr);
      this.logger.error(`[Webhook] persistence failed job=${jobKey} page=${pageIndex}: ${msg}`);
      pageResult = { patches: [], error: `persistence failed: ${msg}` };
    }

    const published = await this.redis?.publish(`translate:${jobKey}`, { pageIndex, ...pageResult });
    if (this.redis && published === false) {
      this.logger.error(`[Webhook] Redis publish failed for job=${jobKey} page=${pageIndex}`);
    }
    job.processingPages?.delete(pageIndex);
    job.completedPages.set(pageIndex, pageResult);
    // Direct delivery to original SSE caller (guaranteed regardless of Redis state)
    try { job.originalListener?.(pageIndex, pageResult); } catch { /* caller may be gone */ }
    // Fan-out to latecomers
    for (const l of job.listeners) {
      try {
        l(pageIndex, pageResult);
      } catch {
        // Listener might have disconnected
      }
    }

    // Check if job is complete
    if (job.completedPages.size >= job.expectedCount) {
      // Report errored pages truthfully — an all-error batch used to log as
      // "fully completed", hiding a dead MIT worker (2026-06-06 incident).
      const errorPages = [...job.completedPages.values()].filter(
        (r) => r.error,
      );
      if (errorPages.length > 0) {
        this.logger.warn(
          `[Webhook] Job ${jobKey} completed via webhooks with ${errorPages.length}/${job.expectedCount} page errors (first: ${errorPages[0].error})`,
        );
      } else {
        this.logger.log(`[Webhook] Job ${jobKey} fully completed via webhooks`);
      }
      job.resolve?.();
    }
  }

  private get backendOrigin(): string {
    return (
      process.env.BACKEND_PUBLIC_ORIGIN ??
      `http://localhost:${process.env.PORT ?? 3001}`
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

  private normalizeGeminiModelName(model?: string | null): GeminiModel | null {
    const normalized = (model ?? '').trim().replace(/^models\//i, '');
    return normalized || null;
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
  private imageTranslatorCache: { value: string | null; expiresAt: number } | null = null;

  /** The translator family MIT actually runs (from /ready, #132) — e.g. 'qwen3'
   *  or 'gemini'. null when MIT is down, not ready, or predates #132; consumers
   *  treat null as "unknown" (Reader fails open — PRD #131). */
  async getImageTranslator(): Promise<string | null> {
    const now = Date.now();
    if (this.imageTranslatorCache && now < this.imageTranslatorCache.expiresAt) {
      return this.imageTranslatorCache.value;
    }
    let value: string | null = null;
    try {
      const mitBaseUrl = process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003';
      const res = await fetch(`${mitBaseUrl}/ready`, { signal: AbortSignal.timeout(3_000) });
      if (res.ok) {
        const body = (await res.json()) as { translator?: unknown };
        value = typeof body?.translator === 'string' && body.translator ? body.translator : null;
      }
    } catch {
      /* MIT down — degrade to unknown */
    }
    this.imageTranslatorCache = { value, expiresAt: now + 60_000 };
    return value;
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

  private shouldSendMitSourceLang(): boolean {
    const raw = (process.env.MIT_SEND_SOURCE_LANG ?? 'true').trim().toLowerCase();
    return !['false', '0', 'no', 'off'].includes(raw);
  }

  /** Resolve the MIT source/target language codes for a job. Single source of
   *  truth so the cache key and the batch jobKey are always built identically —
   *  a mismatch here silently breaks cancellation (the cancel path looks up a
   *  jobKey that the start path never registered). */
  private mitLangPair(sourceLang?: string, targetLang?: string): { srcMIT: string; tgtMIT: string } {
    const srcMIT = this.shouldSendMitSourceLang() && sourceLang ? mitLangCode(sourceLang) : 'ANY';
    const tgtMIT = mitLangCode(targetLang ?? 'th');
    return { srcMIT, tgtMIT };
  }

  /** Sanitize a user-supplied Gemini model name for use in the MIT config and
   *  cache/registry keys. Returns undefined for absent or unsafe values so the
   *  pipeline falls back to MIT's default model (#87). */
  private imageModelKey(imageModel?: string): string | undefined {
    const normalized = this.normalizeGeminiModelName(imageModel);
    return normalized && /^[\w.-]+$/.test(normalized) ? normalized : undefined;
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

  /** Single source of truth for the per-page patch cache key. v4 adds the model
   *  segment so different image-translation models never share cached patches
   *  (#87); old v3 entries expire naturally via TTL. */
  private patchCacheKey(
    chapterId: string,
    pageIndex: number,
    srcMIT: string,
    tgtMIT: string,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
  ): string {
    const model = this.imageModelKey(imageModel) ?? 'default';
    // v5: keyed by display derivative (#156). v6: series context (#157)
    // changes translations — context-aware and context-free patches never mix.
    // v7: include a hash of the MIT render/pipeline knobs so that changing a render
    // env (font, anti-overlap, sizes, SFX, …) busts the cache instead of silently
    // serving the previously-rendered patches.
    return `translate:manga-patches:v7:${chapterId}:${pageIndex}:${srcMIT}:${tgtMIT}:${model}:${derivative}:${this.renderConfigHash()}`;
  }

  /** Short hash of every MIT_* env knob (the render/pipeline config). Two deployments
   * with different render settings get different patch-cache keys, and toggling a knob
   * invalidates the cache for that page — so a config change is visible on the next
   * translate instead of replaying stale patches. */
  private renderConfigHash(): string {
    const knobs = Object.keys(process.env)
      .filter((k) => k.startsWith('MIT_'))
      .sort()
      .map((k) => `${k}=${process.env[k] ?? ''}`)
      .join('\n');
    return createHash('sha1').update(knobs).digest('hex').slice(0, 10);
  }

  /** The registry key for a batch-translate job. MUST be built via mitLangPair
   *  on every path (start, attach, remove) or cancellation breaks. Includes the
   *  image model so two model selections for the same chapter never collide. */
  private buildJobKey(
    chapterId: string,
    sourceLang?: string,
    targetLang?: string,
    imageModel?: string,
    derivative: 'hd' | 'saver' = 'hd',
  ): string {
    const { srcMIT, tgtMIT } = this.mitLangPair(sourceLang, targetLang);
    return `${chapterId}:${srcMIT}:${tgtMIT}:${this.imageModelKey(imageModel) ?? 'default'}:${derivative}`;
  }

  /**
   * Build the MIT pipeline config JSON. Single source of truth for the single-page
   * and batch paths so the VRAM/perf knobs never drift between them.
   *
   * Detection/inpainting are the dominant VRAM + latency drivers (activation memory
   * ∝ size²). The defaults match MIT's own tuned Config values (detection 2560,
   * inpainting 2048) — #247: shipping them lower silently dropped small/faint text
   * and blurred the erased plate. They stay env-overridable so a VRAM-tight host can
   * drop them without a redeploy (it IS a quality cut — raise where the GPU allows):
   *   MIT_DETECTION_SIZE     (default 2560)   — text detection resolution
   *   MIT_INPAINTING_SIZE    (default 2048)   — LaMa inpaint resolution
   *   MIT_INPAINTER          (default lama_large)
   *   MIT_INPAINTING_PRECISION (default bf16) — fp32 | fp16 | bf16 (LaMa is a CNN;
   *                                             it has no int4/int8 path — that knob
   *                                             only applies to the local LLM
   *                                             translator via QWEN3_PRECISION).
   *
   * #167 rescue knobs (all opt-in; unset = config identical to before):
   *   MIT_OCR_PROB            — OCR confidence floor in (0,1]. The 48px OCR is
   *                             underconfident on long thin lines and drops text
   *                             it read almost correctly; 0.03 recovers the
   *                             measured worst page (lowest real line = 0.035).
   *   MIT_TEXT_THRESHOLD      — detector text threshold in (0,1]
   *   MIT_DET_INVERT=1        — inverted detection pass (white-on-black text)
   *   MIT_DET_GAMMA_CORRECT=1 — gamma correction before detection
   *
   * #170 bubble segmentation (opt-in; unset = config identical to before):
   *   MIT_BUBBLE_SEG=1        — run a speech-balloon YOLO alongside DBNet and
   *                             tag each text-line region with its balloon mask
   *                             (renderer area, mask-aware crop, OCR scoping).
   */
  private buildMitConfig(srcMIT: string, tgtMIT: string, sourceIso: string, imageModel?: string, seriesContext?: string): string {
    const intEnv = (name: string, fallback: number): number => {
      const n = Number(process.env[name]);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    };
    // #167 rescue knobs — opt-in fractions in (0, 1]; absent/invalid env
    // leaves the config byte-identical to today.
    const fracEnv = (name: string): number | undefined => {
      const n = Number(process.env[name]);
      return Number.isFinite(n) && n > 0 && n <= 1 ? n : undefined;
    };
    const flagEnv = (name: string): boolean => process.env[name] === '1';
    // #166 render knobs: offset may be negative; minimum is a positive px floor.
    const signedIntEnv = (name: string): number | undefined => {
      const raw = process.env[name];
      if (raw === undefined) return undefined;
      const n = Number(raw);
      return Number.isInteger(n) ? n : undefined;
    };
    const posIntEnv = (name: string): number | undefined => {
      const n = signedIntEnv(name);
      return n !== undefined && n > 0 ? n : undefined;
    };
    const ocrProb = fracEnv('MIT_OCR_PROB');
    const textThreshold = fracEnv('MIT_TEXT_THRESHOLD');
    const fontSizeOffset = signedIntEnv('MIT_FONT_SIZE_OFFSET');
    const fontSizeMin = posIntEnv('MIT_FONT_SIZE_MIN');
    const supersampling = posIntEnv('MIT_SUPERSAMPLING');
    const fontMaxBoxRatio = fracEnv('MIT_FONT_MAX_BOX_RATIO');
    const patchFeather = posIntEnv('MIT_PATCH_FEATHER');
    const inpaintContextPad = posIntEnv('MIT_INPAINT_CONTEXT_PAD');
    const fontSizeMax = posIntEnv('MIT_FONT_SIZE_MAX');
    const model = this.imageModelKey(imageModel);
    return JSON.stringify({
      translator: {
        target_lang: tgtMIT,
        ...(srcMIT !== 'ANY' ? { source_lang: srcMIT, source_lang_only: true } : {}),
        // Per-request Gemini model override (#87); MIT falls back to its
        // GEMINI_MODEL env when absent.
        ...(model ? { model } : {}),
        // Series context (#157): MIT appends this to the translator system
        // prompt so the model knows which manga it is translating. Absent →
        // prompt identical to the context-free behavior.
        ...(seriesContext ? { series_context: seriesContext } : {}),
      },
      detector: {
        // #247: match MIT's own tuned Config default (2560). 2048 silently
        // dropped small/faint glyphs below DBNet's threshold (~36% fewer px),
        // leaving original text untranslated. Env still drops it for tight VRAM.
        detection_size: intEnv('MIT_DETECTION_SIZE', 2560),
        ...(textThreshold !== undefined ? { text_threshold: textThreshold } : {}),
        ...(flagEnv('MIT_DET_INVERT') ? { det_invert: true } : {}),
        ...(flagEnv('MIT_DET_GAMMA_CORRECT') ? { det_gamma_correct: true } : {}),
        // Bubble segmentation (#170): run a speech-balloon YOLO alongside DBNet
        // and tag each text-line region with its balloon mask, so the renderer
        // can size text to the balloon area. Absent → stage off, byte-identical.
        ...(flagEnv('MIT_BUBBLE_SEG') ? { det_bubble_seg: true } : {}),
        // SFX detector (#168): second YOLO pass for stylized katakana SFX that
        // DBNet can't see. Absent → stage off, byte-identical.
        ...(flagEnv('MIT_SFX_DETECTOR') ? { det_sfx: true } : {}),
      },
      // OCR prob floor (#167): the 48px OCR is underconfident on long thin
      // lines — at the default threshold it drops lines it read almost
      // correctly, leaving the original text visible in the Reader.
      // vlm_rescue (#168/#172): large regions the 48px drops (stylized SFX) get
      // re-read by the custom_openai/9arm vision gateway. Absent → byte-identical.
      ...(ocrProb !== undefined || flagEnv('MIT_OCR_VLM_RESCUE')
        ? {
            ocr: {
              ...(ocrProb !== undefined ? { prob: ocrProb } : {}),
              ...(flagEnv('MIT_OCR_VLM_RESCUE') ? { vlm_rescue: true } : {}),
            },
          }
        : {}),
      inpainter: {
        inpainter: process.env.MIT_INPAINTER ?? 'lama_large',
        // #247: match MIT's tuned Config default (2048). 1536 downscaled pages
        // before the LaMa erase then upscaled back → blurrier plate / screentone
        // smear. Env still drops it for tight VRAM (it IS a quality cut).
        inpainting_size: intEnv('MIT_INPAINTING_SIZE', 2048),
        inpainting_precision: process.env.MIT_INPAINTING_PRECISION ?? 'bf16',
        // #249: inpaint a crop expanded by N px (patch path) so LaMa sees real
        // background instead of a starved tight crop. Absent → tight, byte-identical.
        ...(inpaintContextPad !== undefined ? { inpaint_context_pad: inpaintContextPad } : {}),
      },
      render: {
        direction: 'auto',
        rtl: isRtlLang(sourceIso),
        // Font-size fidelity (#166): the renderer's auto floor (img.h+img.w)/200
        // is tiny in patch mode (computed from the crop). Absent → render
        // identical to the auto behavior.
        ...(fontSizeOffset !== undefined ? { font_size_offset: fontSizeOffset } : {}),
        ...(fontSizeMin !== undefined ? { font_size_minimum: fontSizeMin } : {}),
        // Bubble area-fit sizing (#166): size each region's font to its balloon
        // area (#170 bubble_box) instead of the source textline column. Needs
        // MIT_BUBBLE_SEG to supply the masks. Absent → byte-identical.
        ...(flagEnv('MIT_BUBBLE_AREA_FIT') ? { bubble_area_fit: true } : {}),
        // Anti-overlap: clamp each region's fit box against its neighbours so
        // translated text can't grow into the adjacent bubble. Absent → byte-identical.
        ...(flagEnv('MIT_ANTI_OVERLAP') ? { anti_overlap: true } : {}),
        // Cap narration/caption font (SFX exempt) so it can't oversize/overflow the
        // panel. Absent → no cap, byte-identical.
        ...(fontSizeMax !== undefined ? { font_size_max: fontSizeMax } : {}),
        // Clean horizontal layout: lay non-balloon, non-SFX text out as an upright
        // block at a small absolute font (font_size_max, else page-scaled) instead of
        // warping it onto the original vertical-JP quad (which stretches it oversized).
        // Absent → byte-identical.
        ...(flagEnv('MIT_CLEAN_LAYOUT') ? { clean_layout: true } : {}),
        // #176: render Latin/EN targets in the bundled comic font instead of the
        // worker's Prompt-Bold (a Thai face). Absent → byte-identical.
        ...(flagEnv('MIT_EN_COMIC_FONT') ? { en_comic_font: true } : {}),
        // #181: text supersampling factor (render Nx then downscale). Absent → 1.
        ...(supersampling !== undefined ? { supersampling } : {}),
        // Render-parity A: ALL-CAPS lettering (MangaTranslator pipeline.py:1375).
        // The MIT renderer already honors render.uppercase. Absent → byte-identical.
        ...(flagEnv('MIT_EN_UPPERCASE') ? { uppercase: true } : {}),
        // Render-parity C: raise the #175 bubble-fit font cap (0.5·balloon height)
        // so text fills the balloon. Fraction in (0,1]. Absent → byte-identical.
        ...(fontMaxBoxRatio !== undefined ? { font_max_box_ratio: fontMaxBoxRatio } : {}),
        // Render-parity B: override the EN face by filename in fonts/ (operator-set,
        // MangaTranslator BYO font). Absent → byte-identical.
        ...(process.env.MIT_EN_FONT ? { en_font: process.env.MIT_EN_FONT } : {}),
        // #173: feather the outer N px of each patch to a transparent alpha so the
        // patch edge blends into the page (no rectangular seam). Absent → hard alpha,
        // byte-identical.
        ...(patchFeather !== undefined ? { patch_feather_radius: patchFeather } : {}),
      },
    });
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

  async checkMitHealth(): Promise<{ available: boolean; url: string; message?: string }> {
    const baseUrl = process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003';
    try {
      const res = await fetch(`${baseUrl}/ready`, {
        signal: AbortSignal.timeout(5_000),
      });
      return { available: res.ok, url: baseUrl };
    } catch (err) {
      this.logger.warn(`[MangaTranslate] Health check failed: ${String(err)}`);
      return { available: false, url: baseUrl, message: String(err) };
    }
  }

  

  async translateMangaPagePatches(
    chapterId: string,
    pageIndex: number,
    pageUrl: string,
    sourceLang?: string,
    targetLang?: string,
    opts?: { maxStartupRetries?: number; imageModel?: string; derivative?: 'hd' | 'saver'; mangaId?: string },
  ): Promise<{ patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }> }> {
    if (!chapterId || !pageUrl) {
      throw new Error('chapterId and pageUrl are required');
    }

    const { srcMIT, tgtMIT } = this.mitLangPair(sourceLang, targetLang);
    const cacheKey = this.patchCacheKey(chapterId, pageIndex, srcMIT, tgtMIT, opts?.imageModel, opts?.derivative ?? 'hd');
    const cached = await this.cache.get<{ patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }> }>(cacheKey);
    if (cached?.data?.patches) {
      return cached.data;
    }

    const mitUrl =
      (process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003') +
      '/translate/with-form/patches';

    // Load the source page — display-derivative aware (#156): /img-cache paths
    // are read straight from disk so the patch is generated from byte-identical
    // content to what the Reader displays; external URLs are fetched.
    const imgBuffer = await loadPageBytes(pageUrl, { imgCacheRoot: 'img-cache', uploadsRoot: 'uploads' });

    const config = this.buildMitConfig(srcMIT, tgtMIT, sourceLang ?? '', opts?.imageModel, await this.seriesContextFor(opts?.mangaId));

    const maxStartupRetries = opts?.maxStartupRetries ?? 30;
    const startupRetryDelayMs = 5_000;

    let mitRes: Response | null = null;
    let lastErrText = '';

    for (let attempt = 0; attempt <= maxStartupRetries; attempt += 1) {
      const form = new FormData();
      form.append('image', new Blob([new Uint8Array(imgBuffer)], { type: 'image/jpeg' }), 'page.jpg');
      form.append('config', config);

      try {
        mitRes = await fetch(mitUrl, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(300_000),
        });
      } catch (err) {
        const msg = String(err);
        if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
          throw new Error(`manga-image-translator service unavailable`);
        }
        if (msg.includes('AbortError') || msg.includes('abort') || msg.includes('timed out')) {
          throw new Error(`manga-image-translator timed out after 5 minutes`);
        }
        throw err;
      }

      if (mitRes.ok) break;

      const errText = await mitRes.text().catch(() => '');
      lastErrText = errText;
      this.logger.warn(`[MangaPatches] MIT HTTP ${mitRes.status} body: ${errText.slice(0, 300)}`);

      if (mitRes.status !== 500 || attempt === maxStartupRetries) {
        throw new Error(`manga-image-translator error: HTTP ${mitRes.status} — ${errText.slice(0, 200)}`);
      }

      this.logger.warn(
        `[MangaPatches] MIT not ready (attempt ${attempt + 1}/${maxStartupRetries + 1}), retrying in ${startupRetryDelayMs / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, startupRetryDelayMs));
    }

    if (!mitRes || !mitRes.ok) {
      throw new Error(`manga-image-translator error: startup retries exhausted — ${lastErrText.slice(0, 200)}`);
    }

    const patchData = (await mitRes.json()) as {
      img_width: number;
      img_height: number;
      patches: Array<{ x: number; y: number; w: number; h: number; img_b64: string }>;
    };

    // Persist the Patch Set via PatchStore (#137 — deterministic names, no orphans)
    const { img_width: imgW, img_height: imgH } = patchData;
    const urls = await this.patchStore.put(
      { chapterId, pageIndex, srcMIT, tgtMIT, model: this.imageModelKey(opts?.imageModel) },
      patchData.patches.map((p) => Buffer.from(p.img_b64, 'base64')),
    );
    const patches = patchData.patches.map((p, i) => ({
      xPct: imgW > 0 ? p.x / imgW : 0,
      yPct: imgH > 0 ? p.y / imgH : 0,
      wPct: imgW > 0 ? p.w / imgW : 0,
      hPct: imgH > 0 ? p.h / imgH : 0,
      url: urls[i],
    }));

    const result = { patches };
    await this.cache.setMangaCacheWithTiers(cacheKey, result);

    this.logger.log(
      `[MangaPatches] chapter=${chapterId} page=${pageIndex} → ${patches.length} patches`,
    );

    return result;
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
    const jobKey = this.buildJobKey(chapterId, sourceLang, targetLang, imageModel, derivative);
    const job = this.activeBatchJobs.get(jobKey);
    if (job) {
      job.listeners.delete(listener);
      job.activeCallerCount = Math.max(0, job.activeCallerCount - 1);
      this.logger.log(`[BatchRegistry] job=${jobKey} − listener removed (${job.activeCallerCount} active callers remaining)`);
      if (job.activeCallerCount === 0) {
        this.logger.log(`[BatchRegistry] job=${jobKey} last caller gone — cancelling MIT job`);
        job.cancelController.abort();
        // Tell MIT to stop the in-flight background batch for this taskId so it
        // doesn't keep burning GPU on a job nobody is listening to. Best-effort,
        // fire-and-forget; MIT no-ops an unknown/finished taskId.
        const mitBaseUrl = process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003';
        void fetch(`${mitBaseUrl}/cancel/${encodeURIComponent(jobKey)}`, { method: 'POST' }).catch(
          (err) =>
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
    const jobKey = this.buildJobKey(chapterId, sourceLang, targetLang, imageModel, derivative);

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
      // Original caller is always delivered directly via originalListener (no Redis dependency).
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
          this.patchCacheKey(chapterId, p.pageIndex, srcMIT, tgtMIT, imageModel, derivative),
        ),
      ),
    );
    const uncachedPages: Array<{ pageIndex: number; pageUrl: string }> = [];
    pages.forEach((p, i) => {
      const cached = cachedResults[i];
      if (cached?.data?.patches) {
        // Serve from cache immediately — direct call, no Redis needed
        listener(p.pageIndex, { patches: cached.data.patches });
      } else {
        uncachedPages.push(p);
      }
    });

    if (uncachedPages.length === 0) {
      this.logger.log(`[BatchRegistry] job=${jobKey} all ${pages.length} pages were cached — skipping MIT`);
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

    // Redis pub/sub is used only for cross-instance fan-out (horizontal scale).
    // Original caller on this instance is delivered directly via originalListener.
    const unsubscribeRedis = (() => {}) as () => void;

    // 3. Inner notify: direct delivery to original caller + Redis cross-instance fan-out + latecomers
    const notify = (pageIndex: number, result: PageResult) => {
      job.completedPages.set(pageIndex, result);
      // Direct, synchronous delivery to original SSE caller — no Redis dependency
      try { job.originalListener?.(pageIndex, result); } catch { /* listener may be gone */ }
      // Cross-instance broadcast (for future multi-node setups)
      void this.redis?.publish(`translate:${jobKey}`, { pageIndex, ...result });
      // Fan-out to latecomers who attached to this job
      for (const l of job.listeners) {
        try {
          l(pageIndex, result);
        } catch {
          /* listener may be gone */
        }
      }
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
        if (job.completedPages.size >= job.expectedCount) {
          job.resolve?.();
        }
      })
      .catch((err) => {
        job.reject?.(err);
      });

    // Guarantee the promise is eventually settled so activeBatchJobs never leaks.
    const timeoutHandle = setTimeout(
      () => job.reject?.(new Error(`[BatchRegistry] job=${jobKey} timed out after 15 minutes`)),
      15 * 60 * 1000,
    );
    job.cancelController.signal.addEventListener('abort', () => {
      job.reject?.(new Error(`[BatchRegistry] job=${jobKey} cancelled`));
    });

    this.logger.log(`[BatchRegistry] job=${jobKey} started (${uncachedPages.length} pages to process)`);

    try {
      await promise;
    } finally {
      clearTimeout(timeoutHandle);
      unsubscribeRedis();
      job.originalListener = undefined;
      if (this.activeBatchJobs.get(jobKey) === job) {
        this.activeBatchJobs.delete(jobKey);
        this.logger.log(`[BatchRegistry] job=${jobKey} completed & removed from registry`);
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
    const mitBaseUrl = process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003';
    const mitUrl = `${mitBaseUrl}/translate/with-form/patches/batch`;

    // ── 1. Fetch all source images in parallel ─────────────────────────────
    let imageBuffers: Buffer[];
    try {
      imageBuffers = await Promise.all(
        // Display-derivative aware (#156): /img-cache paths read from disk,
        // external URLs fetched (cancellable via the job signal).
        pages.map(({ pageUrl }) => loadPageBytes(pageUrl, { imgCacheRoot: 'img-cache', uploadsRoot: 'uploads', signal })),
      );
    } catch (err) {
      if (signal.aborted) {
        this.logger.log(`[BatchPatches] chapter=${chapterId} cancelled during image fetch`);
        return;
      }
      throw err;
    }

    // ── 2. Build multipart form ───────────────────────────────────────────
    const mitConfig = this.buildMitConfig(srcMIT, tgtMIT, sourceLangIso ?? '', imageModel, await this.seriesContextFor(mangaId));

    const form = new FormData();
    for (const buf of imageBuffers) {
      form.append('images', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'page.jpg');
    }
    form.append('config', mitConfig);
    form.append('page_indices', pages.map((p) => p.pageIndex).join(','));

    // T4-STANDARD Pillar 2: Asynchronous Fire-and-forget preparation
    // Pass taskId and callbackUrl to MIT Server
    form.append('taskId', taskId);
    form.append('callback_url', `${this.mitCallbackOrigin}/webhooks/mit/callback`);
    if (process.env.MIT_WEBHOOK_SECRET) {
      form.append('callback_secret', process.env.MIT_WEBHOOK_SECRET);
    }

    // ── 3. POST to MIT ────────────────────────────────────────────────────────
    // Do NOT pass the cancel signal here — once MIT accepts the job it processes
    // asynchronously and sends webhook callbacks even if the SSE caller disconnects.
    // Passing the signal would kill the TCP connection to MIT mid-POST, causing
    // MIT's BLAS/Fortran runtime to crash (forrtl error 200: window-CLOSE event).
    if (signal.aborted) {
      this.logger.log(`[BatchPatches] chapter=${chapterId} cancelled before MIT submit`);
      return;
    }
    let mitRes: Response;
    try {
      mitRes = await fetch(mitUrl, { method: 'POST', body: form });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[BatchPatches] chapter=${chapterId} MIT batch fetch failed: ${msg}`);
      await this._retryMissingPagesIndividually(chapterId, pages, new Set<number>(), notify, sourceLangIso, targetLangIso, imageModel, undefined, derivative, mangaId);
      return;
    }

    // Handle Async Acceptance (202 Accepted)
    if (mitRes.status === 202 || mitRes.status === 200) {
      const contentType = mitRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await mitRes.json().catch(() => ({}));
        if (body.status === 'accepted') {
          this.logger.log(`[BatchPatches] chapter=${chapterId} MIT accepted job async with taskId=${taskId}`);
          return; // The webhook will handle the rest of the results
        }
      }
    }

    if (!mitRes.ok || !mitRes.body) {
      const errText = await mitRes.text().catch(() => '');
      this.logger.warn(`[BatchPatches] chapter=${chapterId} MIT HTTP ${mitRes.status}: ${errText.slice(0, 200)}`);
      await this._retryMissingPagesIndividually(chapterId, pages, new Set<number>(), notify, sourceLangIso, targetLangIso, imageModel, undefined, derivative, mangaId);
      return;
    }

    // ── 4. Read NDJSON stream, save patches, cache, notify ────────────────
    const reader = (mitRes.body as unknown as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let lineBuf = '';
    let receivedCount = 0;
    const expectedCount = pages.length;
    const processedPageIndexes = new Set<number>();
    const pageUrlByIndex = new Map(pages.map((p) => [p.pageIndex, p.pageUrl]));

    const streamReadTimeoutMs = Math.max(30_000, Number(process.env.MIT_BATCH_STREAM_READ_TIMEOUT_MS ?? 90_000));
    const readWithTimeout = async () => {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`MIT stream read timeout after ${streamReadTimeoutMs}ms`)), streamReadTimeoutMs);
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
              patches: Array<{ x: number; y: number; w: number; h: number; img_b64: string }>;
              error: string | null;
            };

            if (typeof data.pageIndex !== 'number' || Number.isNaN(data.pageIndex)) {
              continue;
            }

            if (data.error) {
              this.logger.warn(`[BatchPatches] chapter=${chapterId} page=${data.pageIndex} error: ${data.error}`);
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
            const pageUrls = await this.patchStore.put(
              { chapterId, pageIndex: data.pageIndex, srcMIT, tgtMIT, model: this.imageModelKey(imageModel) },
              data.patches.map((p) => Buffer.from(p.img_b64, 'base64')),
            );
            let patches: PatchEntry[] = data.patches.map((p, i) => ({
              xPct: imgW > 0 ? p.x / imgW : 0,
              yPct: imgH > 0 ? p.y / imgH : 0,
              wPct: imgW > 0 ? p.w / imgW : 0,
              hPct: imgH > 0 ? p.h / imgH : 0,
              url: pageUrls[i],
            }));

            if (patches.length === 0 && srcMIT !== 'ANY') {
              const pageUrl = pageUrlByIndex.get(data.pageIndex);
              if (pageUrl) {
                try {
                  const fallback = await this.translateMangaPagePatches(
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
                    patches = fallback.patches;
                  }
                } catch (fallbackErr) {
                  this.logger.warn(
                    `[BatchPatches] chapter=${chapterId} page=${data.pageIndex} fallback(no source filter) failed: ${String(fallbackErr)}`,
                  );
                }
              }
            }

            // Cache so single-page endpoint & future batch requests skip MIT
            const cacheKey = this.patchCacheKey(chapterId, data.pageIndex, srcMIT, tgtMIT, imageModel, derivative);
            await this.cache.setMangaCacheWithTiers(cacheKey, { patches });

            this.logger.log(`[BatchPatches] chapter=${chapterId} page=${data.pageIndex} → ${patches.length} patches`);
            notify(data.pageIndex, { patches });

            if (!processedPageIndexes.has(data.pageIndex)) {
              processedPageIndexes.add(data.pageIndex);
              receivedCount++;
              if (receivedCount >= expectedCount) break outer;
            }
          } catch {
            this.logger.warn(`[BatchPatches] NDJSON parse failed: ${line.slice(0, 120)}`);
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
      this.logger.warn(`[BatchPatches] chapter=${chapterId} stream interrupted: ${streamFailedError}`);
    }

    // Release reader to free underlying TCP resources
    reader.cancel().catch(() => {});

    // ── 6. Auto-recover missing pages (if stream dropped/skipped randomly) ──
    if (streamFailedError) {
      this.logger.warn(`[BatchPatches] chapter=${chapterId} continuing with per-page fallback after stream failure`);
    }
    await this._retryMissingPagesIndividually(chapterId, pages, processedPageIndexes, notify, sourceLangIso, targetLangIso, imageModel, undefined, derivative, mangaId);
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
    const missingPages = pages.filter((p) => !processedPageIndexes.has(p.pageIndex));
    if (missingPages.length > 0) {
      this.logger.warn(`[BatchPatches] chapter=${chapterId} missing ${missingPages.length} pages; retrying individually`);
    }

    let recovered = 0;
    let failed = 0;

    for (const missing of missingPages) {
      if (signal?.aborted) break;
      try {
        const single = await this.translateMangaPagePatches(
          chapterId, missing.pageIndex, missing.pageUrl, sourceLangIso, targetLangIso,
          { maxStartupRetries: 3, imageModel, derivative, mangaId },
        );
        notify(missing.pageIndex, { patches: single.patches });
        recovered += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[BatchPatches] fallback failed chapter=${chapterId} page=${missing.pageIndex}: ${msg}`);
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
    const listener: BatchPageListener = (pageIndex, result) => onPage({ pageIndex, ...result });
    return this.startOrAttachBatchJob(chapterId, pages, listener);
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

