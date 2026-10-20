"use client";

import { useSyncExternalStore } from "react";

type VisibilityDoc = EventTarget & { visibilityState: DocumentVisibilityState };

/** subscribe/getSnapshot over `document.visibilityState`, injectable for tests. */
export function visibilityStore(doc: VisibilityDoc) {
  return {
    subscribe(onChange: () => void) {
      doc.addEventListener("visibilitychange", onChange);
      return () => doc.removeEventListener("visibilitychange", onChange);
    },
    getSnapshot: () => doc.visibilityState === "visible",
  };
}

// One store per page, so useSyncExternalStore does not resubscribe on every render.
let pageStore: ReturnType<typeof visibilityStore> | null = null;
const subscribe = (onChange: () => void) =>
  (pageStore ??= visibilityStore(document)).subscribe(onChange);
const getSnapshot = () => (pageStore ??= visibilityStore(document)).getSnapshot();
const getServerSnapshot = () => true;

/**
 * Whether this tab is visible (#821). Long-lived streams use it to let go of their connection in background
 * tabs: over HTTP/1.1 a browser shares 6 connections per host across every tab, so six open /community tabs
 * starved every other request to the app. Server render counts as visible.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
