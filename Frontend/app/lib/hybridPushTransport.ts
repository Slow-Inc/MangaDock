type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
type ShellWindow = Window & {
  __MANGA_DOCK_PUSH_ENABLED__?: boolean;
  ReactNativeWebView?: { postMessage(message: string): void };
};

export function hybridPushAvailable() {
  return typeof window !== "undefined" && (window as ShellWindow).__MANGA_DOCK_PUSH_ENABLED__ === true;
}

export function createHybridPushTransport(onEvent: (event: Record<string, unknown>) => void) {
  const pending = new Map<string, Pending>();
  let sequence = 0;
  const instance = crypto.randomUUID();
  const receive = (event: Event) => {
    const data: unknown = (event as CustomEvent).detail;
    if (!data || typeof data !== "object") return;
    const value = data as Record<string, unknown>;
    if (typeof value.id !== "string") { onEvent(value); return; }
    const request = pending.get(value.id);
    if (!request) return;
    pending.delete(value.id);
    clearTimeout(request.timer);
    if (value.ok === true) request.resolve(value.result);
    else request.reject(new Error("เชื่อมต่อการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง"));
  };
  window.addEventListener("mangadock:push", receive);
  return {
    request<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
      return new Promise((resolve, reject) => {
        const id = `${instance}:${++sequence}`;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("การแจ้งเตือนตอบกลับช้า กรุณาลองอีกครั้ง"));
        }, 8000);
        pending.set(id, { resolve: value => resolve(value as T), reject, timer });
        const bridge = (window as ShellWindow).ReactNativeWebView;
        if (!bridge) { clearTimeout(timer); pending.delete(id); reject(new Error("กรุณาเปิดจากแอป MangaDock")); return; }
        try { bridge.postMessage(JSON.stringify({ source: "mangadock-web", type: "push_request", id, action, ...data })); }
        catch { clearTimeout(timer); pending.delete(id); reject(new Error("เชื่อมต่อแอปไม่สำเร็จ")); }
      });
    },
    dispose() {
      window.removeEventListener("mangadock:push", receive);
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error("ยกเลิกการแจ้งเตือน")); }
      pending.clear();
    },
  };
}
