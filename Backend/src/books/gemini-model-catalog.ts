import { Logger } from '@nestjs/common';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { normalizeGeminiModelName } from './mit-config';

export type GeminiModel = string;

const DEFAULT_GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_MODELS_CACHE_KEY = 'gemini:models:v1';
const GEMINI_MODELS_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

/**
 * Gemini model-selection catalog carved out of BooksService (#231, PRD #228
 * step 6). Owns the availability catalog (memory → cache → provider API, with a
 * 1-hour TTL) and the per-purpose candidate selection (description / manga),
 * normalizing and filtering configured models against what the provider actually
 * exposes. `env` and the `now` clock are injected so selection is unit-testable
 * without touching `process.env` or the wall clock. Behaviour is byte-identical
 * to the inline version it replaces — BooksService keeps thin delegators.
 */
export class GeminiModelCatalog {
  private readonly logger = new Logger(GeminiModelCatalog.name);

  private geminiModelsCatalog: GeminiModel[] | null = null;
  private geminiModelsCatalogExpiresAt = 0;

  constructor(
    private readonly cache: CacheOrchestratorService,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly now: () => number = () => Date.now(),
  ) {}

  // #229: delegates to the pure free function (single source of truth).
  private normalizeGeminiModelName(model?: string | null): GeminiModel | null {
    return normalizeGeminiModelName(model);
  }

  private async getAvailableGeminiModels(): Promise<Set<GeminiModel>> {
    const now = this.now();
    if (this.geminiModelsCatalog && now < this.geminiModelsCatalogExpiresAt) {
      this.logger.log(
        `[Gemini] Model catalog [memory] count=${this.geminiModelsCatalog.length} models=${this.geminiModelsCatalog.join(', ')}`,
      );
      return new Set(this.geminiModelsCatalog);
    }

    const cached = await this.cache.get<{ models: GeminiModel[] }>(
      GEMINI_MODELS_CACHE_KEY,
    );
    if (cached?.data?.models?.length) {
      this.geminiModelsCatalog = cached.data.models;
      this.geminiModelsCatalogExpiresAt = now + GEMINI_MODELS_CACHE_TTL_MS;
      this.logger.log(
        `[Gemini] Model catalog [${cached.source}] count=${cached.data.models.length} models=${cached.data.models.join(', ')}`,
      );
      return new Set(cached.data.models);
    }

    const apiKey = this.env.GEMINI_API_KEY?.trim();
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
            .filter((entry) =>
              (entry.supportedGenerationMethods ?? []).includes(
                'generateContent',
              ),
            )
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
      this.logger.warn(
        `[Gemini] Failed to refresh model catalog: ${String(err)}`,
      );
    }

    return new Set();
  }

  private async filterAvailableGeminiModels(
    candidates: Array<string | null | undefined>,
  ): Promise<GeminiModel[]> {
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

    const filtered = normalizedCandidates.filter((model) =>
      availableModels.has(model),
    );
    const skipped = normalizedCandidates.filter(
      (model) => !availableModels.has(model),
    );

    if (skipped.length > 0) {
      this.logger.warn(
        `[Gemini] Skipping unavailable models: ${skipped.join(', ')}`,
      );
    }

    if (filtered.length > 0) {
      return filtered;
    }

    this.logger.warn(
      `[Gemini] No configured models matched provider catalog; falling back to raw candidates: ${normalizedCandidates.join(', ')}`,
    );
    return normalizedCandidates;
  }

  async getDescriptionModels(): Promise<GeminiModel[]> {
    return this.filterAvailableGeminiModels([
      this.env.GEMINI_DESCRIPTION_MODEL,
      this.env.GEMINI_DESCRIPTION_FALLBACK_MODEL,
      DEFAULT_GEMINI_PRIMARY_MODEL,
      DEFAULT_GEMINI_FALLBACK_MODEL,
    ]);
  }

  async getMangaModels(requested?: string): Promise<GeminiModel[]> {
    return this.filterAvailableGeminiModels([
      requested,
      this.env.GEMINI_MANGA_MODEL,
      this.env.GEMINI_MANGA_FALLBACK_MODEL,
      DEFAULT_GEMINI_PRIMARY_MODEL,
      DEFAULT_GEMINI_FALLBACK_MODEL,
    ]);
  }
}
