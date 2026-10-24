import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createAccountActivity } from "../src/account-activity.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
test("a check-in status request from before a successful claim cannot make the reward available again", async () => {
  let release!: (response: Response) => void, started!: () => void;
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  let gets = 0;
  const auth = fixture({
    externalFetch: async (input, init) => {
      if (init?.method === "POST")
        return Response.json({
          checkedInToday: true,
          streakDay: 3,
          coinsToday: 7,
        });
      if (String(input).endsWith("/wallet/balance"))
        return Response.json({ balance: 107 });
      if (++gets === 1)
        return new Promise<Response>((resolve) => {
          release = resolve;
          started();
        });
      return Response.json({
        checkedInToday: true,
        streakDay: 3,
        coinsToday: 7,
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  const old = activity.checkin();
  await beginning;
  await activity.claim();
  release(
    Response.json({ checkedInToday: false, streakDay: 2, coinsToday: 6 }),
  );
  await old;
  assert.equal(activity.snapshot().checkin.data?.checkedInToday, true);
  assert.equal(activity.snapshot().balance, 107);
  activity.dispose();
});
test("check-in displays server eligibility and claims the existing reward then reloads the real wallet balance", async () => {
  let claimed = false;
  const requests: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push(`${init?.method ?? "GET"} ${path}`);
      assert.ok(new Headers(init?.headers).get("authorization"));
      if (init?.method === "POST") {
        claimed = true;
        return Response.json({
          checkedInToday: true,
          streakDay: 3,
          coinsToday: 7,
        });
      }
      return Response.json(
        path === "/wallet/balance"
          ? { balance: claimed ? 107 : 100 }
          : { checkedInToday: claimed, streakDay: 3, coinsToday: 7 },
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await activity.checkin();
  assert.equal(activity.snapshot().checkin.data?.checkedInToday, false);
  assert.equal(await activity.claim(), true);
  assert.equal(activity.snapshot().checkin.data?.checkedInToday, true);
  assert.equal(activity.snapshot().balance, 107);
  assert.ok(requests.includes("POST /checkin"));
  activity.dispose();
});

test("duplicate check-in taps share one request and an ambiguous response reconciles status and wallet without inventing a reward", async () => {
  let release!: () => void;
  let posts = 0;
  let credited = false;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "POST") {
        posts++;
        credited = true;
        await waiting;
        throw new Error("Connection lost");
      }
      return Response.json(
        path === "/wallet/balance"
          ? { balance: credited ? 107 : 100 }
          : { checkedInToday: credited, streakDay: 3, coinsToday: 7 },
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  const first = activity.claim(),
    second = activity.claim();
  await new Promise((resolve) => setImmediate(resolve));
  release();
  await Promise.all([assert.rejects(first), assert.rejects(second)]);
  assert.equal(posts, 1);
  assert.equal(activity.snapshot().checkin.data?.checkedInToday, true);
  assert.equal(activity.snapshot().balance, 107);
  activity.dispose();
});

test("a late check-in response cannot restore private state or reconcile another account after logout", async () => {
  let release!: (response: Response) => void;
  const paths: string[] = [];
  const auth = fixture({
    externalFetch: async (input) => {
      paths.push(new URL(String(input)).pathname);
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  const loading = activity.checkin();
  await new Promise((resolve) => setImmediate(resolve));
  await auth.app.signOut();
  release(Response.json({ checkedInToday: true, streakDay: 3, coinsToday: 7 }));
  await loading;
  assert.equal(activity.snapshot().checkin.data, null);
  assert.equal(activity.snapshot().balance, null);
  assert.deepEqual(paths, ["/checkin/status"]);
  activity.dispose();
});

test("notifications preserve server unread count and acknowledge single/all reads using the existing empty-body routes", async () => {
  const item = {
    id: "notice-1",
    type: "reply",
    title: "Reply",
    body: "Hello",
    link: "/community/p/post-1",
    read: false,
    createdAt: "2026-10-04",
  };
  const paths: string[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      paths.push(`${init?.method ?? "GET"} ${path}`);
      if (init?.method === "PATCH") {
        item.read = true;
        return new Response(null, { status: 204 });
      }
      return Response.json(
        path.endsWith("/unread-count") ? { count: item.read ? 0 : 1 } : [item],
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await activity.notifications();
  assert.equal(activity.snapshot().notifications.unread, 1);
  await activity.readNotification("notice-1");
  assert.equal(activity.snapshot().notifications.items[0]?.read, true);
  await activity.readNotification();
  assert.equal(activity.snapshot().notifications.unread, 0);
  assert.ok(paths.includes("PATCH /notifications/notice-1/read"));
  assert.ok(paths.includes("PATCH /notifications/read-all"));
  activity.dispose();
});

test("wallet history uses the existing latest ledger and balance and clears both when the account signs out", async () => {
  const transaction = {
    id: "tx-1",
    uid: "reader-1",
    type: "purchase",
    amount: -10,
    balanceAfter: 90,
    description: "Chapter",
    referenceId: "version-1",
    createdAt: "2026-10-04",
  };
  const auth = fixture({
    externalFetch: async (input) =>
      Response.json(
        new URL(String(input)).pathname === "/wallet/balance"
          ? { balance: 90 }
          : [transaction],
      ),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await activity.wallet();
  assert.deepEqual(activity.snapshot().transactions.items, [transaction]);
  assert.equal(activity.snapshot().balance, 90);
  await auth.app.signOut();
  assert.deepEqual(activity.snapshot().transactions.items, []);
  assert.equal(activity.snapshot().balance, null);
  activity.dispose();
});

test("a stale wallet refresh cannot replace the balance confirmed after check-in", async () => {
  let release!: (response: Response) => void;
  let reads = 0;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/wallet/balance") {
        reads++;
        return reads === 1
          ? new Promise<Response>((resolve) => {
              release = resolve;
            })
          : Response.json({ balance: 107 });
      }
      return init?.method === "POST"
        ? new Response(null, { status: 201 })
        : Response.json(
            path === "/wallet/transactions"
              ? []
              : { checkedInToday: true, streakDay: 3, coinsToday: 7 },
          );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  const old = activity.wallet();
  await new Promise((resolve) => setImmediate(resolve));
  await activity.claim();
  release(Response.json({ balance: 100 }));
  await old;
  assert.equal(activity.snapshot().balance, 107);
  activity.dispose();
});

test("the foreground notification badge refreshes only the count endpoint", async () => {
  const paths: string[] = [];
  const auth = fixture({
    externalFetch: async (input) => {
      paths.push(new URL(String(input)).pathname);
      return Response.json({ count: 4 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const activity = createAccountActivity({
    ...options,
    session: auth.app,
    fetch: auth.fetch,
  });
  await activity.unreadCount();
  assert.equal(activity.snapshot().notifications.unread, 4);
  assert.deepEqual(paths, ["/notifications/unread-count"]);
  activity.dispose();
});
