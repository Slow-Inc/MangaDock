/**
 * Translate target languages (#163).
 *
 * Single source of truth for the Reader's target-language chips. Everything
 * below this list already supports each entry: the Backend maps the ISO code
 * to MIT's vocabulary (MIT_LANG_MAP) and the patch cache partitions by
 * target, so adding a language here is the whole Frontend change.
 */

export const TARGET_LANG_OPTIONS: { code: string; label: string }[] = [
  { code: "th", label: "→ TH" },
  { code: "en", label: "→ EN" },
  { code: "zh", label: "→ ZH" },
  { code: "ja", label: "→ JA" },
  { code: "ko", label: "→ KO" },
];

/** The target to fall back to when the current one equals the chapter's
 *  source language — the first option that differs, or undefined when the
 *  current target is already valid (or the source is unknown). A JA chapter
 *  must never sit on → JA as a dead choice. */
export function fallbackTarget(sourceLang: string | null, currentTarget: string): string | undefined {
  const source = (sourceLang ?? "").toLowerCase();
  if (!source) return undefined;
  if (currentTarget.toLowerCase() !== source) return undefined;
  return TARGET_LANG_OPTIONS.find((l) => l.code !== source)?.code;
}
