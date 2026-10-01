"use client";

import { cacheOrFetch, TTL } from "./apiCache";

const API_BASE = "/api/proxy";

type TranslateResponse = { translatedText: string; translated: boolean; model?: string };

export type DescriptionTranslation = {
  text: string;
  /** Model that produced `text`; undefined for translations cached before the backend reported it. */
  model?: string;
};

/**
 * Translate a manga description via the backend MT service, cached by exact
 * source text for TTL.LONG (quasi-static — same text always translates the
 * same way). Throws if the request fails OR the API reports no translation
 * was performed (`translated: false`) — callers should `.catch()` and treat
 * that identically to a failed translation (leave the original text shown).
 */
export function translateDescription(text: string): Promise<DescriptionTranslation> {
  return cacheOrFetch(
    // v2: the cached value is an object now; a pre-existing string entry must not be reused.
    `translate:v2:${text}`,
    async () => {
      const res = await fetch(`${API_BASE}/books/translate?text=${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error("translate failed");
      const data: TranslateResponse = await res.json();
      if (!data.translated) throw new Error("not translated");
      return { text: data.translatedText, model: data.model };
    },
    TTL.LONG,
  );
}
