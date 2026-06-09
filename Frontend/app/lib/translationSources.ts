/**
 * Translation source selection (#156).
 *
 * The Reader must translate the SAME image derivative it displays. Screentone
 * re-encodes (HD vs data-saver, live CDN vs cached copy) carry visibly
 * different midtone weight, so a patch generated from a different derivative
 * sits in a tinted rectangle over the page. This module mirrors the Reader's
 * display-source resolution for the translate flow, returning URLs the
 * *Backend* can load (raw CDN URLs or backend-local /img-cache paths) — never
 * browser-relative proxy routes.
 */

export type PageDerivative = "hd" | "saver";

export type ChapterPageData = {
  pages?: string[];
  localPages?: string[];
  dataSaverPages?: string[];
  localDataSaverPages?: string[];
};

export function buildTranslationSources(
  data: ChapterPageData | null | undefined,
  useSaver: boolean,
): { sources: string[]; derivative: PageDerivative } {
  const derivative: PageDerivative = useSaver ? "saver" : "hd";
  const originals = (useSaver ? data?.dataSaverPages : data?.pages) ?? [];
  const locals = useSaver ? data?.localDataSaverPages : data?.localPages;
  const sources = originals.map((orig, i) => {
    const local = locals?.[i];
    // Same rule the Reader's resolvePages uses for display — a /img-cache
    // entry is a backend-local file; anything else is the external fallback.
    return local && local.startsWith("/img-cache") ? local : orig;
  });
  return { sources, derivative };
}
