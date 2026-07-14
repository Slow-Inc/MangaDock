import { describe, expect, test } from "bun:test";
import {
  isExpectedNativeAuthMessage,
  parseNativeToWebMessage,
  parseWebToNativeMessage,
} from "@mangadock/mobile-bridge";

describe("mobile bridge messages", () => {
  test("accepts supported OAuth providers", () => {
    expect(parseWebToNativeMessage(JSON.stringify({
      type: "mangadock:oauth:start",
      provider: "google",
      requestId: "oauth-1",
    }))).toEqual({
      type: "mangadock:oauth:start",
      provider: "google",
      requestId: "oauth-1",
    });
  });

  test("rejects malformed and unsupported web messages", () => {
    expect(parseWebToNativeMessage("not-json")).toBeNull();
    expect(parseWebToNativeMessage({
      type: "mangadock:oauth:start",
      provider: "github",
    })).toBeNull();
    expect(parseWebToNativeMessage({
      type: "mangadock:permission:request",
      permission: "media-library",
      requestId: "",
    })).toBeNull();
  });

  test("accepts permission requests and results", () => {
    expect(parseWebToNativeMessage({
      type: "mangadock:permission:request",
      permission: "media-library",
      requestId: "upload-1",
    })).toEqual({
      type: "mangadock:permission:request",
      permission: "media-library",
      requestId: "upload-1",
    });

    expect(parseNativeToWebMessage({
      type: "mangadock:permission:result",
      permission: "media-library",
      requestId: "upload-1",
      status: "blocked",
    })).toEqual({
      type: "mangadock:permission:result",
      permission: "media-library",
      requestId: "upload-1",
      status: "blocked",
    });
  });

  test("requires complete native auth sessions", () => {
    expect(parseNativeToWebMessage({
      type: "mangadock:native-auth:session",
      requestId: "oauth-1",
      access_token: "access",
      refresh_token: "refresh",
    })).toEqual({
      type: "mangadock:native-auth:session",
      requestId: "oauth-1",
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(parseNativeToWebMessage({
      type: "mangadock:native-auth:session",
      requestId: "oauth-1",
      access_token: "access",
    })).toBeNull();
  });

  test("accepts auth results only for the live OAuth request", () => {
    const message = parseNativeToWebMessage({
      type: "mangadock:native-auth:session",
      requestId: "oauth-1",
      access_token: "access",
      refresh_token: "refresh",
    });

    expect(isExpectedNativeAuthMessage(message, null)).toBeFalse();
    expect(isExpectedNativeAuthMessage(message, "oauth-2")).toBeFalse();
    expect(isExpectedNativeAuthMessage(message, "oauth-1")).toBeTrue();
    expect(isExpectedNativeAuthMessage(message, null)).toBeFalse();
  });
});
