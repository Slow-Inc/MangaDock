import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
test("refreshing profile and role keeps the accepted account signed in while loading authoritative Backend fields", async () => {
  let name = "Reader";
  const auth = fixture({
    loadAccount: async () =>
      Response.json({
        uid: "reader-1",
        email: "reader@example.test",
        displayName: name,
        role: name === "Creator" ? 1 : 0,
      }),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const statuses: string[] = [];
  const unsubscribe = auth.app.subscribe(() =>
    statuses.push(auth.app.snapshot().status),
  );
  name = "Creator";
  await auth.app.refreshAccount();
  assert.equal(auth.app.snapshot().account?.displayName, "Creator");
  assert.equal(auth.app.snapshot().account?.role, 1);
  assert.deepEqual(statuses, ["signedIn"]);
  unsubscribe();
  auth.app.dispose();
});
