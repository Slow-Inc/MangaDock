import { describe, expect, test } from "bun:test";
import { parseJsonArray } from "./safeJson";

describe("parseJsonArray", () => {
  test("returns the array for a valid JSON array body", async () => {
    const res = new Response(JSON.stringify([{ id: "a" }, { id: "b" }]), { status: 200 });
    expect(await parseJsonArray<{ id: string }>(res)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("returns null for an empty body (would throw SyntaxError)", async () => {
    const res = new Response("", { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });

  test("returns null for a non-JSON body", async () => {
    const res = new Response("<html>oops</html>", { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });

  test("returns null when the JSON body is an object, not an array", async () => {
    const res = new Response(JSON.stringify({ message: "not an array" }), { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });

  test("returns null when the JSON body is literal null", async () => {
    const res = new Response("null", { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });
});
