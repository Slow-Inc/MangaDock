/** Whether the current page is showing a translation right now (#826) — what the rating pill may ask about. */
export function pageShowsTranslation({
  showTranslation,
  page,
  translatedPages,
  patchedPages,
}: {
  showTranslation: boolean;
  page: number;
  translatedPages: ReadonlyMap<number, unknown>;
  patchedPages: ReadonlyMap<number, unknown>;
}): boolean {
  return showTranslation && (translatedPages.has(page) || patchedPages.has(page));
}
