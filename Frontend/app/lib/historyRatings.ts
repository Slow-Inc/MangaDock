"use client";

/**
 * History lists (the "อ่านต่อ" row, the history tab) respect the content level (#1105): titles are known only by id
 * there, so their ratings come from GET /books/ratings (cached per tab). Until the ratings arrive the list is held
 * (empty) rather than shown and then trimmed, so a hidden cover never flashes. The result is memoized: callers key
 * effects on it.
 */
import { useEffect, useMemo, useState } from "react";
import { cacheOrFetch, TTL } from "./apiCache";
import { filterByLevel, useContentLevel } from "./contentLevel";

const API_BASE = "/api/proxy";

async function fetchRatings(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const r = await fetch(`${API_BASE}/books/ratings?ids=${chunk.map(encodeURIComponent).join(",")}`);
    if (!r.ok) throw new Error(`ratings ${r.status}`);
    Object.assign(out, await r.json());
  }
  return out;
}

const HELD: never[] = [];

export function useLevelFiltered<T extends { id: string }>(items: T[]): T[] {
  const level = useContentLevel();
  const ids = useMemo(() => [...new Set(items.map((b) => b.id))].sort(), [items]);
  const key = ids.join(",");
  const [ratings, setRatings] = useState<{ key: string; map: Record<string, string> } | null>(null);
  useEffect(() => {
    if (level === "all" || !key) return; // everything shows
    let cancelled = false;
    cacheOrFetch(`ratings:${key}`, () => fetchRatings(key.split(",")), TTL.LONG)
      .then((map) => { if (!cancelled) setRatings({ key, map }); })
      // ratings unavailable: show the list rather than hide all of it (history is the user's own reading)
      .catch(() => { if (!cancelled) setRatings({ key, map: {} }); });
    return () => { cancelled = true; };
  }, [key, level]);
  const filtered = useMemo(
    () => (ratings?.key === key ? filterByLevel(items, ratings.map, level) : HELD),
    [items, ratings, key, level],
  );
  return level === "all" || !key ? items : filtered;
}
