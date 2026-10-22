"use client";

import { useState } from "react";
import { coverSources } from "../lib/imgUrl";

/**
 * The cover a card should show now: each `onError` moves to the next source; `src` is null once every source has
 * failed (or there is none), and the card shows its placeholder instead of the browser's broken-image icon (#921).
 * Keyed on the sources, so a card reused for another book starts again from the first one.
 */
export function useCoverSrc(book: { thumbnail?: string; thumbnailLocal?: string }) {
  const sources = coverSources(book);
  const key = sources.join("|");
  const [failed, setFailed] = useState({ key, count: 0 });
  const count = failed.key === key ? failed.count : 0;
  return {
    src: sources[count] ?? null,
    onError: () => setFailed({ key, count: count + 1 }),
  };
}
