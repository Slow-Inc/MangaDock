import { describe, expect, test } from "bun:test";
import { errMessage } from "./errMessage";

describe("errMessage", () => {
  test("Error instance → returns .message", () => {
    expect(errMessage(new Error("boom"))).toBe("boom");
  });

  test("plain string → returns itself", () => {
    expect(errMessage("plain string")).toBe("plain string");
  });

  test("plain object → JSON stringified", () => {
    expect(errMessage({ code: 500 })).toBe('{"code":500}');
  });

  test("undefined → safe string, no throw", () => {
    expect(errMessage(undefined)).toBe("undefined");
  });

  test("circular object → falls back to String(e) without throwing", () => {
    const obj: Record<string, unknown> = {};
    obj["self"] = obj;
    const result = errMessage(obj);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
