"use client";

import { useEffect } from "react";

/**
 * The titles currently claimed, newest on top; the tab shows the top one as `"<title> · MangaDock"`, or the root
 * title when nothing claims it. A stack rather than "restore what I replaced": React unmounts a parent's effects
 * before its child's, so a page and the popup over it would otherwise restore each other's titles in the wrong order.
 */
export function titleStack(doc: { title: string }) {
  const entries: { title: string }[] = [];
  let root = doc.title;
  const current = () => {
    const top = entries[entries.length - 1];
    return top ? `${top.title} · MangaDock` : null;
  };
  return {
    current,
    push(title: string): () => void {
      if (entries.length === 0) root = doc.title;
      const entry = { title };
      entries.push(entry);
      doc.title = current()!;
      return () => {
        entries.splice(entries.indexOf(entry), 1);
        doc.title = current() ?? root;
      };
    },
  };
}

let stack: ReturnType<typeof titleStack> | null = null;

function documentStack() {
  if (stack) return stack;
  const s = (stack = titleStack(document));
  // Next re-commits its metadata <title> text after hydration (measured: our write at ~115 ms reverted with no
  // element added), so while a page claims the title, put it back whenever <head> changes. Equal → no write → no loop.
  new MutationObserver(() => {
    const want = s.current();
    if (want && document.title !== want) document.title = want;
  }).observe(document.head, { subtree: true, childList: true, characterData: true });
  return s;
}

/**
 * Names the page in the browser tab, history and screen-reader announcements (#855, WCAG 2.4.2). Almost every
 * route is a client component under a client layout, so the Metadata API cannot be exported from them. Pass
 * `null` until a dynamic name has loaded; a page without this hook shows the root title.
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    return documentStack().push(title);
  }, [title]);
}

/** `usePageTitle` for a server component (the 404) or a page that only renders markup: it renders nothing. */
export function PageTitle({ title }: { title: string }): null {
  usePageTitle(title);
  return null;
}
