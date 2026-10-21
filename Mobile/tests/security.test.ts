import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createSecurity } from "../src/security.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
test("duplicate Authenticator setup gestures reuse one unverified factor", async () => {
  let enrollments = 0;
  const auth = fixture({
    externalFetch: async (input, init) => {
      if (String(input).endsWith("/user")) return Response.json(user);
      if (init?.method === "DELETE") return Response.json({ id: "factor-1" });
      enrollments++;
      return Response.json({
        id: `factor-${enrollments}`,
        type: "totp",
        totp: {
          secret: "SECRET",
          uri: "otpauth://totp/Test?secret=SECRET",
          qr_code: "<svg/>",
        },
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await Promise.all([security.startTotp(), security.startTotp()]);
  await security.startTotp();
  assert.equal(enrollments, 1);
  assert.equal(security.snapshot().enrollment?.id, "factor-1");
  await security.cancelTotp();
  security.dispose();
});
const user = {
  id: "reader-1",
  email: "reader@example.test",
  email_confirmed_at: "2026-10-04",
  aud: "authenticated",
  app_metadata: { providers: ["email", "google"] },
  user_metadata: {},
  created_at: "2026-10-04",
  identities: [
    {
      id: "email-id",
      identity_id: "email-identity",
      user_id: "reader-1",
      provider: "email",
      identity_data: {},
      created_at: "",
      last_sign_in_at: "",
      updated_at: "",
    },
    {
      id: "google-id",
      identity_id: "google-identity",
      user_id: "reader-1",
      provider: "google",
      identity_data: {},
      created_at: "",
      last_sign_in_at: "",
      updated_at: "",
    },
  ],
  factors: [],
};
test("reauthentication cannot authorize sensitive actions when MFA verification returns a session that is still aal1", async () => {
  let downgrade = false,
    oldSession: object = {};
  const factor = {
    id: "factor-1",
    factor_type: "totp",
    status: "verified",
    friendly_name: "Authenticator",
  };
  const auth = fixture({
    mfa: true,
    externalFetch: async () => Response.json({ ...user, factors: [factor] }),
    verifyMfaResponse: async () =>
      downgrade ? Response.json(oldSession) : null,
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  oldSession = (await auth.supabase.auth.getSession()).data.session!;
  await auth.app.verifyTotp("123456");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  downgrade = true;
  await assert.rejects(
    security.reauthenticate("correct-test-password", "123456"),
  );
  assert.equal(security.snapshot().authenticatedUntil, 0);
  assert.equal(auth.app.snapshot().status, "mfaRequired");
  security.dispose();
});
test("OAuth reauthentication also requires verified aal2 before authorizing a sensitive operation", async () => {
  let downgrade = false,
    oldSession: object = {};
  const factor = {
    id: "factor-1",
    factor_type: "totp",
    status: "verified",
    friendly_name: "Authenticator",
  };
  const auth = fixture({
    mfa: true,
    externalFetch: async () => Response.json({ ...user, factors: [factor] }),
    verifyMfaResponse: async () =>
      downgrade ? Response.json(oldSession) : null,
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  oldSession = (await auth.supabase.auth.getSession()).data.session!;
  await auth.app.verifyTotp("123456");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
    openAuthSession: async (_, redirectTo) => ({
      type: "success",
      url: `${redirectTo}?code=reauth-code`,
    }),
  });
  downgrade = true;
  await assert.rejects(security.reauthenticateOAuth("google", "123456"));
  assert.equal(security.snapshot().authenticatedUntil, 0);
  assert.equal(auth.app.snapshot().status, "mfaRequired");
  security.dispose();
});
test("signing out wipes pending enrollment ownership so a later login cannot cancel the old setup", async () => {
  let deletes = 0;
  const auth = fixture({
    externalFetch: async (input, init) => {
      if (String(input).endsWith("/user")) return Response.json(user);
      if (init?.method === "DELETE") {
        deletes++;
        return Response.json({ id: "factor-1" });
      }
      return Response.json({
        id: "factor-1",
        type: "totp",
        totp: {
          secret: "SECRET",
          uri: "otpauth://totp/Test?secret=SECRET",
          qr_code: "<svg />",
        },
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await security.startTotp();
  await auth.app.signOut();
  assert.equal(security.snapshot().enrollment, null);
  await auth.app.signIn("reader@example.test", "correct-test-password");
  await security.cancelTotp();
  assert.equal(deletes, 0);
  security.dispose();
});
test("security loads real Auth identities and MFA factors with the existing owner-filtered known devices", async () => {
  const device = {
    id: "device-1",
    hwid: "mdock_native_test",
    user_agent: "MangaDock Android",
    first_seen: "2026-10-01",
    last_seen: "2026-10-04",
  };
  const auth = fixture({
    externalFetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") return Response.json(user);
      assert.equal(url.pathname, "/rest/v1/user_known_devices");
      assert.equal(url.searchParams.get("uid"), "eq.reader-1");
      return Response.json([device]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await security.load();
  assert.equal(security.snapshot().user?.identities?.length, 2);
  assert.deepEqual(security.snapshot().devices, [device]);
  assert.deepEqual(security.snapshot().factors, []);
  security.dispose();
});

test("changing an existing password requires the current credential and never submits a new password after failed reauthentication", async () => {
  let updates = 0;
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/auth/v1/user");
      if (init?.method === "PUT") {
        updates++;
        assert.equal(JSON.parse(String(init.body)).password, "new-password123");
      }
      return Response.json(user);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await assert.rejects(
    security.changePassword("wrong-password", "new-password123"),
  );
  assert.equal(updates, 0);
  assert.equal(
    await security.changePassword("correct-test-password", "new-password123"),
    true,
  );
  assert.equal(updates, 1);
  security.dispose();
});

test("signing out other sessions requires recent same-account reauthentication and never logs out this device", async () => {
  const scopes: string[] = [];
  let clock = 1000;
  const auth = fixture({
    externalFetch: async (input) => Response.json(user),
    onRequest: (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/logout")
        scopes.push(url.searchParams.get("scope") ?? "");
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
    now: () => clock,
  });
  await assert.rejects(security.signOutOthers());
  await security.reauthenticate("correct-test-password");
  assert.equal(await security.signOutOthers(), true);
  assert.equal(auth.app.snapshot().status, "signedIn");
  clock += 5 * 60_000;
  await assert.rejects(security.signOutOthers());
  assert.deepEqual(scopes, ["others"]);
  security.dispose();
});

test("reauthenticating an MFA account verifies its TOTP again and retains the accepted account at aal2", async () => {
  const factor = {
    id: "factor-1",
    factor_type: "totp",
    status: "verified",
    friendly_name: "Authenticator",
  };
  const auth = fixture({
    mfa: true,
    externalFetch: async () => Response.json({ ...user, factors: [factor] }),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  await auth.app.verifyTotp("123456");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  assert.equal(
    await security.reauthenticate("correct-test-password", "123456"),
    true,
  );
  assert.equal(auth.app.snapshot().status, "signedIn");
  const { data } =
    await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  assert.equal(data?.currentLevel, "aal2");
  security.dispose();
});

test("TOTP enrollment remains unverified until the real Auth challenge succeeds and then removes the setup secret", async () => {
  let verified = false;
  const factor = {
    id: "factor-1",
    factor_type: "totp",
    status: "verified",
    friendly_name: "MangaDock Authenticator",
  };
  const auth = fixture({
    onRequest: (input, init) => {
      if (
        String(input).endsWith("/factors/factor-1/verify") &&
        JSON.parse(String(init?.body)).code === "123456"
      )
        verified = true;
    },
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/v1/user")
        return Response.json({ ...user, factors: verified ? [factor] : [] });
      if (path === "/rest/v1/user_known_devices") return Response.json([]);
      assert.equal(path, "/auth/v1/factors");
      assert.equal(init?.method, "POST");
      return Response.json({
        id: "factor-1",
        type: "totp",
        totp: {
          secret: "EXAMPLETOTPSECRET",
          uri: "otpauth://totp/MangaDock?secret=EXAMPLETOTPSECRET",
          qr_code: "<svg />",
        },
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  assert.equal(await security.startTotp(), true);
  assert.equal(security.snapshot().enrollment?.id, "factor-1");
  assert.deepEqual(security.snapshot().factors, []);
  assert.equal(await security.finishTotp("123456"), true);
  assert.equal(security.snapshot().enrollment, null);
  assert.equal(security.snapshot().factors[0]?.status, "verified");
  security.dispose();
});

test("cancelling Authenticator setup removes the unverified server factor and wipes its local secret", async () => {
  const deleted: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/v1/user") return Response.json(user);
      if (init?.method === "DELETE") {
        deleted.push(path);
        return Response.json({ id: "factor-1" });
      }
      return Response.json({
        id: "factor-1",
        type: "totp",
        totp: {
          secret: "EXAMPLETOTPSECRET",
          uri: "otpauth://totp/MangaDock?secret=EXAMPLETOTPSECRET",
          qr_code: "<svg />",
        },
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await security.startTotp();
  assert.equal(await security.cancelTotp(), true);
  assert.equal(security.snapshot().enrollment, null);
  assert.deepEqual(deleted, ["/auth/v1/factors/factor-1"]);
  security.dispose();
});

test("leaving the security screen cleans up its unverified factor and does not retain the setup secret", async () => {
  let deleted!: () => void;
  const deletion = new Promise<void>((resolve) => {
    deleted = resolve;
  });
  const auth = fixture({
    externalFetch: async (input, init) => {
      if (new URL(String(input)).pathname === "/auth/v1/user")
        return Response.json(user);
      if (init?.method === "DELETE") {
        deleted();
        return Response.json({ id: "factor-1" });
      }
      return Response.json({
        id: "factor-1",
        type: "totp",
        totp: {
          secret: "EXAMPLETOTPSECRET",
          uri: "otpauth://totp/MangaDock?secret=EXAMPLETOTPSECRET",
          qr_code: "<svg />",
        },
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await security.startTotp();
  security.dispose();
  assert.equal(security.snapshot().enrollment, null);
  await deletion;
});

test("an enrollment acknowledged after leaving the screen cannot publish a secret and cleans the newly created factor", async () => {
  let release!: (response: Response) => void, started!: () => void;
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  const deleted: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/v1/user") return Response.json(user);
      if (init?.method === "DELETE") {
        deleted.push(path);
        return Response.json({ id: "factor-1" });
      }
      return new Promise<Response>((resolve) => {
        release = resolve;
        started();
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  const enrolling = security.startTotp();
  await beginning;
  security.dispose();
  release(
    Response.json({
      id: "factor-1",
      type: "totp",
      totp: {
        secret: "EXAMPLETOTPSECRET",
        uri: "otpauth://totp/MangaDock?secret=EXAMPLETOTPSECRET",
        qr_code: "<svg />",
      },
    }),
  );
  assert.equal(await enrolling, false);
  assert.equal(security.snapshot().enrollment, null);
  assert.deepEqual(deleted, ["/auth/v1/factors/factor-1"]);
});

test("removing a verified MFA factor requires recent reauthentication and refreshes the real factor list", async () => {
  let enabled = true,
    deletes = 0;
  const factor = {
    id: "factor-1",
    factor_type: "totp",
    status: "verified",
    friendly_name: "Authenticator",
  };
  const auth = fixture({
    mfa: true,
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "DELETE") {
        enabled = false;
        deletes++;
        return Response.json({ id: "factor-1" });
      }
      return Response.json(
        path === "/auth/v1/user"
          ? { ...user, factors: enabled ? [factor] : [] }
          : [],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  await auth.app.verifyTotp("123456");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  await security.load();
  await assert.rejects(security.removeTotp("factor-1"));
  assert.equal(deletes, 0);
  await security.reauthenticate("correct-test-password", "123456");
  assert.equal(await security.removeTotp("factor-1"), true);
  assert.deepEqual(security.snapshot().factors, []);
  assert.equal(deletes, 1);
  security.dispose();
});

test("linking a provider uses the real existing Auth identity flow and requires its own verified native callback", async () => {
  let linked = false;
  const auth = fixture({
    onRequest: (input, init) => {
      if (
        String(input).includes("grant_type=pkce") &&
        JSON.parse(String(init?.body)).auth_code === "identity-code"
      )
        linked = true;
    },
    externalFetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user")
        return Response.json({
          ...user,
          identities: linked
            ? [
                ...user.identities,
                {
                  ...user.identities[1],
                  provider: "facebook",
                  identity_id: "facebook-identity",
                },
              ]
            : user.identities,
        });
      if (url.pathname === "/rest/v1/user_known_devices")
        return Response.json([]);
      assert.ok(url.pathname.includes("/identities/authorize"));
      assert.equal(url.searchParams.get("provider"), "facebook");
      assert.equal(
        url.searchParams.get("redirect_to"),
        "mangadock://auth/link",
      );
      return Response.json({
        url: "https://auth.example.test/authorize/facebook",
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
    openAuthSession: async (url, redirect) => {
      assert.equal(url, "https://auth.example.test/authorize/facebook");
      assert.equal(redirect, "mangadock://auth/link");
      return { type: "success", url: `${redirect}?code=identity-code` };
    },
  });
  assert.equal(await security.link("facebook"), true);
  assert.equal(
    security
      .snapshot()
      .user?.identities?.some((identity) => identity.provider === "facebook"),
    true,
  );
  assert.equal(auth.app.snapshot().account?.uid, "reader-1");
  security.dispose();
});

test("unlinking uses the real identity ID and preserves at least one existing sign-in method", async () => {
  let identities = [...user.identities];
  const removed: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "DELETE") {
        removed.push(path);
        identities = identities.filter(
          (identity) => identity.provider !== "google",
        );
        return Response.json({});
      }
      return Response.json(
        path === "/auth/v1/user" ? { ...user, identities } : [],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  assert.equal(await security.unlink("google"), true);
  assert.deepEqual(removed, ["/auth/v1/user/identities/google-identity"]);
  await assert.rejects(security.unlink("email"));
  assert.equal(removed.length, 1);
  security.dispose();
});

test("product-data deletion requires typed confirmation and recent reauthentication before the existing DELETE endpoint and logout", async () => {
  let deletes = 0;
  const auth = fixture({ externalFetch: async () => Response.json(user) });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (
      new URL(String(input)).pathname === "/users/me" &&
      init?.method === "DELETE"
    ) {
      deletes++;
      return Response.json({ ok: true });
    }
    return auth.fetch(input, init);
  };
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch,
  });
  await assert.rejects(security.deleteProductData("ลบบัญชี"));
  await security.reauthenticate("correct-test-password");
  await assert.rejects(security.deleteProductData("delete"));
  assert.equal(deletes, 0);
  assert.equal(await security.deleteProductData("ลบบัญชี"), true);
  assert.equal(deletes, 1);
  assert.equal(auth.app.snapshot().status, "signedOut");
  security.dispose();
});

test("OAuth reauthentication accepts only a completed same-account provider flow and cancellation never grants the sensitive-action window", async () => {
  let complete = false;
  const auth = fixture({ externalFetch: async () => Response.json(user) });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
    now: () => 1000,
    openAuthSession: async (_url, redirect) => {
      assert.equal(redirect, "mangadock://auth/reauth");
      return complete
        ? { type: "success", url: `${redirect}?code=reauth-code` }
        : { type: "cancel" };
    },
  });
  assert.equal(await security.reauthenticateOAuth("google"), false);
  assert.equal(security.snapshot().authenticatedUntil, 0);
  complete = true;
  assert.equal(await security.reauthenticateOAuth("google"), true);
  assert.equal(security.snapshot().authenticatedUntil, 301000);
  assert.equal(auth.app.snapshot().account?.uid, "reader-1");
  security.dispose();
});

test("an OAuth account can add its existing supported password sign-in method through Auth and reload identities", async () => {
  let added = false;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "PUT") {
        assert.equal(JSON.parse(String(init.body)).password, "new-password123");
        added = true;
      }
      return Response.json(
        path === "/auth/v1/user"
          ? {
              ...user,
              identities: added ? user.identities : [user.identities[1]],
            }
          : [],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const security = createSecurity({
    ...options,
    session: auth.app,
    supabase: auth.supabase,
    fetch: auth.fetch,
  });
  assert.equal(await security.addPassword("new-password123"), true);
  assert.equal(
    security
      .snapshot()
      .user?.identities?.some((identity) => identity.provider === "email"),
    true,
  );
  security.dispose();
});
