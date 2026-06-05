import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { ImageCacheService } from '../cache/image-cache.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MangaDexService } from './mangadex.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../common/storage/storage-provider.interface';
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
/** Map MangaDex ISO language code → MIT target_lang / source_lang code */
const MIT_LANG_MAP: Record<string, string> = {
  en: 'ENG', ja: 'JPN', ko: 'KOR',
  zh: 'CHS', 'zh-hk': 'CHT', 'zh-ro': 'CHS',
  fr: 'FRA', es: 'SPA', de: 'DEU', ru: 'RUS',
  pt: 'POR', 'pt-br': 'POR', it: 'ITA', vi: 'VIE',
  th: 'THA', id: 'IND', ar: 'ARA',
};
function mitLangCode(isoLang: string): string {
  return MIT_LANG_MAP[isoLang.toLowerCase()] ?? isoLang.toUpperCase();
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

  constructor(
    private readonly mangaDex: MangaDexService,
    private readonly cache: CacheOrchestratorService,
    private readonly imageCache: ImageCacheService,
    private readonly supabase: SupabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Optional() private readonly redis?: RedisService,
  ) {}

  /**
   * Handle an asynchronous callback from the MIT Server.
   * T4-STANDARD Pillar 2: Idempotent Webhook Processing.
   */
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

    const chapterId = jobKey.split(':')[0];
    const srcMIT = jobKey.split(':')[1];
    const tgtMIT = jobKey.split(':')[2];

    let pageResult: PageResult;

    if (error) {
      pageResult = { patches: [], error };
    } else {
      // Process patches (save to storage and cache)
      const patchDir = `uploads/patches/${chapterId}`;

      const imgW = result.imgWidth > 0 ? result.imgWidth : 0;
      const imgH = result.imgHeight > 0 ? result.imgHeight : 0;
      const patches: PatchEntry[] = [];
      for (const [i, p] of (result.patches || []).entries()) {
        if (p.img_b64.length > 5_000_000) {
          this.logger.warn(`[Webhook] patch ${i} for job=${jobKey} page=${pageIndex} exceeds size limit — skipped`);
          continue;
        }
        const patchFilename = `${pageIndex}_${i}_${randomBytes(4).toString('hex')}.png`;
        const key = `${patchDir}/${patchFilename}`;
        const patchBuf = Buffer.from(p.img_b64, 'base64');

        await this.storage.put(key, patchBuf, { contentType: 'image/png' });

        patches.push({
          xPct: imgW > 0 ? p.x / imgW : 0,
          yPct: imgH > 0 ? p.y / imgH : 0,
          wPct: imgW > 0 ? p.w / imgW : 0,
          hPct: imgH > 0 ? p.h / imgH : 0,
          url: `${this.backendOrigin}/${key}`,
        });
      }

      // Cache the result
      const cacheKey = `translate:manga-patches:v3:${chapterId}:${pageIndex}:${srcMIT}:${tgtMIT}`;
      await this.cache.set(cacheKey, { patches }, 1000 * 60 * 60 * 24 * 7); // 7 days

      pageResult = { patches };
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
      this.logger.log(`[Webhook] Job ${jobKey} fully completed via webhooks`);
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

  private shouldSendMitSourceLang(): boolean {
    const raw = (process.env.MIT_SEND_SOURCE_LANG ?? 'true').trim().toLowerCase();
    return !['false', '0', 'no', 'off'].includes(raw);
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

    for (const line of uniqueLines) {
      const hash = createHash('sha1').update(`${line}|${cacheScope}`).digest('hex').slice(0, 24);
      for (const modelName of modelCandidates) {
        const cacheKey = `translate:manga:v1:${modelName}:${hash}`;
        const cached = await this.cache.get<{ text: string }>(cacheKey);
        if (!cached?.data?.text) continue;
        translatedByUnique.set(line, cached.data.text);
        fromCache += 1;
        break;
      }
    }

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

          for (let idx = 0; idx < missingLines.length; idx += 1) {
            const source = missingLines[idx];
            const translated = (parsed[idx] ?? source).trim() || source;
            translatedByUnique.set(source, translated);

            const hash = createHash('sha1').update(`${source}|${cacheScope}`).digest('hex').slice(0, 24);
            const cacheKey = `translate:manga:v1:${modelName}:${hash}`;
            await this.cache.setMangaCacheWithTiers(cacheKey, { text: translated });
          }

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
    opts?: { maxStartupRetries?: number },
  ): Promise<{ patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }> }> {
    if (!chapterId || !pageUrl) {
      throw new Error('chapterId and pageUrl are required');
    }

    const sendSourceLang = this.shouldSendMitSourceLang();
    const srcMIT = sendSourceLang && sourceLang ? mitLangCode(sourceLang) : 'ANY';
    const tgtMIT = mitLangCode(targetLang ?? 'th');
    const cacheKey = `translate:manga-patches:v3:${chapterId}:${pageIndex}:${srcMIT}:${tgtMIT}`;
    const cached = await this.cache.get<{ patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }> }>(cacheKey);
    if (cached?.data?.patches) {
      return cached.data;
    }

    const mitUrl =
      (process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003') +
      '/translate/with-form/patches';

    // Fetch original manga page image
    const imgRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MangaDock/1.0)',
        'Referer': 'https://mangadex.org/',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch page image: HTTP ${imgRes.status}`);
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const config = JSON.stringify({
      translator: {
        target_lang: tgtMIT,
        ...(srcMIT !== 'ANY' ? { source_lang: srcMIT, source_lang_only: true } : {}),
      },
      inpainter: { inpainter: 'lama_large' },
      render: { direction: 'auto', rtl: isRtlLang(sourceLang ?? '') },
    });

    const maxStartupRetries = opts?.maxStartupRetries ?? 30;
    const startupRetryDelayMs = 5_000;

    let mitRes: Response | null = null;
    let lastErrText = '';

    for (let attempt = 0; attempt <= maxStartupRetries; attempt += 1) {
      const form = new FormData();
      form.append('image', new Blob([imgBuffer], { type: 'image/jpeg' }), 'page.jpg');
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

    // Save each patch PNG to storage
    const { img_width: imgW, img_height: imgH } = patchData;
    const patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }> = [];

    for (let i = 0; i < patchData.patches.length; i += 1) {
      const p = patchData.patches[i];
      const pngBuf = Buffer.from(p.img_b64, 'base64');
      const filename = `${chapterId}-${srcMIT}-${tgtMIT}-p${pageIndex}-r${i}.png`;
      const key = `uploads/patches/${chapterId}/${filename}`;
      
      await this.storage.put(key, pngBuf, { contentType: 'image/png' });

      patches.push({
        xPct: imgW > 0 ? p.x / imgW : 0,
        yPct: imgH > 0 ? p.y / imgH : 0,
        wPct: imgW > 0 ? p.w / imgW : 0,
        hPct: imgH > 0 ? p.h / imgH : 0,
        url: `${this.backendOrigin}/${key}`,
      });
    }

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
  ): void {
    const jobKey = `${chapterId}:${sourceLang ? mitLangCode(sourceLang) : 'ANY'}:${mitLangCode(targetLang ?? 'th')}`;
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
  ): Promise<void> {
    const sendSourceLang = this.shouldSendMitSourceLang();
    const srcMIT = sendSourceLang && sourceLang ? mitLangCode(sourceLang) : 'ANY';
    const tgtMIT = mitLangCode(targetLang ?? 'th');
    const jobKey = `${chapterId}:${srcMIT}:${tgtMIT}`;

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

    const uncachedPages: Array<{ pageIndex: number; pageUrl: string }> = [];
    for (const p of pages) {
      const cacheKey = `translate:manga-patches:v3:${chapterId}:${p.pageIndex}:${srcMIT}:${tgtMIT}`;
      const cached = await this.cache.get<{ patches: PatchEntry[] }>(cacheKey);
      if (cached?.data?.patches) {
        // Serve from cache immediately — direct call, no Redis needed
        listener(p.pageIndex, { patches: cached.data.patches });
      } else {
        uncachedPages.push(p);
      }
    }

    if (uncachedPages.length === 0) {
      this.logger.log(`[BatchRegistry] job=${jobKey} all ${pages.length} pages were cached — skipping MIT`);
      placeholderJob.resolve?.();
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
  ): Promise<void> {
    const mitBaseUrl = process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003';
    const mitUrl = `${mitBaseUrl}/translate/with-form/patches/batch`;

    // ── 1. Fetch all source images in parallel ─────────────────────────────
    let imageBuffers: Buffer[];
    try {
      imageBuffers = await Promise.all(
        pages.map(async ({ pageUrl }) => {
          const imgRes = await fetch(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MangaDock/1.0)',
              'Referer': 'https://mangadex.org/',
            },
            signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
          });
          if (!imgRes.ok) throw new Error(`Failed to fetch page image: HTTP ${imgRes.status}`);
          return Buffer.from(await imgRes.arrayBuffer());
        }),
      );
    } catch (err) {
      if (signal.aborted) {
        this.logger.log(`[BatchPatches] chapter=${chapterId} cancelled during image fetch`);
        return;
      }
      throw err;
    }

    // ── 2. Build multipart form ───────────────────────────────────────────
    const mitConfig = JSON.stringify({
      translator: {
        target_lang: tgtMIT,
        ...(srcMIT !== 'ANY' ? { source_lang: srcMIT, source_lang_only: true } : {}),
      },
      inpainter: { inpainter: 'lama_large' },
      render: { direction: 'auto', rtl: isRtlLang(sourceLangIso ?? '') },
    });

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
      await this._retryMissingPagesIndividually(chapterId, pages, new Set<number>(), notify, sourceLangIso, targetLangIso);
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
      await this._retryMissingPagesIndividually(chapterId, pages, new Set<number>(), notify, sourceLangIso, targetLangIso);
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
            let patches: PatchEntry[] = [];

            for (let i = 0; i < data.patches.length; i++) {
              const p = data.patches[i];
              const pngBuf = Buffer.from(p.img_b64, 'base64');
              const filename = `${chapterId}-${srcMIT}-${tgtMIT}-p${data.pageIndex}-r${i}.png`;
              const key = `uploads/patches/${chapterId}/${filename}`;

              await this.storage.put(key, pngBuf, { contentType: 'image/png' });

              patches.push({
                xPct: imgW > 0 ? p.x / imgW : 0,
                yPct: imgH > 0 ? p.y / imgH : 0,
                wPct: imgW > 0 ? p.w / imgW : 0,
                hPct: imgH > 0 ? p.h / imgH : 0,
                url: `${this.backendOrigin}/${key}`,
              });
            }

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
            const cacheKey = `translate:manga-patches:v3:${chapterId}:${data.pageIndex}:${srcMIT}:${tgtMIT}`;
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
    await this._retryMissingPagesIndividually(chapterId, pages, processedPageIndexes, notify, sourceLangIso, targetLangIso);
  }

  private async _retryMissingPagesIndividually(
    chapterId: string,
    pages: Array<{ pageIndex: number; pageUrl: string }>,
    processedPageIndexes: Set<number>,
    notify: (pageIndex: number, result: PageResult) => void,
    sourceLangIso?: string,
    targetLangIso?: string,
    signal?: AbortSignal,
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
          { maxStartupRetries: 3 },
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

