import { createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
export type Checkin = {
  checkedInToday: boolean;
  streakDay: number;
  coinsToday: number;
};
export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};
export type Transaction = {
  id: string;
  uid: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
};
export function createAccountActivity(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const emptyNotifications = () => ({
    items: [] as Notification[],
    unread: 0,
    loading: false,
    error: null as string | null,
  });
  const emptyTransactions = () => ({
    items: [] as Transaction[],
    loading: false,
    error: null as string | null,
  });
  let state = {
    checkin: {
      data: null as Checkin | null,
      loading: false,
      error: null as string | null,
    },
    balance: null as number | null,
    notifications: emptyNotifications(),
    transactions: emptyTransactions(),
  };
  const listeners = new Set<() => void>();
  const api = createApi(options);
  function publish(next: typeof state) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  let claiming: Promise<boolean> | null = null;
  let identity = 0,
    owner = options.session.snapshot().account?.uid ?? null;
  let notificationGeneration = 0;
  let countGeneration = 0;
  let checkinGeneration = 0;
  let walletGeneration = 0,
    balanceGeneration = 0;
  const requests = new Set<AbortController>();
  function identityChanged() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (owner === next) return;
    owner = next;
    identity++;
    requests.forEach((request) => request.abort());
    claiming = null;
    publish({
      checkin: { data: null, loading: false, error: null },
      balance: null,
      notifications: emptyNotifications(),
      transactions: emptyTransactions(),
    });
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  async function request(
    path: string,
    init: RequestInit = {},
    current = identity,
  ) {
    const token = await options.session.accessToken();
    if (current !== identity || !unsubscribe) return null;
    const controller = new AbortController();
    requests.add(controller);
    try {
      const response = await api.request(path, {
        ...init,
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      return current === identity && !controller.signal.aborted
        ? response
        : null;
    } finally {
      requests.delete(controller);
    }
  }
  async function json<T>(path: string, current = identity) {
    const response = await request(path, {}, current);
    if (!response) return null;
    const value = (await response.json()) as T;
    return current === identity ? value : null;
  }
  async function refreshBalance(current: number) {
    const generation = ++balanceGeneration;
    const result = await json<{ balance: number }>("wallet/balance", current);
    if (result && current === identity && generation === balanceGeneration)
      publish({ ...state, balance: result.balance });
  }
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async checkin() {
      const current = identity,
        generation = ++checkinGeneration;
      publish({
        ...state,
        checkin: { ...state.checkin, loading: true, error: null },
      });
      try {
        const data = await json<Checkin>("checkin/status", current);
        if (!data || current !== identity || generation !== checkinGeneration)
          return;
        publish({ ...state, checkin: { data, loading: false, error: null } });
      } catch (error) {
        if (current === identity && generation === checkinGeneration)
          publish({
            ...state,
            checkin: {
              ...state.checkin,
              loading: false,
              error:
                error instanceof Error ? error.message : "โหลดเช็กอินไม่สำเร็จ",
            },
          });
      }
    },
    claim(): Promise<boolean> {
      if (claiming) return claiming;
      const current = identity;
      claiming = (async () => {
        let failure: unknown;
        try {
          await request("checkin", { method: "POST" }, current);
        } catch (error) {
          failure = error;
        }
        if (current !== identity) return false;
        await store.checkin();
        try {
          await refreshBalance(current);
        } catch (error) {
          failure ??= error;
        }
        if (current !== identity) return false;
        if (failure) throw failure;
        return true;
      })().finally(() => {
        if (current === identity) claiming = null;
      });
      return claiming;
    },
    async notifications() {
      const current = identity,
        generation = ++notificationGeneration;
      const countRequest = ++countGeneration;
      publish({
        ...state,
        notifications: { ...state.notifications, loading: true, error: null },
      });
      try {
        const [items, count] = await Promise.all([
          json<Notification[]>("notifications?limit=50", current),
          json<{ count: number }>("notifications/unread-count", current),
        ]);
        if (
          !items ||
          !count ||
          current !== identity ||
          generation !== notificationGeneration
        )
          return;
        publish({
          ...state,
          notifications: {
            items,
            unread:
              countRequest === countGeneration
                ? count.count
                : state.notifications.unread,
            loading: false,
            error: null,
          },
        });
      } catch (error) {
        if (current === identity && generation === notificationGeneration)
          publish({
            ...state,
            notifications: {
              ...state.notifications,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "โหลดการแจ้งเตือนไม่สำเร็จ",
            },
          });
      }
    },
    async unreadCount() {
      const current = identity,
        generation = ++countGeneration;
      const result = await json<{ count: number }>(
        "notifications/unread-count",
        current,
      );
      if (result && current === identity && generation === countGeneration)
        publish({
          ...state,
          notifications: { ...state.notifications, unread: result.count },
        });
    },
    async readNotification(id?: string) {
      const current = identity;
      if (
        !(await request(
          id
            ? `notifications/${encodeURIComponent(id)}/read`
            : "notifications/read-all",
          { method: "PATCH" },
          current,
        ))
      )
        return false;
      if (current !== identity) return false;
      await store.notifications();
      return true;
    },
    async wallet() {
      const current = identity,
        generation = ++walletGeneration;
      publish({
        ...state,
        transactions: { ...state.transactions, loading: true, error: null },
      });
      try {
        const [items] = await Promise.all([
          json<Transaction[]>("wallet/transactions", current),
          refreshBalance(current),
        ]);
        if (!items || current !== identity || generation !== walletGeneration)
          return;
        publish({
          ...state,
          transactions: { items, loading: false, error: null },
        });
      } catch (error) {
        if (current === identity && generation === walletGeneration)
          publish({
            ...state,
            transactions: {
              ...state.transactions,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "โหลดประวัติเหรียญไม่สำเร็จ",
            },
          });
      }
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
    },
  };
  return store;
}
