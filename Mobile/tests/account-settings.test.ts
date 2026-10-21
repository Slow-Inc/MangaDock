import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createAccountSettings } from "../src/account-settings.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
test("profile changes update existing Auth metadata and Backend profile then refresh native account fields", async () => {
  let displayName = "Reader";
  const writes: object[] = [];
  const auth = fixture({
    loadAccount: async () =>
      Response.json({
        uid: "reader-1",
        email: "reader@example.test",
        displayName,
        role: 0,
        photoURL: null,
      }),
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/auth/v1/user");
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(String(init?.body));
      writes.push({ data: body.data });
      return Response.json({
        id: "reader-1",
        email: "reader@example.test",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: body.data,
        created_at: "2026-10-04",
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (
      new URL(String(input)).pathname === "/users/me" &&
      init?.method === "PATCH"
    ) {
      const body = JSON.parse(String(init.body));
      writes.push(body);
      displayName = body.displayName;
      return Response.json({ ok: true });
    }
    return auth.fetch(input, init);
  };
  const settings = createAccountSettings({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch,
  });
  await settings.load();
  assert.equal(settings.snapshot().profile?.displayName, "Reader");
  assert.equal(await settings.saveProfile({ displayName: " Creator " }), true);
  assert.deepEqual(writes, [
    { data: { display_name: "Creator", full_name: "Creator" } },
    { displayName: "Creator" },
  ]);
  assert.equal(settings.snapshot().profile?.displayName, "Creator");
  assert.equal(auth.app.snapshot().account?.displayName, "Creator");
  settings.dispose();
});

test("translator preferences use the existing profile route and server role rejection remains a visible failure", async () => {
  let reject = true;
  const bodies: object[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.equal(
        new URL(String(input)).pathname,
        "/users/me/translator-profile",
      );
      bodies.push(JSON.parse(String(init?.body)));
      return reject
        ? Response.json({ message: "Forbidden" }, { status: 403 })
        : Response.json({ ok: true });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const settings = createAccountSettings({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  const body = {
    bio: "Translator",
    translatorLanguages: ["th", "en"],
    country: "TH",
    preferredLanguage: "th",
  };
  await assert.rejects(settings.saveTranslatorProfile(body));
  reject = false;
  assert.equal(await settings.saveTranslatorProfile(body), true);
  assert.deepEqual(bodies, [body, body]);
  settings.dispose();
});

test("a profile save awaiting Auth cannot patch Backend or reload private profile after logout", async () => {
  let release!: (response: Response) => void;
  let patches = 0;
  const auth = fixture({
    externalFetch: async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (init?.method === "PATCH") {
      patches++;
      return Response.json({ ok: true });
    }
    return auth.fetch(input, init);
  };
  const settings = createAccountSettings({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch,
  });
  await settings.load();
  const saving = settings.saveProfile({ displayName: "Creator" });
  await new Promise((resolve) => setImmediate(resolve));
  // Native session revokes its accepted identity immediately; SDK logout waits for the update lock.
  const leaving = auth.app.signOut();
  release(
    Response.json({
      id: "reader-1",
      email: "reader@example.test",
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-04",
    }),
  );
  assert.equal(await saving, false);
  await leaving;
  assert.equal(patches, 0);
  assert.equal(settings.snapshot().profile, null);
  settings.dispose();
});
