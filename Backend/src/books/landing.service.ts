import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { LlmService } from './llm.service';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { ImageCacheService } from '../cache/image-cache.service';
import { MangaDexService } from './mangadex.service';
import { GeminiModelCatalog, type GeminiModel } from './gemini-model-catalog';
import { geminiLangName } from './mit-config';
import {
  CACHE_TTL_MS,
  type LandingBook,
  type LandingPayload,
  type LandingRow,
} from './books.types';

const LANDING_CACHE_KEY = 'landing:full:v5';

/**
 * Landing assembly + Gemini text translation carved out of BooksService (#231,
 * PRD #228 step 6). Owns the landing payload (cache → MangaDex rows → image-cache
 * enhancement, with the previously-duplicated stale-cache fallback collapsed into
 * one serveStale helper), the description translation, and the per-page manga
 * episode (dialogue) translation. Depends on the cache, image cache, MangaDex,
 * and the GeminiModelCatalog (#231) for model selection; `backendOrigin` and
 * `env` are injected so the unit is fakeable. Behaviour is byte-identical to the
 * inline version it replaces — BooksService keeps thin delegators.
 */
export class LandingService {
  private readonly logger = new Logger(LandingService.name);

  constructor(
    private readonly cache: CacheOrchestratorService,
    private readonly imageCache: ImageCacheService,
    private readonly mangaDex: MangaDexService,
    private readonly geminiCatalog: GeminiModelCatalog,
    private readonly backendOrigin: () => string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly llmService: LlmService = new LlmService(env),
  ) {}

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

    const modelCandidates = await this.geminiCatalog.getMangaModels(payload.model);
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

    if (!this.llmService.isConfigured()) {
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

      for (const modelName of modelCandidates) {
        try {
          const raw = (await this.llmService.complete(prompt, modelName)).trim();
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
          this.logger.warn(`[LLM] Manga translation failed on ${modelName}: ${String(err)}`);
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

  async translateDescription(text: string): Promise<{ translatedText: string; translated: boolean }> {
    if (!this.llmService.isConfigured()) return { translatedText: text, translated: false };
    if (!text?.trim()) return { translatedText: text, translated: false };

    // Detect if already Thai — skip if >25% Thai chars
    const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length;
    if (thaiChars / text.length > 0.25) return { translatedText: text, translated: false };

    const provider = this.env.LLM_PROVIDER ?? 'gemini';
    const models =
      provider === 'gemini'
        ? await this.geminiCatalog.getDescriptionModels()
        : [this.llmService.getDescriptionModel()];
    const fingerprint = Buffer.from(text.slice(0, 512)).toString('base64').slice(0, 64);
    const cacheKey = `translate:th:v3:${models.join('|')}:${fingerprint}`;
    const cached = await this.cache.get<{ translatedText: string; translated: boolean }>(cacheKey);
    if (cached) return cached.data;

    const prompt = `Translate the following manga/book description to Thai. Output ONLY the Thai translation. Do not include any reasoning, explanations, thoughts, or notes. Just the translated text:\n\n${text}`;

    for (const modelName of models) {
      try {
        let translatedText = (await this.llmService.complete(prompt, modelName)).trim();
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
        this.logger.warn(`[LLM] Description translation failed on ${modelName}: ${String(err)}`);
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

    let rows: LandingRow[];
    try {
      // Rows are independent; fetch them concurrently (Promise.all preserves
      // input order). Any row rejecting still trips the same stale fallback,
      // matching the previous all-or-nothing sequential behaviour (#397).
      rows = await Promise.all(
        this.mangaDex.mangaRowDefs.map(async (def) => {
          const { items } = await this.mangaDex.fetchMangaForRow(def.order, def.limit ?? 10);
          return { id: def.id, title: def.title, query: def.order, items };
        }),
      );
    } catch (err) {
      this.logger.warn(`API fetch error: ${String(err)} — attempting stale cache fallback`);
      return this.serveStale(cacheKey, forceLocal);
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
      return this.serveStale(cacheKey, forceLocal);
    }

    const landingEnhanced = await this.enhanceLanding(payload);
    return forceLocal ? this.applyForceLocalLanding(landingEnhanced) : landingEnhanced;
  }

  /** Stale-cache fallback shared by the two landing failure paths (#231): serve the
   *  last good landing payload (flagged stale + enhanced) if present, else the API
   *  offline payload. Previously duplicated verbatim at both call sites. */
  private async serveStale(cacheKey: string, forceLocal: boolean): Promise<LandingPayload> {
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

  // ─── Image cache enhancement (landing-level) ──────────────────────────────────

  private applyForceLocalLanding(payload: LandingPayload): LandingPayload {
    if (!this.imageCache.enabled) return payload;
    const origin = this.backendOrigin();
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

    const enhanceBook = async (book: LandingBook): Promise<LandingBook> => {
      // A cached thumbnailLocal (from Redis) can point to a file that was wiped
      // on restart/reset — trusting it blindly serves a 404 from the static
      // /img-cache route. Re-verify it still exists; if gone, fall back to
      // localThumbnailPath which re-resolves and re-triggers a download (self-heals).
      const stillCached =
        book.thumbnailLocal &&
        (await this.imageCache.localPathExists(book.thumbnailLocal))
          ? book.thumbnailLocal
          : undefined;
      return {
        ...book,
        thumbnailLocal:
          stillCached ??
          ((await this.imageCache.localThumbnailPath(book.id, book.thumbnail)) ?? undefined),
      };
    };

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
