import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import {
  createPushNotifications,
  pushPayload,
  type PushPayload,
} from "../src/push-notifications.ts";
import type { NotificationDestination } from "../src/notification-links.ts";

const payload: PushPayload = {
  version: "1",
  recipientUid: "reader-1",
  notificationId: "notification-1",
  link: "/community/p/post-1",
};

test("explicit logout runs push cleanup while the accepted account credential is still available", async () => {
  let cleaned = false;
  const auth = fixture({
    beforeSignOut: async () => {
      assert.equal(auth.app.snapshot().status, "signedIn");
      assert.ok(await auth.app.accessToken());
      cleaned = true;
    },
  });
  try {
    await auth.app.signIn("reader@example.test", "correct-test-password");
    await auth.app.signOut();
    assert.equal(cleaned, true);
    assert.equal(auth.app.snapshot().status, "signedOut");
  } finally {
    auth.app.dispose();
  }
});

async function setup(
  options: {
    enabled?: boolean;
    signedIn?: boolean;
    permission?: boolean;
    storage?: Map<string, string>;
    externalFetch?: typeof fetch;
    unregister?: () => Promise<void>;
    acquireToken?: () => Promise<string>;
  } = {},
) {
  const calls: Array<{
    method: string;
    headers: Headers;
    body: Record<string, string>;
  }> = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      calls.push({
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      if (options.externalFetch) return options.externalFetch(input, init);
      return init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ registered: true });
    },
  });
  if (options.signedIn !== false)
    await auth.app.signIn("reader@example.test", "correct-test-password");
  const storage = options.storage ?? new Map<string, string>();
  const permissions: boolean[] = [];
  const navigations: NotificationDestination[] = [];
  const previews: PushPayload[] = [];
  let token = "fcm-token-1",
    unregistered = 0;
  let allowed = options.permission ?? true;
  const push = createPushNotifications({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
    storage: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => {
        storage.set(key, value);
      },
    },
    platform: {
      permission: async (prompt) => {
        permissions.push(prompt);
        return allowed;
      },
      token: async () =>
        options.acquireToken ? options.acquireToken() : token,
      unregister: async () => {
        unregistered++;
        await options.unregister?.();
      },
      preview: async (data) => {
        previews.push(data);
      },
    },
    enabled: options.enabled ?? true,
    navigate: (destination) => {
      navigations.push(destination);
    },
  });
  return {
    auth,
    push,
    storage,
    permissions,
    calls,
    navigations,
    previews,
    setToken(value: string) {
      token = value;
    },
    setPermission(value: boolean) {
      allowed = value;
    },
    unregistered: () => unregistered,
    dispose() {
      push.dispose();
      auth.app.dispose();
    },
  };
}

test("push stays inert in builds without rollout enabled and never asks guests for permission", async () => {
  for (const options of [{ enabled: false }, { signedIn: false }]) {
    const f = await setup(options);
    try {
      await f.push.refresh();
      await f.push.enable();
      assert.equal(
        f.push.snapshot().status,
        options.enabled === false ? "unavailable" : "signedOut",
      );
      assert.deepEqual(f.permissions, []);
      assert.deepEqual(f.calls, []);
    } finally {
      f.dispose();
    }
  }
});

test("opt in registers Expo Push with accepted Auth and device headers, duplicate taps cannot issue another write", async () => {
  const f = await setup();
  try {
    await f.push.refresh();
    assert.deepEqual(f.permissions, []);
    await Promise.all([f.push.enable(), f.push.enable()]);
    assert.deepEqual(f.permissions, [true]);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].method, "PUT");
    assert.match(f.calls[0].headers.get("Authorization")!, /^Bearer /);
    assert.equal(f.calls[0].headers.get("x-hardware-id"), "mdock_native_test");
    assert.deepEqual(f.calls[0].body, {
      deviceId: "mdock_native_test",
      provider: "expo",
      platform: "android",
      token: "fcm-token-1",
    });
    assert.equal(f.push.snapshot().status, "on");
    assert.equal(f.push.shouldPresent(payload), true);
  } finally {
    f.dispose();
  }
});

test("denied OS permission cannot register or claim notifications are on", async () => {
  const f = await setup({ permission: false });
  try {
    await f.push.enable();
    assert.equal(f.push.snapshot().status, "blocked");
    assert.deepEqual(f.calls, []);
    assert.equal(f.push.shouldPresent(payload), false);
    f.setPermission(true);
    await f.push.refresh();
    assert.deepEqual(f.permissions, [true, false]);
    assert.equal(f.push.snapshot().status, "on");
  } finally {
    f.dispose();
  }
});

test("missing Backend and malformed success stay retryable errors, not a registered state", async () => {
  for (const response of [
    () => Response.json({}, { status: 404 }),
    () => Response.json({}),
  ]) {
    const f = await setup({ externalFetch: async () => response() });
    try {
      await f.push.enable();
      assert.equal(f.push.snapshot().status, "error");
      assert.ok(f.push.snapshot().error);
      assert.equal(f.push.shouldPresent(payload), false);
    } finally {
      f.dispose();
    }
  }
});

test("token rotation renews the same device binding and opt out removes it without another prompt", async () => {
  const f = await setup();
  try {
    await f.push.enable();
    f.setToken("fcm-token-2");
    await f.push.refresh();
    assert.deepEqual(f.permissions, [true, false]);
    assert.equal(f.calls[1].body.token, "fcm-token-2");
    await f.push.disable();
    assert.equal(f.calls[2].method, "DELETE");
    assert.equal(f.calls[2].body.token, "fcm-token-2");
    assert.equal(f.unregistered(), 1);
    assert.equal(f.push.snapshot().status, "off");
    await f.push.refresh();
    assert.equal(f.calls.length, 3);
  } finally {
    f.dispose();
  }
});

test("permission revocation removes registration and does not prompt again on foreground", async () => {
  const f = await setup();
  try {
    await f.push.enable();
    f.setPermission(false);
    await f.push.refresh();
    assert.equal(f.push.snapshot().status, "blocked");
    assert.equal(f.calls.at(-1)!.method, "DELETE");
    assert.deepEqual(f.permissions, [true, false]);
  } finally {
    f.dispose();
  }
});

test("opt out invalidates FCM when server cleanup is offline and reports failure if neither cleanup works", async () => {
  for (const nativeFails of [false, true]) {
    const f = await setup({
      externalFetch: async (_input, init) => {
        if (init?.method === "DELETE") throw new Error("offline");
        return Response.json({ registered: true });
      },
      unregister: async () => {
        if (nativeFails) throw new Error("offline");
      },
    });
    try {
      await f.push.enable();
      await f.push.disable();
      assert.equal(f.push.snapshot().status, nativeFails ? "error" : "off");
      assert.equal(f.push.shouldPresent(payload), false);
      assert.equal(f.storage.get("mangadock_push_opt_in:reader-1"), "false");
    } finally {
      f.dispose();
    }
  }
});

test("account logout clears presentation immediately and revokes the old binding", async () => {
  const f = await setup();
  try {
    await f.push.enable();
    await f.auth.app.signOut();
    assert.equal(f.push.shouldPresent(payload), false);
    await f.push.refresh();
    assert.equal(f.push.snapshot().status, "signedOut");
    assert.equal(f.calls.at(-1)!.method, "DELETE");
    assert.equal(f.unregistered(), 1);
    assert.equal(f.storage.get("mangadock_push_opt_in:reader-1"), "true");
  } finally {
    f.dispose();
  }
});

test("a registration acknowledgement after logout cannot re-enable the previous account", async () => {
  let release!: () => void, started!: () => void;
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = await setup({
    externalFetch: async (_input, init) => {
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return Response.json({ registered: true });
    },
  });
  try {
    const enable = f.push.enable();
    await beginning;
    await f.auth.app.signOut();
    release();
    await enable;
    await f.push.refresh();
    assert.equal(f.push.snapshot().status, "signedOut");
    assert.deepEqual(
      f.calls.map((call) => call.method),
      ["PUT", "DELETE"],
    );
  } finally {
    f.dispose();
  }
});

test("logout cancels an OS token request that never resolves instead of holding the operation queue", async () => {
  let started!: () => void;
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = await setup({
    acquireToken: () => {
      started();
      return new Promise<string>(() => {});
    },
  });
  try {
    const enabling = f.push.enable();
    await beginning;
    await f.auth.app.signOut();
    await enabling;
    await f.push.refresh();
    assert.equal(f.push.snapshot().status, "signedOut");
    assert.deepEqual(f.calls, []);
  } finally {
    f.dispose();
  }
});

test("a cold start invalidates a prior owner's token without borrowing the new account credential", async () => {
  const f = await setup({
    storage: new Map([
      ["mangadock_push_registration_owner", "another-reader"],
      ["mangadock_push_opt_in:another-reader", "true"],
    ]),
  });
  try {
    await f.push.refresh();
    assert.equal(f.unregistered(), 1);
    assert.deepEqual(f.calls, []);
    assert.equal(f.push.snapshot().status, "off");
  } finally {
    f.dispose();
  }
});

test("notification taps wait for login, deduplicate startup/listener delivery and never cross accounts", async () => {
  const f = await setup({ signedIn: false });
  try {
    f.push.open(payload, "response-1");
    assert.deepEqual(f.navigations, []);
    await f.auth.app.signIn("reader@example.test", "correct-test-password");
    assert.deepEqual(f.navigations, [{ kind: "post", id: "post-1" }]);
    f.push.open(payload, "response-1");
    f.push.open({ ...payload, recipientUid: "other-reader" }, "response-2");
    assert.equal(f.navigations.length, 1);
    assert.equal(
      f.push.shouldPresent({ ...payload, recipientUid: "other-reader" }),
      false,
    );
  } finally {
    f.dispose();
  }
});

test("push payloads cannot open external sites, auth callbacks or unsupported paths", () => {
  for (const link of [
    "https://other.test/book/1",
    "mangadock://auth/callback?code=secret",
    "javascript:alert(1)",
    "/unknown",
    "/community/p/%2Foutside",
  ]) {
    assert.equal(pushPayload({ ...payload, link }), null);
  }
  for (const data of [
    null,
    [],
    {},
    { ...payload, version: 1 },
    { ...payload, recipientUid: "" },
    { ...payload, notificationId: null },
  ])
    assert.equal(pushPayload(data), null);
  assert.deepEqual(pushPayload(payload), payload);
});

test("local preview uses the same recipient-scoped routing payload without a remote send", async () => {
  const f = await setup();
  try {
    await f.push.preview();
    assert.equal(f.previews.length, 0);
    await f.push.enable();
    await f.push.preview();
    assert.deepEqual(f.previews, [
      {
        version: "1",
        recipientUid: "reader-1",
        notificationId: "local-preview",
        link: "/",
      },
    ]);
    assert.equal(f.calls.length, 1);
    f.push.dispose();
    f.push.open(payload, "disposed-response");
    assert.deepEqual(f.navigations, []);
  } finally {
    f.dispose();
  }
});
