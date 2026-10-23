import { createApi, ApiError } from "./api.ts";
import type { createMobileSession } from "./session.ts";
import {
  notificationDestination,
  type NotificationDestination,
} from "./notification-links.ts";

export type PushPayload = {
  version: "1";
  recipientUid: string;
  notificationId: string;
  link: string;
};

export function pushPayload(data: unknown): PushPayload | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (
    value.version !== "1" ||
    typeof value.recipientUid !== "string" ||
    !value.recipientUid ||
    typeof value.notificationId !== "string" ||
    !value.notificationId ||
    typeof value.link !== "string" ||
    !notificationDestination(value.link)
  )
    return null;
  return value as PushPayload;
}

export type PushState = {
  status: "unavailable" | "signedOut" | "off" | "blocked" | "on" | "error";
  busy: boolean;
  error: string | null;
};

export type PushPlatform = {
  permission(request: boolean): Promise<boolean>;
  token(): Promise<string>;
  unregister(): Promise<void>;
  preview(data: PushPayload): Promise<void>;
};

async function bounded<T>(
  work: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_resolve, reject) => {
        abort = () =>
          reject(new Error("การเชื่อมต่อแจ้งเตือนถูกยกเลิก กรุณาลองอีกครั้ง"));
        timer = setTimeout(abort, 10_000);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

// OS calls are injected so account transitions and HTTP behavior can be tested
// without substituting the controller or Supabase's accepted session.
export function createPushNotifications(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  platform: PushPlatform;
  enabled: boolean;
  navigate(destination: NotificationDestination): void;
}) {
  const api = createApi(options);
  const listeners = new Set<() => void>();
  let owner = options.session.snapshot().account?.uid ?? null;
  let revision = 0;
  let disposed = false;
  let queue = Promise.resolve();
  let request: AbortController | null = null;
  let binding: { uid: string; bearer: string; token: string } | null = null;
  let pending: PushPayload | null = null;
  const handled = new Set<string>();
  let state: PushState = {
    status: !options.enabled ? "unavailable" : owner ? "off" : "signedOut",
    busy: false,
    error: null,
  };
  const preference = (uid: string) => `mangadock_push_opt_in:${uid}`;
  const registrationOwnerKey = "mangadock_push_registration_owner";
  const current = (id: number) => !disposed && revision === id;
  function publish(next: PushState) {
    if (disposed) return;
    state = next;
    listeners.forEach((listener) => listener());
  }
  async function send(method: "PUT" | "DELETE", bearer: string, token: string) {
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await api.request("notifications/push-devices", {
        method,
        headers: { Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({
          deviceId: options.deviceId,
          provider: "expo",
          platform: "android",
          token,
        }),
        signal: controller.signal,
      });
      if (method === "PUT") {
        const result = await response.json();
        if (result?.registered !== true)
          throw new Error(
            "ยังยืนยันการเปิดรับแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง",
          );
      }
    } finally {
      clearTimeout(timeout);
      if (request === controller) request = null;
    }
  }
  async function release() {
    const previous = binding;
    if (!previous) {
      if (await options.storage.getItem(registrationOwnerKey)) {
        await bounded(() => options.platform.unregister());
        await options.storage.setItem(registrationOwnerKey, "");
      }
      return;
    }
    // A failed HTTP acknowledgement must still invalidate the underlying token.
    const results = await Promise.allSettled([
      send("DELETE", previous.bearer, previous.token),
      bounded(() => options.platform.unregister()),
    ]);
    if (results.every((result) => result.status === "rejected"))
      throw new Error("ปิดรับแจ้งเตือนไม่สำเร็จ กรุณาเชื่อมต่อแล้วลองอีกครั้ง");
    if (binding === previous) binding = null;
    await options.storage.setItem(registrationOwnerKey, "");
  }
  function enqueue(work: (id: number) => Promise<void>) {
    const id = revision;
    const task = queue.then(async () => {
      if (!current(id)) return;
      try {
        await work(id);
      } catch (failure) {
        if (current(id))
          publish({
            status: "error",
            busy: false,
            error:
              failure instanceof ApiError && failure.status === 404
                ? "บริการแจ้งเตือนยังไม่พร้อม กรุณาลองอีกครั้งภายหลัง"
                : failure instanceof Error
                  ? failure.message
                  : "ตั้งค่าแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง",
          });
      }
    });
    queue = task;
    return task;
  }
  async function register(id: number, prompt: boolean) {
    const uid = owner;
    if (!uid) return;
    publish({ ...state, busy: true, error: null });
    const allowed = await options.platform.permission(prompt);
    if (!current(id)) return;
    if (!allowed) {
      await release();
      if (current(id)) publish({ status: "blocked", busy: false, error: null });
      return;
    }
    const tokenRequest = new AbortController();
    request = tokenRequest;
    let token: string;
    try {
      token = await bounded(
        () => options.platform.token(),
        tokenRequest.signal,
      );
    } finally {
      if (request === tokenRequest) request = null;
    }
    if (!current(id)) return;
    if (!token.trim()) throw new Error("ไม่สามารถลงทะเบียนอุปกรณ์ได้");
    const bearer = await options.session.accessToken();
    if (!current(id)) return;
    await options.storage.setItem(registrationOwnerKey, uid);
    if (!current(id)) return;
    // Retain even an unacknowledged binding: the server may have accepted it.
    binding = { uid, bearer, token };
    await send("PUT", bearer, token);
    if (current(id)) publish({ status: "on", busy: false, error: null });
  }
  function deliver() {
    if (!pending || !owner) return;
    const data = pending;
    pending = null;
    if (data.recipientUid !== owner) return;
    options.navigate(notificationDestination(data.link)!);
  }
  function refresh() {
    if (!options.enabled || disposed) return Promise.resolve();
    return enqueue(async (id) => {
      await releaseIfDifferentOwner();
      if (!current(id)) return;
      if (!owner) return;
      const optedIn = await options.storage.getItem(preference(owner));
      if (!current(id)) return;
      if (optedIn === "true") await register(id, false);
      else {
        await release();
        if (current(id)) publish({ status: "off", busy: false, error: null });
      }
    });
  }
  async function releaseIfDifferentOwner() {
    if (binding && binding.uid !== owner) await release();
    if (!binding) {
      const previous = await options.storage.getItem(registrationOwnerKey);
      if (previous && previous !== owner) await release();
    }
  }
  const unsubscribe = options.session.subscribe(() => {
    const next = options.session.snapshot().account?.uid ?? null;
    if (next === owner) return;
    owner = next;
    revision++;
    request?.abort();
    publish({
      status: !options.enabled ? "unavailable" : owner ? "off" : "signedOut",
      busy: false,
      error: null,
    });
    deliver();
    void refresh();
  });
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    enable() {
      if (!options.enabled || !owner || state.busy || disposed)
        return Promise.resolve();
      publish({ ...state, busy: true, error: null });
      const uid = owner;
      return enqueue(async (id) => {
        await releaseIfDifferentOwner();
        if (!current(id)) return;
        await options.storage.setItem(preference(uid), "true");
        if (current(id)) await register(id, true);
      });
    },
    disable() {
      if (!options.enabled || !owner || state.busy || disposed)
        return Promise.resolve();
      publish({ ...state, busy: true, error: null });
      const uid = owner;
      return enqueue(async (id) => {
        await options.storage.setItem(preference(uid), "false");
        if (!current(id)) return;
        await release();
        if (current(id)) publish({ status: "off", busy: false, error: null });
      });
    },
    beforeSignOut() {
      if (!options.enabled || disposed) return Promise.resolve();
      // Do not block logout on connectivity. Native token invalidation and
      // owner-scoped server removal are both attempted before session disposal.
      revision++;
      request?.abort();
      pending = null;
      publish({ ...state, status: owner ? "off" : "signedOut", busy: false });
      return enqueue(async () => {
        await release();
      });
    },
    shouldPresent(data: unknown) {
      const payload = pushPayload(data);
      return (
        options.enabled &&
        state.status === "on" &&
        !!payload &&
        payload.recipientUid === owner
      );
    },
    open(data: unknown, responseId: string) {
      if (disposed || !options.enabled || handled.has(responseId)) return;
      const payload = pushPayload(data);
      if (!payload) return;
      handled.add(responseId);
      if (handled.size > 32) handled.delete(handled.values().next().value!);
      pending = payload;
      deliver();
    },
    async preview() {
      if (!owner || state.status !== "on" || state.busy) return;
      await options.platform.preview({
        version: "1",
        recipientUid: owner,
        notificationId: "local-preview",
        link: "/",
      });
    },
    dispose() {
      disposed = true;
      revision++;
      request?.abort();
      unsubscribe();
      pending = null;
      binding = null;
      listeners.clear();
    },
  };
}

export type PushNotifications = ReturnType<typeof createPushNotifications>;
