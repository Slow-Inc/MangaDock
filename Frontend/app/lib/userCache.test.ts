import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";

/**
 * #985: favourites / likes sync. A request the server refused must stay pending (fetch resolves on a
 * 4xx/5xx), only the requests that succeeded are marked synced, and a failed flush retries by itself.
 */
const { toggleFavorite, toggleLiked, flushNow, setTokenSupplier, clearUserCache, loadUserData } =
  await import("./userCache");

type Call = { method: string; url: string };
let calls: Call[];
let status: (c: Call) => number;
/** When set, a request waits for this before answering (an in-flight flush). */
let gate: Promise<void> | null;
const store = new Map<string, string>();
let remote: { favorites: unknown[]; liked: string[] } = { favorites: [], liked: [] };

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
const synced = (key: "mb_fav_synced" | "mb_liked_synced") => JSON.parse(store.get(key) ?? "[]") as string[];
/** Lets the async flush started by a timer run to completion. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(() => {
  store.clear();
  calls = [];
  status = () => 200;
  gate = null;
  remote = { favorites: [], liked: [] };
  Object.assign(globalThis, {
    window: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    Event: class {
      constructor(public type: string) {}
    },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    fetch: async (url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? "GET";
      const id = method === "POST" && url.endsWith("/favorites") ? JSON.parse(init!.body!).id : "";
      const call = { method, url: id ? `${url}/${id}` : url };
      calls.push(call);
      if (gate) await gate;
      const s = status(call);
      const body = method === "GET" ? JSON.stringify(remote[url.endsWith("/favorites") ? "favorites" : "liked"]) : "{}";
      return new Response(body, { status: s });
    },
  });
  setTokenSupplier(async () => "tok");
  clearUserCache();
  calls = [];
});

afterEach(() => {
  jest.useRealTimers();
  clearUserCache();
});

describe("favourites / likes sync (#985)", () => {
  test("an add answered 500 stays pending, and the next flush re-sends and marks it", async () => {
    status = () => 500;
    toggleFavorite(aBook("a"));
    await flushNow();
    expect(synced("mb_fav_synced")).not.toContain("a");

    status = () => 200;
    calls = [];
    await flushNow();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(synced("mb_fav_synced")).toContain("a");
  });

  test("a removal answered 500 stays pending, and the next flush re-sends the DELETE", async () => {
    toggleFavorite(aBook("a"));
    await flushNow(); // now on the server
    status = (c) => (c.method === "DELETE" ? 500 : 200);
    toggleFavorite(aBook("a")); // remove
    await flushNow();
    expect(synced("mb_fav_synced")).toContain("a"); // the server still has it

    status = () => 200;
    calls = [];
    await flushNow();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
    expect(synced("mb_fav_synced")).not.toContain("a");
  });

  test("a mixed batch marks what succeeded and re-sends only what failed", async () => {
    status = (c) => (c.url.includes("/liked/") ? 500 : 200);
    toggleFavorite(aBook("a"));
    toggleLiked("b");
    await flushNow();
    expect(synced("mb_fav_synced")).toContain("a");
    expect(synced("mb_liked_synced")).not.toContain("b");

    status = () => 200;
    calls = [];
    await flushNow();
    expect(calls.map((c) => c.method + " " + c.url.split("/me/")[1])).toEqual(["POST liked/b"]);
    expect(synced("mb_liked_synced")).toContain("b");
  });

  test("a failed flush retries by itself, with no further toggle", async () => {
    jest.useFakeTimers();
    status = () => 503;
    toggleLiked("b");
    await flushNow();
    status = () => 200;
    calls = [];
    jest.advanceTimersByTime(29_000);
    await settle();
    expect(calls).toHaveLength(0); // not hammered at the 5 s debounce
    jest.advanceTimersByTime(1_000);
    await settle();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  test("a fully successful flush schedules nothing", async () => {
    jest.useFakeTimers();
    toggleLiked("b");
    await flushNow();
    calls = [];
    jest.advanceTimersByTime(600_000);
    await settle();
    expect(calls).toHaveLength(0);
  });

  test("a change made while a flush is in flight is still sent, with no further toggle", async () => {
    jest.useFakeTimers();
    toggleFavorite(aBook("a"));
    await flushNow(); // on the server
    let open!: () => void;
    gate = new Promise<void>((r) => (open = r));
    toggleFavorite(aBook("a")); // remove → DELETE in flight
    const inFlight = flushNow();
    await settle();
    toggleFavorite(aBook("a")); // re-add while the DELETE is still pending
    gate = null;
    await flushNow(); // sees nothing to send yet: the server still "has" it
    open();
    await inFlight; // the DELETE lands → the re-add is now owed
    calls = [];
    jest.advanceTimersByTime(30_000);
    await settle();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(synced("mb_fav_synced")).toContain("a");
  });

  test("a permanent 4xx is settled, not retried forever", async () => {
    jest.useFakeTimers();
    status = () => 400;
    toggleLiked("b");
    await flushNow();
    calls = [];
    jest.advanceTimersByTime(600_000);
    await settle();
    expect(calls).toHaveLength(0);
  });

  test("ids are URL-encoded", async () => {
    toggleLiked("a/b?c");
    await flushNow();
    expect(calls.map((c) => c.url)).toContain("/api/proxy/users/me/liked/a%2Fb%3Fc");
  });

  test("a login merge marks the server's favourites as synced", async () => {
    remote = { favorites: [aBook("r")], liked: ["l"] };
    await loadUserData("tok");
    expect(synced("mb_fav_synced")).toEqual(["r"]);
    expect(synced("mb_liked_synced")).toEqual(["l"]);
  });
});
