import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createAccountSettings } from "../src/account-settings.ts";
test("avatar upload persists both Auth metadata and Backend before adding it to existing photo history", async () => {
  let photoURL = "/old.png",
    photos = ["/old.png"];
  const writes: string[] = [];
  const auth = fixture({
    loadAccount: async () => Response.json({ uid: "reader-1", photoURL }),
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/v1/user") {
        writes.push("auth");
        return Response.json({
          id: "reader-1",
          email: "reader@example.test",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: JSON.parse(String(init?.body)).data,
          created_at: "",
        });
      }
      if (path === "/users/me/avatar") {
        writes.push("upload");
        return Response.json({ url: "/new.png" });
      }
      assert.equal(path, "/users/me/photo-history");
      if (init?.method === "POST") {
        writes.push("history");
        photos = JSON.parse(String(init.body)).photos;
        return new Response(null, { status: 204 });
      }
      return Response.json(photos);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/users/me") && init?.method === "PATCH") {
      writes.push("profile");
      photoURL = JSON.parse(String(init.body)).photoURL;
      return Response.json({ ok: true });
    }
    return auth.fetch(input, init);
  };
  const settings = createAccountSettings({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
    session: auth.app,
    supabase: auth.supabase,
  });
  await settings.loadPhotos();
  assert.deepEqual(settings.snapshot().photos, ["/old.png"]);
  assert.equal(
    await settings.uploadAvatar({
      blob: new Blob(["image"], { type: "image/png" }),
      name: "avatar.png",
    }),
    true,
  );
  assert.deepEqual(writes, ["upload", "auth", "profile", "history"]);
  assert.equal(settings.snapshot().profile?.photoURL, "/new.png");
  assert.deepEqual(settings.snapshot().photos, ["/new.png", "/old.png"]);
  settings.dispose();
});
