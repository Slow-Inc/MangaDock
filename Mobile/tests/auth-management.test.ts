import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createAuthManagement } from "../src/auth-management.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
const user = {
  id: "reader-1",
  email: "reader@example.test",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-04",
};
test("verification resend uses the pending signup email and native redirect, and propagates rate limits", async () => {
  let limited = false,
    resends = 0;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const url = new URL(String(input)),
        body = JSON.parse(String(init?.body));
      if (url.pathname === "/users/validate-email")
        return Response.json({ ok: true, normalizedEmail: body.email });
      if (url.pathname === "/auth/v1/signup") return Response.json({ user });
      assert.equal(url.pathname, "/auth/v1/resend");
      assert.equal(body.type, "signup");
      assert.equal(body.email, "reader@example.test");
      assert.equal(
        url.searchParams.get("redirect_to"),
        "mangadock://auth/signup",
      );
      resends++;
      return limited
        ? Response.json({ message: "rate limited" }, { status: 429 })
        : Response.json({});
    },
  });
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await assert.rejects(management.resendVerification());
  assert.equal(resends, 0);
  await management.signUp("reader@example.test", "secret123", "Reader");
  assert.equal(await management.resendVerification(), true);
  limited = true;
  await assert.rejects(management.resendVerification());
  assert.equal(management.snapshot().verificationEmail, "reader@example.test");
  management.dispose();
});
test("registration applies the existing email-validation decision before real Supabase signup and shows verification pending", async () => {
  const requests: string[] = [];
  let allowed = false;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      const body = JSON.parse(String(init?.body));
      if (path === "/users/validate-email") {
        assert.equal(body.email, "reader@example.test");
        return Response.json({
          ok: allowed,
          normalizedEmail: body.email,
          message: "Email unavailable",
        });
      }
      assert.equal(path, "/auth/v1/signup");
      assert.equal(body.email, "reader@example.test");
      assert.deepEqual(body.data, {
        display_name: "Reader",
        full_name: "Reader",
      });
      return Response.json({ user });
    },
  });
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await assert.rejects(
    management.signUp(" Reader@Example.test ", "secret123", " Reader "),
  );
  assert.deepEqual(requests, ["/users/validate-email"]);
  allowed = true;
  assert.equal(
    await management.signUp(" Reader@Example.test ", "secret123", " Reader "),
    true,
  );
  assert.equal(management.snapshot().verificationEmail, "reader@example.test");
  assert.equal(auth.app.snapshot().status, "signedOut");
  management.dispose();
});

test("password recovery requests use a distinct native PKCE redirect and cannot permit reset before a verified callback", async () => {
  const auth = fixture({
    externalFetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/auth/v1/recover");
      assert.equal(
        url.searchParams.get("redirect_to"),
        "mangadock://auth/recovery",
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.email, "reader@example.test");
      assert.equal(body.code_challenge_method, "s256");
      return Response.json({});
    },
  });
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await management.requestRecovery(" Reader@Example.test ");
  assert.equal(management.snapshot().recoveryEmail, "reader@example.test");
  await assert.rejects(management.resetPassword("new-password123"));
  management.dispose();
});

test("a PKCE recovery callback locks accepted product access until the new password is saved and account restored", async () => {
  let updated = false;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/v1/recover") return Response.json({});
      assert.equal(path, "/auth/v1/user");
      assert.equal(JSON.parse(String(init?.body)).password, "new-password123");
      updated = true;
      return Response.json(user);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await management.requestRecovery("reader@example.test");
  assert.equal(
    await management.handleCallback(
      "mangadock://auth/recovery?code=recovery-code",
    ),
    true,
  );
  assert.equal(management.snapshot().recoveryReady, true);
  await assert.rejects(auth.app.accessToken());
  assert.equal(await management.resetPassword("new-password123"), true);
  assert.equal(updated, true);
  assert.equal(management.snapshot().recoveryReady, false);
  assert.equal(auth.app.snapshot().status, "signedIn");
  management.dispose();
});

test("an ordinary authorization code or foreign callback cannot grant password recovery", async () => {
  const auth = fixture();
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  assert.equal(
    await management.handleCallback("https://other.test/recovery?code=code"),
    false,
  );
  assert.equal(
    await management.handleCallback("mangadock://auth/callback?code=code"),
    false,
  );
  await assert.rejects(
    management.handleCallback("mangadock://auth/recovery?code=ordinary-code"),
  );
  assert.equal(management.snapshot().recoveryReady, false);
  await assert.rejects(management.resetPassword("new-password123"));
  management.dispose();
});

test("disposing the auth flow ignores a delayed recovery-email acknowledgement", async () => {
  let release!: (response: Response) => void;
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const auth = fixture({
    externalFetch: async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
        started();
      }),
  });
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  const pending = management.requestRecovery("reader@example.test");
  await requestStarted;
  management.dispose();
  release(Response.json({}));
  await pending;
  assert.equal(management.snapshot().recoveryEmail, null);
});

test("email verification returns through its own native signup callback and restores the existing product account", async () => {
  const auth = fixture({
    externalFetch: async (input) =>
      Response.json(
        new URL(String(input)).pathname === "/users/validate-email"
          ? { ok: true }
          : { user },
      ),
  });
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await management.signUp("reader@example.test", "secret123", "Reader");
  assert.equal(
    await management.handleCallback("mangadock://auth/signup?code=signup-code"),
    true,
  );
  assert.equal(auth.app.snapshot().status, "signedIn");
  assert.equal(management.snapshot().verificationEmail, null);
  management.dispose();
});

test("duplicate OS delivery of one recovery callback shares its PKCE exchange and preserves the verified recovery screen", async () => {
  const auth = fixture({ externalFetch: async () => Response.json({}) });
  const management = createAuthManagement({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await management.requestRecovery("reader@example.test");
  const url = "mangadock://auth/recovery?code=recovery-code";
  assert.deepEqual(
    await Promise.all([
      management.handleCallback(url),
      management.handleCallback(url),
    ]),
    [true, true],
  );
  assert.equal(management.snapshot().recoveryReady, true);
  management.dispose();
});
