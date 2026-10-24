import { afterEach, describe, expect, test } from "bun:test";
import { clearAllApiCache } from "./apiCache";
import { translateDescription } from "./translateDescription";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; clearAllApiCache(); });

/** A fetch stub that answers every call with `body` and counts the calls. */
function stubFetch(body: unknown, status = 200) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return calls;
}

describe("translateDescription: one request per text, whatever the answer (#812)", () => {
  test("a translation is returned and served from cache the second time", async () => {
    const calls = stubFetch({ translatedText: "สวัสดี", translated: true, model: "m" });
    expect(await translateDescription("hello")).toEqual({ text: "สวัสดี", model: "m" });
    expect(await translateDescription("hello")).toEqual({ text: "สวัสดี", model: "m" });
    expect(calls.length).toBe(1);
  });

  test("'not translated' still rejects, but is not re-requested", async () => {
    const calls = stubFetch({ translatedText: "plain", translated: false });
    await expect(translateDescription("plain")).rejects.toThrow();
    await expect(translateDescription("plain")).rejects.toThrow();
    expect(calls.length).toBe(1);
  });

  test("a failed request is not cached, so it is retried", async () => {
    const calls = stubFetch({}, 503);
    await expect(translateDescription("down")).rejects.toThrow();
    await expect(translateDescription("down")).rejects.toThrow();
    expect(calls.length).toBe(2);
  });
});
