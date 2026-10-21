"use client";

import { useEffect } from "react";

/** Sets `"<title> · MangaDock"` and returns a function that puts back the title it replaced. */
export function applyPageTitle(doc: { title: string }, title: string): () => void {
  const previous = doc.title;
  doc.title = `${title} · MangaDock`;
  return () => { doc.title = previous; };
}

/**
 * Names the page in the browser tab, history and screen-reader announcements (#855, WCAG 2.4.2). Almost every
 * route is a client component under a client layout, so the Metadata API cannot be exported from them. Restoring
 * on unmount means a page without this hook falls back to the root title rather than keeping the last page's.
 * Pass `null` until a dynamic name has loaded.
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    return applyPageTitle(document, title);
  }, [title]);
}
