import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";

/**
 * What a browser keeps for the signed-in user (favourites / likes, reading history, the
 * follow list, the API response cache) must be dropped together when the identity changes,
 * and dropping it must never reach the server. The follow cache pulls in the Supabase
 * client, so only that one is replaced; the other three are the real modules.
 */
const clearFollowCache = mock(() => {});
mock.module("../hooks/useSeriesFollow", () => ({ clearFollowCache }));

const { resetClientStateForIdentityChange } = await import("./identityReset");
const { cacheGet, cacheSet } = await import("./apiCache");
const { isLiked, toggleLiked, setTokenSupplier } = await import("./userCache");
const { addToHistory, getHistory, setHistoryTokenSupplier } = await import("./readingHistory");

type Call = { method: string; url: string; token: string };
let calls: Call[];
let activeToken: string | null;
const store = new Map<string, string>();

const aBook = (id: string) => ({
  id,
  title: `title ${id}`,
  subtitle: "",
  thumbnail: "",
  authors: [],
  description: "",
  publishedDate: "",
  categories: [],
  averageRating: 0,
  ratingsCount: 0,
});

beforeEach(() => {
  store.clear();
  calls = [];
  activeToken = "A";
  clearFollowCache.mockClear();
  Object.assign(globalThis, {
    window: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    Event: class {
      constructor(public type: string) {}
    },
    CustomEvent: class {
      constructor(public type: string) {}
    },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    fetch: async (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
      calls.push({
        method: init?.method ?? "GET",
        url,
        token: (init?.headers?.Authorization ?? "").replace("Bearer ", ""),
      });
      return new Response("[]", { status: 200 });
    },
  });
  setTokenSupplier(async () => activeToken);
  setHistoryTokenSupplier(async () => activeToken);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("resetClientStateForIdentityChange", () => {
  test("drops everything the previous user left in this browser", () => {
    cacheSet("forum:feed", { posts: 1 }, 60_000);
    toggleLiked("book-1");
    addToHistory(aBook("h1"));
    expect(cacheGet("forum:feed")).toBeDefined();
    expect(isLiked("book-1")).toBe(true);
    expect(getHistory().length).toBe(1);

    resetClientStateForIdentityChange();

    expect(cacheGet("forum:feed")).toBeUndefined();
    expect(isLiked("book-1")).toBe(false);
    expect(getHistory()).toEqual([]);
    expect(clearFollowCache).toHaveBeenCalledTimes(1);
  });

  test("changes made by the previous user and not yet flushed never reach the server, not even under the next user's token", () => {
    toggleLiked("book-2"); // pending write, debounced
    addToHistory(aBook("h2")); // pending write, debounced

    resetClientStateForIdentityChange();
    activeToken = "B"; // the next session
    jest.advanceTimersByTime(60_000);

    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });
});
