import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import type { HistoryBook } from "./readingHistory";

/**
 * readingHistory is a module-level singleton (local-first list + a debounced flush to the
 * server), so each test imports its own fresh instance and stubs the browser APIs it uses.
 */

type Call = { method: string; url: string; token: string; body?: string };

let calls: Call[];
let activeToken: string | null;
let tokenLookups: number;
let remote: Record<string, HistoryBook[]>;
const store = new Map<string, string>();
let instance = 0;

const book = (id: string): HistoryBook => ({
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
  lastReadAt: 1,
});

const historyWrites = () =>
  calls.filter((c) => c.method !== "GET" && c.url.includes("/users/me/history"));

/** Let the awaited token lookup + fetches inside a fired flush timer settle. */
const settle = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
const advanceFlushTimer = async () => {
  jest.advanceTimersByTime(5_000);
  await settle();
};

async function freshHistory() {
  const mod = await import(`./readingHistory.ts?case=${++instance}`);
  mod.setHistoryTokenSupplier(async () => {
    tokenLookups++;
    return activeToken;
  });
  return mod as typeof import("./readingHistory");
}

beforeEach(() => {
  store.clear();
  calls = [];
  activeToken = null;
  tokenLookups = 0;
  remote = {};
  Object.assign(globalThis, {
    window: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    CustomEvent: class {
      constructor(public type: string) {}
    },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    fetch: async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      const method = init?.method ?? "GET";
      const token = (init?.headers?.Authorization ?? "").replace("Bearer ", "");
      calls.push({ method, url, token, body: init?.body });
      if (method === "GET") return new Response(JSON.stringify(remote[token] ?? []), { status: 200 });
      return new Response("{}", { status: 200 });
    },
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("readingHistory — a change of identity must never write to the server", () => {
  test("sign out, then sign in as someone else without a reload: the first read must not wipe the new user's history", async () => {
    const h = await freshHistory();
    activeToken = "A";
    remote.A = [book("a1")];
    await h.loadHistoryData("A");

    // A signs out: the token is gone, local state is reset
    activeToken = null;
    h.resetHistoryForIdentityChange();
    await advanceFlushTimer(); // the flush that fires now has no token

    // B signs in on the same page and reads one chapter
    activeToken = "B";
    remote.B = [book("b1")];
    await h.loadHistoryData("B");
    h.addToHistory(book("b2"));
    await advanceFlushTimer();

    expect(historyWrites().map((c) => `${c.method} ${c.url} [${c.token}]`)).toEqual([
      "POST /api/proxy/users/me/history [B]",
    ]);
  });

  test("an account switch drops the old user's unflushed reads instead of sending them under the new token", async () => {
    const h = await freshHistory();
    activeToken = "A";
    remote.A = [book("a1")];
    await h.loadHistoryData("A");
    h.addToHistory(book("a-unflushed")); // pending upsert for A

    activeToken = "B"; // session switches before the debounce fires
    h.resetHistoryForIdentityChange();
    remote.B = [];
    await h.loadHistoryData("B");
    await advanceFlushTimer();

    expect(historyWrites().filter((c) => (c.body ?? "").includes("a-unflushed"))).toEqual([]);
  });

  test("a reset cancels the flush it left scheduled, so nothing wakes up under the next session", async () => {
    const h = await freshHistory();
    activeToken = "A";
    await h.loadHistoryData("A");
    h.addToHistory(book("a-read")); // schedules the debounced flush

    h.resetHistoryForIdentityChange();
    activeToken = "B";
    await advanceFlushTimer();

    expect(tokenLookups).toBe(0); // the stale flush would have asked for B's token
  });

  test("a reset leaves no local history behind", async () => {
    const h = await freshHistory();
    activeToken = "A";
    remote.A = [book("a1"), book("a2")];
    await h.loadHistoryData("A");
    expect(h.getHistory().length).toBe(2);

    h.resetHistoryForIdentityChange();

    expect(h.getHistory()).toEqual([]);
    expect([...store.keys()].filter((k) => k.startsWith("mangadock_"))).toEqual([]);
  });
});

describe("readingHistory — normal syncing is unchanged", () => {
  test("a read is flushed to the server with the current token after the debounce", async () => {
    const h = await freshHistory();
    activeToken = "A";
    await h.loadHistoryData("A");
    h.addToHistory(book("a1"));
    expect(historyWrites()).toEqual([]); // debounced
    await advanceFlushTimer();

    expect(historyWrites().map((c) => `${c.method} [${c.token}]`)).toEqual(["POST [A]"]);
  });
});
