export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// Auth stays in the web process. The shell supplies only device identity and OS APIs.
export function createApi(options: { apiOrigin: string; deviceId: string; fetch: typeof fetch }) {
  return {
    async request(path: string, init: RequestInit): Promise<Response> {
      const headers = new Headers(init.headers);
      headers.set("x-hardware-id", options.deviceId);
      headers.set("x-manga-dock-client", "android-mobile-shell");
      headers.set("Content-Type", "application/json");
      const response = await options.fetch(new URL(path, options.apiOrigin).href, { ...init, headers });
      if (!response.ok) throw new ApiError(response.status, "ตั้งค่าแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง");
      return response;
    },
  };
}
