export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createApi(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
}) {
  async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("x-hardware-id", options.deviceId);
    headers.set("x-manga-dock-client", "mobile");
    if (typeof init.body === "string" && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    const response = await options.fetch(
      new URL(path, options.apiOrigin.replace(/\/?$/, "/")).toString(),
      { ...init, headers },
    );
    if (!response.ok) {
      let message = "ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง";
      const error = await response.json().catch(() => null);
      if (error?.message === "Insufficient balance")
        message = "เหรียญไม่พอ กรุณาเติมเงินแล้วลองปลดล็อกอีกครั้ง";
      else if (response.status === 403) message = "บัญชีนี้ไม่มีสิทธิ์ทำรายการ";
      else if (response.status === 404)
        message = "ไม่พบรายการนี้ หรือรายการไม่พร้อมใช้งานแล้ว";
      throw new ApiError(response.status, message);
    }
    return response;
  }
  return {
    request,
    async json<T>(path: string, init: RequestInit = {}): Promise<T> {
      const body = await (await request(path, init)).text();
      if (!body.trim()) return null as T;
      try {
        return JSON.parse(body) as T;
      } catch {
        throw new ApiError(502, "ข้อมูลจากบริการไม่ถูกต้อง กรุณาลองอีกครั้ง");
      }
    },
  };
}
