"use client";

/**
 * The signed-in user's 18+ content level on the client (#1102, PRD #1100). The server decides what each level may
 * see (from the stored setting, never from the request); the client only (a) sends the session token on catalog
 * reads while the level is above `off`, so the server can find the level, and (b) keeps those reads' cache apart.
 * At `off` — every visitor who never opted in — requests and cache keys are exactly what they were before.
 */
import { useSyncExternalStore } from "react";
import { clearAllApiCache } from "./apiCache";

export type ContentLevel = "off" | "erotica" | "all";

let current: ContentLevel = "off";
const listeners = new Set<() => void>();

export function getContentLevel(): ContentLevel {
  return current;
}

/** Called by ContentLevelSync on sign-in/out and by the settings page on save. Clears the per-tab API cache. */
export function setContentLevel(level: ContentLevel): void {
  if (level === current) return;
  current = level;
  clearAllApiCache();
  listeners.forEach((fn) => fn());
}

export function useContentLevel(): ContentLevel {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => "off",
  );
}

/** Appended to catalog cache keys: `off` keeps today's keys. */
export function levelKey(level: ContentLevel = current): string {
  return level === "off" ? "" : `:r=${level}`;
}

/** The catalog reads whose results depend on the level (they carry the token while it is above `off`). */
export function isCatalogUrl(url: string): boolean {
  const path = url.split("?")[0];
  return /\/books\/(search|new-releases|genre\/[^/]+|manga\/[^/]+\/(chapters|preview))$/.test(path);
}

export function isAdultRating(rating: string | undefined): boolean {
  return rating === "erotica" || rating === "pornographic";
}
