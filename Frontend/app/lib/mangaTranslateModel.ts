export const MANGA_TRANSLATE_MODEL_KEY = "mangaTranslateModel";

export const MANGA_TRANSLATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export type MangaTranslateModel = (typeof MANGA_TRANSLATE_MODELS)[number];

export function isMangaTranslateModel(value: string | null | undefined): value is MangaTranslateModel {
  return !!value && (MANGA_TRANSLATE_MODELS as readonly string[]).includes(value);
}

export function getMangaTranslateModelFromStorage(): MangaTranslateModel {
  if (typeof window === "undefined") return "gemini-2.5-flash";
  const value = localStorage.getItem(MANGA_TRANSLATE_MODEL_KEY);
  return isMangaTranslateModel(value) ? value : "gemini-2.5-flash";
}

export async function translateMangaLines(payload: {
  lines: string[];
  contextHint?: string;
  chapterId?: string;
  page?: number;
}) {
  const model = getMangaTranslateModelFromStorage();
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
    model: MangaTranslateModel;
    fromCache: number;
    generated: number;
  }>;
}
