/**
 * Lightweight sessionStorage cache with stale-while-revalidate pattern.
 * Shows cached data instantly, then fetches fresh data in background.
 */

const PREFIX = "mb:studio:";

export function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // Expire after 10 minutes
    if (Date.now() - ts > 10 * 60 * 1000) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage full — silently ignore
  }
}

export function clearStudioCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}
