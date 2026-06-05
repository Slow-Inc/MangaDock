export const MANGA_TRANSLATE_MODEL_KEY = "mangaTranslateModel";

// Hardcoded fallback — used when API is unavailable
export const MANGA_TRANSLATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export type MangaTranslateModel = string;

export function isMangaTranslateModel(
  value: string | null | undefined,
  availableModels: string[] = [...MANGA_TRANSLATE_MODELS],
): value is MangaTranslateModel {
  return !!value && availableModels.includes(value);
}

export function getMangaTranslateModelFromStorage(
  availableModels: string[] = [...MANGA_TRANSLATE_MODELS],
): MangaTranslateModel {
  if (typeof window === "undefined") return MANGA_TRANSLATE_MODELS[0];
  const value = localStorage.getItem(MANGA_TRANSLATE_MODEL_KEY);
  return isMangaTranslateModel(value, availableModels) ? value : MANGA_TRANSLATE_MODELS[0];
}

// ─── Image translation (patch overlay) model selection (#87) ────────────────
export const MANGA_IMAGE_TRANSLATE_MODEL_KEY = "mangaImageTranslateModel";

/**
 * The Gemini model the user selected for IMAGE translation, or undefined when
 * no selection was made — undefined means "let the operator's env default win".
 * Falls back to the shared text-translation selection so the existing model
 * selector drives both text and image translation (PRD #87, user story 7).
 */
export function getSelectedMangaImageTranslateModel(
  availableModels: string[] = [...MANGA_TRANSLATE_MODELS],
): MangaTranslateModel | undefined {
  if (typeof window === "undefined") return undefined;
  const imageValue = localStorage.getItem(MANGA_IMAGE_TRANSLATE_MODEL_KEY);
  if (isMangaTranslateModel(imageValue, availableModels)) return imageValue;
  const textValue = localStorage.getItem(MANGA_TRANSLATE_MODEL_KEY);
  if (isMangaTranslateModel(textValue, availableModels)) return textValue;
  return undefined;
}

// Module-level cache so Reader components share one fetch
type ModelsInfo = { models: string[]; imageTranslator: string | null };
let _cachedInfo: ModelsInfo | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function fetchModelsInfo(): Promise<ModelsInfo> {
  if (_cachedInfo && Date.now() < _cacheExpiresAt) return _cachedInfo;

  try {
    const res = await fetch("/api/proxy/books/models", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: string[]; imageTranslator?: string | null };
    const info: ModelsInfo = {
      models: Array.isArray(data.models) && data.models.length > 0
        ? data.models
        : [...MANGA_TRANSLATE_MODELS],
      imageTranslator: typeof data.imageTranslator === "string" ? data.imageTranslator : null,
    };
    _cachedInfo = info;
    _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return info;
  } catch {
    return { models: [...MANGA_TRANSLATE_MODELS], imageTranslator: null };
  }
}

export async function fetchAvailableMangaModels(): Promise<string[]> {
  return (await fetchModelsInfo()).models;
}

/** The translator MIT actually runs (from /books/models, #134) — null = unknown. */
export async function fetchImageTranslator(): Promise<string | null> {
  return (await fetchModelsInfo()).imageTranslator;
}

/** Gemini model selection only makes sense when MIT runs a Gemini-family
 *  translator. null/unknown fails open (old backend, MIT down) so Gemini
 *  deployments keep #87 behavior during MIT restarts. */
export function isGeminiImageTranslator(translator: string | null): boolean {
  return translator === null || translator.startsWith("gemini");
}

/** Single gating point for translate calls (PRD #131): the user's selected
 *  image model, or undefined when the deployment's translator would ignore it —
 *  a stale localStorage selection must not re-partition the patch cache. */
export async function getEffectiveImageModel(): Promise<string | undefined> {
  const info = await fetchModelsInfo();
  if (!isGeminiImageTranslator(info.imageTranslator)) return undefined;
  return getSelectedMangaImageTranslateModel(info.models);
}

export async function translateMangaLines(payload: {
  lines: string[];
  contextHint?: string;
  chapterId?: string;
  page?: number;
  model?: string;
  targetLang?: string;
}) {
  const model = payload.model ?? getMangaTranslateModelFromStorage(await fetchAvailableMangaModels());
  const res = await fetch("/api/proxy/books/translate/manga", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, model }),
  });
  if (!res.ok) {
    throw new Error(`Manga translate failed (${res.status})`);
  }
  return res.json() as Promise<{
    translatedLines: string[];
    translated: boolean;
    model: string;
    fromCache: number;
    generated: number;
  }>;
}
