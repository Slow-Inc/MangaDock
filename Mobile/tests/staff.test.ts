import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createStaff } from "../src/staff.ts";
const options = {
  apiOrigin: "https://api.example.test",
  deviceId: "mdock_native_test",
};
const staffAccount = () =>
  Response.json({
    uid: "reader-1",
    email: "staff@example.test",
    displayName: "Staff",
    role: 8,
  });
const user = {
  uid: "target-1",
  email: "target@example.test",
  displayName: "Target",
  role: 0,
  plan: "free",
  trustScore: 0,
  joinedAt: "",
  banned: false,
  bannedAt: null,
  ratingAvg: 0,
  walletBalance: 10,
  postCount: 1,
};
test("server permission revocation clears every cached staff view even before the account role refreshes", async () => {
  let revoked = false;
  const auth = fixture({
    loadAccount: async () => staffAccount(),
    externalFetch: async (input) => {
      if (revoked)
        return Response.json({ message: "Forbidden" }, { status: 403 });
      if (new URL(String(input)).pathname === "/admin/users")
        return Response.json({ users: [user], total: 1 });
      return Response.json(user);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const staff = createStaff({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await staff.loadUsers();
  await staff.loadUser(user.uid);
  assert.equal(staff.snapshot().users.items.length, 1);
  revoked = true;
  await staff.loadStats();
  assert.deepEqual(staff.snapshot().users.items, []);
  assert.equal(staff.snapshot().user, null);
  assert.ok(staff.snapshot().statsError);
  staff.dispose();
});
test("staff overview and audit activity read independent server contracts with audit offset and action filters", async () => {
  const stats = {
    totalUsers: 100,
    newUsersToday: 2,
    activePosts: 20,
    transactionsToday: { count: 3, coinSum: 45 },
    recentBans: [],
  };
  const audit = {
    id: "audit-1",
    actor_uid: "reader-1",
    action: "ban_user",
    target_type: "user",
    target_id: "target-1",
    metadata: {},
    created_at: "2026-10-04",
  };
  const auth = fixture({
    loadAccount: async () => staffAccount(),
    externalFetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/admin/stats") return Response.json(stats);
      assert.equal(url.pathname, "/admin/audit");
      assert.equal(url.searchParams.get("offset"), "50");
      assert.equal(url.searchParams.get("action"), "ban_user");
      return Response.json([audit]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const staff = createStaff({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await Promise.all([
    staff.loadStats(),
    staff.loadAudit({ action: "ban_user" }, 50),
  ]);
  assert.equal(staff.snapshot().stats?.transactionsToday.coinSum, 45);
  assert.equal(staff.snapshot().audit.items[0].target_id, user.uid);
  staff.dispose();
});
test("staff transaction filters and detail read the existing ledger and clear private detail after logout", async () => {
  const transaction = {
    id: "tx-1",
    uid: user.uid,
    type: "topup",
    amount: 20,
    balanceAfter: 30,
    description: "Topup",
    referenceId: "payment-1",
    createdAt: "2026-10-04T00:00:00Z",
  };
  const auth = fixture({
    loadAccount: async () => staffAccount(),
    externalFetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/transactions")) {
        assert.equal(url.searchParams.get("uid"), user.uid);
        assert.equal(url.searchParams.get("type"), "topup");
        assert.equal(url.searchParams.get("from"), "2026-10-01");
        return Response.json({ transactions: [transaction], total: 1 });
      }
      assert.equal(url.pathname, "/admin/transactions/tx-1");
      return Response.json(transaction);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const staff = createStaff({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await staff.loadTransactions({
    uid: user.uid,
    type: "topup",
    from: "2026-10-01",
  });
  await staff.loadTransaction("tx-1");
  assert.equal(staff.snapshot().transaction?.referenceId, "payment-1");
  await auth.app.signOut();
  assert.equal(staff.snapshot().transaction, null);
  assert.deepEqual(staff.snapshot().transactions.items, []);
  staff.dispose();
});
test("staff post moderation pins and deletes existing posts only after accepted server responses", async () => {
  let denied = true,
    deleted = false,
    post = {
      id: "post-1",
      title: "Title",
      authorUid: user.uid,
      authorName: user.displayName,
      category: "general",
      createdAt: "",
      pinned: false,
      commentCount: 0,
    };
  const auth = fixture({
    loadAccount: async () => staffAccount(),
    externalFetch: async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "PATCH") {
        if (denied) return Response.json({}, { status: 403 });
        post = { ...post, pinned: JSON.parse(String(init.body)).pinned };
        return new Response(null, { status: 204 });
      }
      if (init?.method === "DELETE") {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      assert.equal(url.pathname, "/admin/content/posts");
      assert.equal(url.searchParams.get("category"), "general");
      return Response.json({
        posts: deleted ? [] : [post],
        total: deleted ? 0 : 1,
      });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const staff = createStaff({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await staff.loadPosts({ category: "general" });
  await assert.rejects(staff.pinPost(post.id, true));
  assert.equal(post.pinned, false);
  assert.deepEqual(staff.snapshot().posts.items, []);
  denied = false;
  await staff.loadPosts({ category: "general" });
  await staff.pinPost(post.id, true);
  assert.equal(staff.snapshot().posts.items[0].pinned, true);
  await staff.deletePost(post.id);
  assert.deepEqual(staff.snapshot().posts.items, []);
  staff.dispose();
});
test("staff role, ban and wallet actions require server acknowledgement and reject invalid balance adjustments", async () => {
  let target = { ...user },
    denied = true;
  const writes: unknown[] = [];
  const auth = fixture({
    loadAccount: async () => staffAccount(),
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/wallet")) {
        if (denied) return Response.json({}, { status: 400 });
        const body = JSON.parse(String(init?.body));
        writes.push(body);
        target = {
          ...target,
          walletBalance: target.walletBalance + body.delta,
        };
        return Response.json({ balance: target.walletBalance });
      }
      if (path.endsWith("/role")) {
        const body = JSON.parse(String(init?.body));
        writes.push(body);
        target = { ...target, role: body.role };
        return new Response(null, { status: 204 });
      }
      if (path.endsWith("/ban") || path.endsWith("/unban")) {
        target = { ...target, banned: path.endsWith("/ban") };
        return new Response(null, { status: 200 });
      }
      return Response.json(
        path.endsWith("/users") ? { users: [target], total: 1 } : target,
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const staff = createStaff({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await staff.loadUser(user.uid);
  await assert.rejects(staff.adjustWallet(0, "Reason"));
  await assert.rejects(staff.adjustWallet(5, ""));
  assert.deepEqual(writes, []);
  await assert.rejects(staff.adjustWallet(-20, "Correction"));
  assert.equal(staff.snapshot().user?.walletBalance, 10);
  denied = false;
  await staff.adjustWallet(5, " Correction ");
  assert.equal(staff.snapshot().user?.walletBalance, 15);
  await staff.changeRole(1);
  assert.equal(staff.snapshot().user?.role, 1);
  await staff.ban(true);
  assert.equal(staff.snapshot().user?.banned, true);
  await staff.ban(false);
  assert.equal(staff.snapshot().user?.banned, false);
  assert.deepEqual(writes, [{ delta: 5, reason: "Correction" }, { role: 1 }]);
  staff.dispose();
});
test("staff uses authenticated server pagination and filters while ordinary accounts cannot load admin data", async () => {
  const auth = fixture({
    loadAccount: async () => staffAccount(),
    externalFetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/admin/users");
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(url.searchParams.get("limit"), "20");
      assert.equal(url.searchParams.get("role"), "1");
      assert.equal(url.searchParams.get("search"), "Target");
      assert.ok(new Headers(init?.headers).get("authorization"));
      return Response.json({ users: [user], total: 21 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const staff = createStaff({
    ...options,
    fetch: auth.fetch,
    session: auth.app,
  });
  await staff.loadUsers({ search: "Target", role: 1 }, 2);
  assert.equal(staff.snapshot().users.items[0].uid, user.uid);
  assert.equal(staff.snapshot().users.total, 21);
  await auth.app.signOut();
  assert.deepEqual(staff.snapshot().users.items, []);
  staff.dispose();
  const reader = fixture();
  await reader.app.signIn("reader@example.test", "correct-test-password");
  const denied = createStaff({
    ...options,
    fetch: reader.fetch,
    session: reader.app,
  });
  await denied.loadUsers();
  assert.ok(denied.snapshot().users.error);
  assert.deepEqual(denied.snapshot().users.items, []);
  denied.dispose();
});
