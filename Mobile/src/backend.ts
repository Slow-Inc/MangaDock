import type { Account } from "./session.ts";

export function createAccountApi(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
}) {
  return {
    async loadAccount(token: string): Promise<Account> {
      const headers = {
        Authorization: `Bearer ${token}`,
        "x-hardware-id": options.deviceId,
        "x-manga-dock-client": "mobile",
      };
      const url = new URL(
        "users/me",
        options.apiOrigin.replace(/\/?$/, "/"),
      ).toString();
      const sync = await options.fetch(url, { method: "POST", headers });
      if (!sync.ok) throw new Error("ไม่สามารถเชื่อมบัญชีกับ MangaDock ได้");
      const response = await options.fetch(url, { headers });
      if (!response.ok) throw new Error("ไม่สามารถโหลดบัญชี MangaDock ได้");
      const account = await response.json();
      await options
        .fetch(
          new URL(
            "users/me/record-device",
            options.apiOrigin.replace(/\/?$/, "/"),
          ).toString(),
          { method: "POST", headers },
        )
        .catch(() => {});
      return account;
    },
  };
}
