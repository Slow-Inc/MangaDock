import { Logger } from '@nestjs/common';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { MitClient } from './mit-client';
import { type TextLayerRegion } from './translation-memory.repository';
import { loadPageBytes } from './page-source';
import {
  mitLangPair,
  patchCacheKey,
  buildMitConfig,
  imageModelKey,
} from './books.service';

type PatchEntry = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  url: string;
};

/**
 * Collaborators BooksService injects so the single-page path can persist a page
 * and resolve series context without owning PatchStore / TranslationMemory /
 * MangaDex. `persistPage`/`seriesContextFor` stay in BooksService (#232/#157 —
 * shared with the batch/webhook path); this keeps the dependency one-way
 * (BooksService → MitTranslationService) with no duplication.
 */
export interface MitPageTranslationDeps {
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
}

/**
 * Single-page MIT translation carved out of BooksService (#233). Owns the
 * single-page patch flow (cache → load → config → MIT submit w/ startup retry →
 * persist), the MIT health check, and the image-translator family probe. Depends
 * on MitClient (#230), the pure #229 helpers, and BooksService's shared
 * persist/series-context via injection — so with MitClient faked this path is
 * unit-testable for the first time. Behaviour is byte-identical to the inline
 * version it replaces.
 */
export class MitTranslationService {
  private readonly logger = new Logger(MitTranslationService.name);
  private imageTranslatorCache: {
    value: string | null;
    expiresAt: number;
  } | null = null;

  constructor(
    private readonly mitClient: MitClient,
    private readonly cache: CacheOrchestratorService,
    private readonly deps: MitPageTranslationDeps,
  ) {}

  async translateMangaPagePatches(
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
  ): Promise<{ patches: PatchEntry[] }> {
    if (!chapterId || !pageUrl) {
      throw new Error('chapterId and pageUrl are required');
    }

    const { srcMIT, tgtMIT } = mitLangPair(process.env, sourceLang, targetLang);
    const cacheKey = patchCacheKey(
      process.env,
      chapterId,
      pageIndex,
      srcMIT,
      tgtMIT,
      opts?.imageModel,
      opts?.derivative ?? 'hd',
    );
    const cached = await this.cache.get<{ patches: PatchEntry[] }>(cacheKey);
    if (cached?.data?.patches) {
      return cached.data;
    }

    // Load the source page — display-derivative aware (#156): /img-cache paths
    // are read straight from disk so the patch is generated from byte-identical
    // content to what the Reader displays; external URLs are fetched.
    const imgBuffer = await loadPageBytes(pageUrl, {
      imgCacheRoot: 'img-cache',
      uploadsRoot: 'uploads',
    });

    const config = buildMitConfig(
      process.env,
      srcMIT,
      tgtMIT,
      sourceLang ?? '',
      opts?.imageModel,
      await this.deps.seriesContextFor(opts?.mangaId),
    );

    const maxStartupRetries = opts?.maxStartupRetries ?? 30;
    const startupRetryDelayMs = 5_000;

    let mitRes: Response | null = null;
    let lastErrText = '';

    for (let attempt = 0; attempt <= maxStartupRetries; attempt += 1) {
      const form = new FormData();
      form.append(
        'image',
        new Blob([new Uint8Array(imgBuffer)], { type: 'image/jpeg' }),
        'page.jpg',
      );
      form.append('config', config);

      try {
        mitRes = await this.mitClient.submitSinglePage(form, 300_000);
      } catch (err) {
        const msg = String(err);
        if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
          throw new Error(`manga-image-translator service unavailable`);
        }
        if (
          msg.includes('AbortError') ||
          msg.includes('abort') ||
          msg.includes('timed out')
        ) {
          throw new Error(`manga-image-translator timed out after 5 minutes`);
        }
        throw err;
      }

      if (mitRes.ok) break;

      const errText = await mitRes.text().catch(() => '');
      lastErrText = errText;
      this.logger.warn(
        `[MangaPatches] MIT HTTP ${mitRes.status} body: ${errText.slice(0, 300)}`,
      );

      if (mitRes.status !== 500 || attempt === maxStartupRetries) {
        throw new Error(
          `manga-image-translator error: HTTP ${mitRes.status} — ${errText.slice(0, 200)}`,
        );
      }

      this.logger.warn(
        `[MangaPatches] MIT not ready (attempt ${attempt + 1}/${maxStartupRetries + 1}), retrying in ${startupRetryDelayMs / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, startupRetryDelayMs));
    }

    if (!mitRes || !mitRes.ok) {
      throw new Error(
        `manga-image-translator error: startup retries exhausted — ${lastErrText.slice(0, 200)}`,
      );
    }

    const patchData = (await mitRes.json()) as {
      img_width: number;
      img_height: number;
      patches: Array<{
        x: number;
        y: number;
        w: number;
        h: number;
        img_b64: string;
      }>;
    };

    // Persist the Patch Set via PatchStore (#137 — deterministic names, no orphans)
    const { img_width: imgW, img_height: imgH } = patchData;
    // #232: shared per-page persist — PatchStore write + percent-map + tiered cache.
    const patches = await this.deps.persistPage({
      chapterId,
      pageIndex,
      srcMIT,
      tgtMIT,
      storeModel: imageModelKey(opts?.imageModel),
      cacheKey,
      cacheStrategy: 'tiered',
      rects: patchData.patches,
      buffers: patchData.patches.map((p) => Buffer.from(p.img_b64, 'base64')),
      imgW,
      imgH,
    });

    const result = { patches };

    this.logger.log(
      `[MangaPatches] chapter=${chapterId} page=${pageIndex} → ${patches.length} patches`,
    );

    return result;
  }

  async checkMitHealth(): Promise<{
    available: boolean;
    url: string;
    message?: string;
  }> {
    const url = this.mitClient.baseUrl;
    try {
      const res = await this.mitClient.ready(5_000);
      return { available: res.ok, url };
    } catch (err) {
      this.logger.warn(`[MangaTranslate] Health check failed: ${String(err)}`);
      return { available: false, url, message: String(err) };
    }
  }

  /** The translator family MIT actually runs (from /ready, #132) — e.g. 'qwen3'
   *  or 'gemini'. null when MIT is down, not ready, or predates #132; consumers
   *  treat null as "unknown" (Reader fails open — PRD #131). */
  async getImageTranslator(): Promise<string | null> {
    const now = Date.now();
    if (
      this.imageTranslatorCache &&
      now < this.imageTranslatorCache.expiresAt
    ) {
      return this.imageTranslatorCache.value;
    }
    let value: string | null = null;
    try {
      const res = await this.mitClient.ready(3_000);
      if (res.ok) {
        const body = (await res.json()) as { translator?: unknown };
        value =
          typeof body?.translator === 'string' && body.translator
            ? body.translator
            : null;
      }
    } catch {
      /* MIT down — degrade to unknown */
    }
    this.imageTranslatorCache = { value, expiresAt: now + 60_000 };
    return value;
  }
}
