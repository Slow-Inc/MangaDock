"use client";

/**
 * The signed-in user's 18+ content level on the client (#1102, PRD #1100). The server decides what each level may
 * see (from the stored setting, never from the request); the client only (a) sends the session token on catalog
 * reads while the level is above `off`, so the server can find the level, and (b) keeps those reads' cache apart.
 * At `off` — every visitor who never opted in — requests and cache keys are exactly what they were before.
 */
import { useSyncExternalStore } from "react";
import { clearAllApiCache } from "./apiCache";

export type ContentLevel = "off" | "suggestive" | "erotica" | "all";
export type ContentRating = "safe" | "suggestive" | "erotica" | "pornographic";

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

/** The ratings a level shows — mirrors the server's ratingsFor (#1105: `off` is safe only). */
export function ratingsFor(level: ContentLevel): ContentRating[] {
  if (level === "all") return ["safe", "suggestive", "erotica", "pornographic"];
  if (level === "erotica") return ["safe", "suggestive", "erotica"];
  if (level === "suggestive") return ["safe", "suggestive"];
  return ["safe"];
}

/** Whether the level includes 18+ ratings (the search page's "เฉพาะ 18+" filter is shown then). */
export function allowsAdult(level: ContentLevel): boolean {
  return level === "erotica" || level === "all";
}

/**
 * History lists keep a title unless its known rating is above the level (#1105). A title MangaDex does not know
 * (our own Studio uploads) has no rating here and stays.
 */
export function filterByLevel<T extends { id: string }>(
  items: T[],
  ratings: Record<string, string>,
  level: ContentLevel,
): T[] {
  const allowed = ratingsFor(level) as string[];
  return items.filter((b) => !(b.id in ratings) || allowed.includes(ratings[b.id]));
}
