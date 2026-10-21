import { describe, expect, test } from "bun:test";
import { fetchReviews } from "./reviewsFetch";

/** A backend that never answers — only the abort signal ends the request, as with a real hung upstream. */
const hangingFetch = ((_url: string, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  })) as typeof fetch;

describe("fetchReviews: the reviews page renders even when the backend hangs (#858)", () => {
  test("falls back to no reviews once the timeout passes", async () => {
    const started = Date.now();
    const result = await fetchReviews("m1", { backend: "http://backend", fetchImpl: hangingFetch, timeoutMs: 50 });
    expect(result).toEqual({ reviews: [], summary: { averageRating: 0, count: 0 } });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("returns the list and summary from a healthy backend", async () => {
    const urls: string[] = [];
    const inits: (RequestInit | undefined)[] = [];
    const okFetch = (async (url: string, init?: RequestInit) => {
      urls.push(url);
      inits.push(init);
      const body = url.endsWith("/summary") ? { averageRating: 4.5, count: 2 } : [{ id: "r1" }];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const result = await fetchReviews("m 1", { backend: "http://backend", fetchImpl: okFetch, timeoutMs: 50 });
    expect(urls.sort()).toEqual(["http://backend/reviews/m%201/summary", "http://backend/reviews/m%201?limit=50"]);
    expect(result.summary).toEqual({ averageRating: 4.5, count: 2 });
    expect(result.reviews).toHaveLength(1);
    // both calls carry the deadline and stay in Next's 60 s data cache
    expect(inits.every((i) => i?.signal instanceof AbortSignal && i.next?.revalidate === 60)).toBe(true);
  });
});
