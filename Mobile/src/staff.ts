import { ApiError, createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
export type StaffUser = {
  uid: string;
  email: string;
  displayName: string;
  role: number;
  plan: string;
  trustScore: number;
  joinedAt: string;
  banned: boolean;
  bannedAt: string | null;
};
export type StaffUserDetail = StaffUser & {
  ratingAvg: number;
  walletBalance: number;
  postCount: number;
};
export type UserFilter = {
  search?: string;
  role?: number;
  plan?: string;
  banned?: true;
};
export type StaffPost = {
  id: string;
  title: string;
  authorUid: string;
  authorName: string;
  category: string;
  createdAt: string;
  pinned: boolean;
  commentCount: number;
};
export type PostFilter = {
  search?: string;
  category?: string;
  authorUid?: string;
};
export type StaffTransaction = {
  id: string;
  uid: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
};
export type TransactionFilter = {
  uid?: string;
  type?: string;
  from?: string;
  to?: string;
};
export type StaffStats = {
  totalUsers: number;
  newUsersToday: number;
  activePosts: number;
  transactionsToday: { count: number; coinSum: number };
  recentBans: { uid: string; displayName: string; bannedAt: string }[];
};
export type AuditLog = {
  id: string;
  actor_uid: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
export type AuditFilter = { action?: string; actorUid?: string };
type Listing<T, Q> = {
  items: T[];
  total: number;
  page: number;
  query: Q;
  loading: boolean;
  error: string | null;
};
function listing<T, Q>(): Listing<T, Q> {
  return {
    items: [],
    total: 0,
    page: 1,
    query: {} as Q,
    loading: false,
    error: null,
  };
}
function queryString(query: object, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}
export function createStaff(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  const initialState = () => ({
    users: listing<StaffUser, UserFilter>(),
    posts: listing<StaffPost, PostFilter>(),
    transactions: listing<StaffTransaction, TransactionFilter>(),
    userUid: null as string | null,
    user: null as StaffUserDetail | null,
    userLoading: false,
    userError: null as string | null,
    transactionId: null as string | null,
    transaction: null as StaffTransaction | null,
    transactionLoading: false,
    transactionError: null as string | null,
    stats: null as StaffStats | null,
    statsLoading: false,
    statsError: null as string | null,
    audit: {
      items: [] as AuditLog[],
      offset: 0,
      query: {} as AuditFilter,
      loading: false,
      error: null as string | null,
      hasMore: false,
    },
  });
  let state = initialState();
  const listeners = new Set<() => void>(),
    requests = new Set<AbortController>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const accountKey = () => {
    const account = options.session.snapshot().account;
    return account ? `${account.uid}:${account.role}` : null;
  };
  let identity = 0,
    owner = accountKey(),
    usersGeneration = 0,
    userGeneration = 0,
    postsGeneration = 0,
    transactionsGeneration = 0,
    transactionGeneration = 0,
    statsGeneration = 0,
    auditGeneration = 0;
  const identityChanged = () => {
    const next = accountKey();
    if (owner !== next) {
      owner = next;
      identity++;
      requests.forEach((request) => request.abort());
      publish(initialState());
    }
  };
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  async function request(path: string, init: RequestInit = {}) {
    const epoch = identity,
      token = await options.session.accessToken();
    if (epoch !== identity || !unsubscribe) return null;
    if (!(Number(options.session.snapshot().account?.role) >= 8))
      throw new Error("หน้านี้สำหรับทีมงานที่มีสิทธิ์");
    const controller = new AbortController();
    requests.add(controller);
    try {
      const response = await api.request(path, {
        ...init,
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      return epoch === identity && !controller.signal.aborted ? response : null;
    } catch (error) {
      if (
        epoch === identity &&
        error instanceof ApiError &&
        [401, 403].includes(error.status)
      ) {
        identity++;
        requests.forEach((request) => request.abort());
        const cleared = initialState();
        publish({
          ...cleared,
          users: { ...cleared.users, error: error.message },
          posts: { ...cleared.posts, error: error.message },
          transactions: { ...cleared.transactions, error: error.message },
          audit: { ...cleared.audit, error: error.message },
          statsError: error.message,
          userError: error.message,
          transactionError: error.message,
        });
      }
      throw error;
    } finally {
      requests.delete(controller);
    }
  }
  async function userMutation(suffix: string, init: RequestInit) {
    const user = state.user,
      epoch = identity,
      current = userGeneration,
      list = usersGeneration;
    if (!user) throw new Error("เลือกผู้ใช้ก่อนทำรายการ");
    const response = await request(
      `admin/users/${encodeURIComponent(user.uid)}/${suffix}`,
      init,
    );
    if (!response || epoch !== identity || current !== userGeneration)
      return false;
    await store.loadUser(user.uid);
    if (epoch === identity && list === usersGeneration)
      await store.loadUsers(state.users.query, state.users.page);
    return epoch === identity;
  }
  async function postMutation(id: string, suffix: string, init: RequestInit) {
    const epoch = identity,
      current = postsGeneration;
    const response = await request(
      `admin/content/posts/${encodeURIComponent(id)}${suffix}`,
      init,
    );
    if (!response || epoch !== identity || current !== postsGeneration)
      return false;
    await store.loadPosts(state.posts.query, state.posts.page);
    return epoch === identity;
  }
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async loadUsers(query: UserFilter = {}, page = 1) {
      const epoch = identity,
        current = ++usersGeneration;
      publish({
        ...state,
        users: {
          ...listing<StaffUser, UserFilter>(),
          query,
          page,
          loading: true,
        },
      });
      try {
        const response = await request(
          `admin/users?${queryString(query, page)}`,
        );
        if (!response) return;
        const data = (await response.json()) as {
          users: StaffUser[];
          total: number;
        };
        if (epoch === identity && current === usersGeneration)
          publish({
            ...state,
            users: {
              items: data.users,
              total: data.total,
              page,
              query,
              loading: false,
              error: null,
            },
          });
      } catch (error) {
        if (epoch === identity && current === usersGeneration)
          publish({
            ...state,
            users: {
              ...state.users,
              loading: false,
              error:
                error instanceof Error ? error.message : "โหลดผู้ใช้ไม่สำเร็จ",
            },
          });
      }
    },
    async loadPosts(query: PostFilter = {}, page = 1) {
      const epoch = identity,
        current = ++postsGeneration;
      publish({
        ...state,
        posts: {
          ...listing<StaffPost, PostFilter>(),
          query,
          page,
          loading: true,
        },
      });
      try {
        const response = await request(
          `admin/content/posts?${queryString(query, page)}`,
        );
        if (!response) return;
        const data = (await response.json()) as {
          posts: StaffPost[];
          total: number;
        };
        if (epoch === identity && current === postsGeneration)
          publish({
            ...state,
            posts: {
              items: data.posts,
              total: data.total,
              page,
              query,
              loading: false,
              error: null,
            },
          });
      } catch (error) {
        if (epoch === identity && current === postsGeneration)
          publish({
            ...state,
            posts: {
              ...state.posts,
              loading: false,
              error:
                error instanceof Error ? error.message : "โหลดเนื้อหาไม่สำเร็จ",
            },
          });
      }
    },
    pinPost(id: string, pinned: boolean) {
      return postMutation(id, "/pin", {
        method: "PATCH",
        body: JSON.stringify({ pinned }),
      });
    },
    deletePost(id: string) {
      return postMutation(id, "", { method: "DELETE" });
    },
    async loadTransactions(query: TransactionFilter = {}, page = 1) {
      const epoch = identity,
        current = ++transactionsGeneration;
      publish({
        ...state,
        transactions: {
          ...listing<StaffTransaction, TransactionFilter>(),
          query,
          page,
          loading: true,
        },
      });
      try {
        const response = await request(
          `admin/transactions?${queryString(query, page)}`,
        );
        if (!response) return;
        const data = (await response.json()) as {
          transactions: StaffTransaction[];
          total: number;
        };
        if (epoch === identity && current === transactionsGeneration)
          publish({
            ...state,
            transactions: {
              items: data.transactions,
              total: data.total,
              page,
              query,
              loading: false,
              error: null,
            },
          });
      } catch (error) {
        if (epoch === identity && current === transactionsGeneration)
          publish({
            ...state,
            transactions: {
              ...state.transactions,
              loading: false,
              error:
                error instanceof Error ? error.message : "โหลดธุรกรรมไม่สำเร็จ",
            },
          });
      }
    },
    async loadTransaction(id: string) {
      const epoch = identity,
        current = ++transactionGeneration;
      publish({
        ...state,
        transactionId: id,
        transaction: null,
        transactionLoading: true,
        transactionError: null,
      });
      try {
        const response = await request(
          `admin/transactions/${encodeURIComponent(id)}`,
        );
        if (!response) return;
        const transaction = (await response.json()) as StaffTransaction;
        if (epoch === identity && current === transactionGeneration)
          publish({ ...state, transaction, transactionLoading: false });
      } catch (error) {
        if (epoch === identity && current === transactionGeneration)
          publish({
            ...state,
            transactionLoading: false,
            transactionError:
              error instanceof Error ? error.message : "โหลดธุรกรรมไม่สำเร็จ",
          });
      }
    },
    closeTransaction() {
      transactionGeneration++;
      publish({
        ...state,
        transactionId: null,
        transaction: null,
        transactionLoading: false,
        transactionError: null,
      });
    },
    async loadStats() {
      const epoch = identity,
        current = ++statsGeneration;
      publish({ ...state, statsLoading: true, statsError: null });
      try {
        const response = await request("admin/stats");
        if (!response) return;
        const stats = (await response.json()) as StaffStats;
        if (epoch === identity && current === statsGeneration)
          publish({ ...state, stats, statsLoading: false });
      } catch (error) {
        if (epoch === identity && current === statsGeneration)
          publish({
            ...state,
            statsLoading: false,
            statsError:
              error instanceof Error ? error.message : "โหลดภาพรวมไม่สำเร็จ",
          });
      }
    },
    async loadAudit(query: AuditFilter = {}, offset = 0) {
      const epoch = identity,
        current = ++auditGeneration;
      publish({
        ...state,
        audit: {
          items: [],
          query,
          offset,
          loading: true,
          error: null,
          hasMore: false,
        },
      });
      try {
        const params = new URLSearchParams({
          limit: "50",
          offset: String(offset),
        });
        Object.entries(query).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        const response = await request(`admin/audit?${params}`);
        if (!response) return;
        const items = (await response.json()) as AuditLog[];
        if (epoch === identity && current === auditGeneration)
          publish({
            ...state,
            audit: {
              items,
              query,
              offset,
              loading: false,
              error: null,
              hasMore: items.length === 50,
            },
          });
      } catch (error) {
        if (epoch === identity && current === auditGeneration)
          publish({
            ...state,
            audit: {
              ...state.audit,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "โหลดประวัติการจัดการไม่สำเร็จ",
            },
          });
      }
    },
    async loadUser(uid: string) {
      const epoch = identity,
        current = ++userGeneration;
      publish({
        ...state,
        userUid: uid,
        user: null,
        userLoading: true,
        userError: null,
      });
      try {
        const response = await request(
          `admin/users/${encodeURIComponent(uid)}`,
        );
        if (!response) return;
        const user = (await response.json()) as StaffUserDetail;
        if (epoch === identity && current === userGeneration)
          publish({ ...state, user, userLoading: false });
      } catch (error) {
        if (epoch === identity && current === userGeneration)
          publish({
            ...state,
            userLoading: false,
            userError:
              error instanceof Error ? error.message : "โหลดผู้ใช้ไม่สำเร็จ",
          });
      }
    },
    closeUser() {
      userGeneration++;
      publish({
        ...state,
        userUid: null,
        user: null,
        userLoading: false,
        userError: null,
      });
    },
    changeRole(role: number) {
      if (![0, 1, 2].includes(role) || !state.user || state.user.role >= 8)
        return Promise.reject(
          new Error("เปลี่ยนได้เฉพาะ role นักอ่าน นักแปล และผู้สร้าง"),
        );
      return userMutation("role", {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    },
    ban(banned: boolean) {
      if (!state.user || (banned && state.user.role >= 8))
        return Promise.reject(new Error("ไม่สามารถแบนบัญชีทีมงานได้"));
      return userMutation(banned ? "ban" : "unban", { method: "POST" });
    },
    adjustWallet(delta: number, reason: string) {
      if (
        !Number.isInteger(delta) ||
        !delta ||
        Math.abs(delta) > 1_000_000 ||
        !reason.trim() ||
        reason.trim().length > 200
      )
        return Promise.reject(
          new Error(
            "ระบุจำนวนเหรียญเต็มที่ไม่เป็นศูนย์และเหตุผลไม่เกิน 200 ตัวอักษร",
          ),
        );
      return userMutation("wallet", {
        method: "PATCH",
        body: JSON.stringify({ delta, reason: reason.trim() }),
      });
    },
    activate() {
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      identity++;
      requests.forEach((request) => request.abort());
      unsubscribe?.();
      unsubscribe = undefined;
      publish(initialState());
    },
  };
  return store;
}
