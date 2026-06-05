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
let _cachedModels: string[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export async function fetchAvailableMangaModels(): Promise<string[]> {
  if (_cachedModels && Date.now() < _cacheExpiresAt) return _cachedModels;

  try {
    const res = await fetch("/api/proxy/books/models", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: string[] };
    const models = Array.isArray(data.models) && data.models.length > 0
      ? data.models
      : [...MANGA_TRANSLATE_MODELS];
    _cachedModels = models;
    _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return models;
  } catch {
    return [...MANGA_TRANSLATE_MODELS];
  }
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
