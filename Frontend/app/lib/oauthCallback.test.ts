import { expect, test, describe } from "bun:test";
import {
  postOAuthCallbackMessage,
  isTrustedOAuthCallbackMessage,
  OAUTH_CALLBACK_TYPE,
} from "./oauthCallback";

describe("postOAuthCallbackMessage", () => {
  test("posts to the exact self origin, never a wildcard", () => {
    const calls: Array<{ msg: unknown; target: string }> = [];
    const opener = { postMessage: (msg: unknown, target: string) => { calls.push({ msg, target }); } };

    postOAuthCallbackMessage(
      opener,
      { access_token: "a", refresh_token: "r" },
      "https://app.example.com",
    );

    expect(calls.length).toBe(1);
    expect(calls[0].target).toBe("https://app.example.com");
    expect(calls[0].target).not.toBe("*");
    expect(calls[0].msg).toEqual({
      type: OAUTH_CALLBACK_TYPE,
      access_token: "a",
      refresh_token: "r",
    });
  });

  test("passes through the error payload with the tagged type", () => {
    const calls: Array<{ msg: unknown; target: string }> = [];
    const opener = { postMessage: (msg: unknown, target: string) => { calls.push({ msg, target }); } };

    postOAuthCallbackMessage(opener, { error_code: "email_exists", error: "taken" }, "https://app.example.com");

    expect(calls[0].msg).toEqual({ type: OAUTH_CALLBACK_TYPE, error_code: "email_exists", error: "taken" });
    expect(calls[0].target).toBe("https://app.example.com");
  });
});

describe("isTrustedOAuthCallbackMessage", () => {
  const self = "https://app.example.com";

  test("accepts a correctly-typed message from the same origin", () => {
    const event = { origin: self, data: { type: OAUTH_CALLBACK_TYPE, access_token: "a" } };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(true);
  });

  test("rejects a correctly-typed message from a foreign origin", () => {
    const event = { origin: "https://evil.example.com", data: { type: OAUTH_CALLBACK_TYPE, access_token: "a" } };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(false);
  });

  test("rejects an unrelated message type from the same origin", () => {
    const event = { origin: self, data: { type: "provider-changed" } };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(false);
  });

  test("rejects a message with no data", () => {
    const event = { origin: self, data: null };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(false);
  });
});
