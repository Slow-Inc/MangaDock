import { describe, expect, test } from "bun:test";
import { avatarSource } from "./avatarSource";

describe("avatarSource — photo, or null for the uid mascot", () => {
  test("a usable photo URL is returned trimmed", () => {
    expect(avatarSource("  https://lh3.googleusercontent.com/a/x=s96-c ")).toBe("https://lh3.googleusercontent.com/a/x=s96-c");
    expect(avatarSource("/uploads/avatars/u1_1.png")).toBe("/uploads/avatars/u1_1.png");
  });
  test("no photo → null", () => {
    expect(avatarSource(null)).toBeNull();
    expect(avatarSource(undefined)).toBeNull();
    expect(avatarSource("   ")).toBeNull();
  });
  test("a blocked scheme → null, never an <img src='#'>", () => {
    expect(avatarSource("javascript:alert(1)")).toBeNull();
    expect(avatarSource("data:image/svg+xml;base64,AAAA")).toBeNull();
  });
});
