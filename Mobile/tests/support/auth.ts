import { createClient } from "@supabase/supabase-js";
import { createMobileSession } from "../../src/session.ts";

export function fixture(
  options: {
    loadAccount?: () => Promise<Response>;
    mfa?: boolean;
    beforeSignOut?: () => Promise<void>;
    browser?: () => Promise<{ type: string; url?: string }>;
    externalFetch?: typeof globalThis.fetch;
    onRequest?: (input: RequestInfo | URL, init?: RequestInit) => void;
    verifyMfaResponse?: (init?: RequestInit) => Promise<Response | null>;
  } = {},
) {
  const account = {
    uid: "reader-1",
    email: "reader@example.test",
    displayName: "นักอ่าน",
    role: 0,
  };
  const now = Math.floor(Date.now() / 1000);
  const jwt = (aal: string) =>
    `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: account.uid, email: account.email, exp: now + 3600, iat: now, aal, session_id: "session-1" })).toString("base64url")}.${Buffer.from("test-signature").toString("base64url")}`;
  let token = jwt("aal1");
  const user = {
    id: account.uid,
    email: account.email,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    factors: options.mfa
      ? [
          {
            id: "factor-1",
            factor_type: "totp",
            status: "verified",
            friendly_name: "Authenticator",
          },
        ]
      : [],
  };
  const authResponse = () => ({
    access_token: token,
    refresh_token: "refresh-test",
    expires_in: 3600,
    token_type: "bearer",
    user,
  });
  const storage = new Map<string, string>();
  const fetch: typeof globalThis.fetch = async (input, init) => {
    options.onRequest?.(input, init);
    const url = String(input);
    if (url === "https://api.example.test/users/me/record-device")
      return Response.json({ ok: true });
    if (url.includes("/auth/v1/logout"))
      return new Response(null, { status: 204 });
    if (url.includes("/auth/v1/token")) {
      if (
        url.includes("grant_type=password") &&
        JSON.parse(String(init?.body)).password !== "correct-test-password"
      )
        return Response.json(
          { msg: "Invalid login credentials", code: "invalid_credentials" },
          { status: 400 },
        );
      if (url.includes("grant_type=password") || url.includes('grant_type=pkce')) token = jwt("aal1");
      return Response.json(authResponse());
    }
    if (url.endsWith("/factors/factor-1/challenge"))
      return Response.json({ id: "challenge-1", expires_at: now + 300 });
    if (url.endsWith("/factors/factor-1/verify")) {
      const override = await options.verifyMfaResponse?.(init);
      if (override) return override;
      if (JSON.parse(String(init?.body)).code !== "123456")
        return Response.json(
          { msg: "Invalid TOTP", code: "mfa_verification_failed" },
          { status: 422 },
        );
      token = jwt("aal2");
      return Response.json(authResponse());
    }
    if (url === "https://api.example.test/users/me") {
      const headers = new Headers(init?.headers);
      if (
        headers.get("authorization") !== `Bearer ${token}` ||
        headers.get("x-hardware-id") !== "mdock_native_test"
      )
        return Response.json({ message: "Unauthorized" }, { status: 401 });
      if (init?.method !== "POST" && options.loadAccount)
        return options.loadAccount();
      return Response.json(init?.method === "POST" ? { ok: true } : account);
    }
    if (options.externalFetch) return options.externalFetch(input, init);
    throw new Error(`Unexpected external request: ${url}`);
  };
  const makeClient = () =>
    createClient("https://auth.example.test", "public-test-key", {
      global: { fetch },
      auth: {
        storage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  const supabase = makeClient();
  const app = createMobileSession({
    supabase,
    fetch,
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    beforeSignOut: options.beforeSignOut,
    openAuthSession: options.browser,
  });
  return {
    app,
    supabase,
    account,
    fetch,
    reopen: () =>
      createMobileSession({
        supabase: makeClient(),
        fetch,
        apiOrigin: "https://api.example.test",
        deviceId: "mdock_native_test",
      }),
  };
}
