import type { ContentLevel } from "./contentLevel";

/** GET/PUT /users/me/content-settings (#1101): the level, and when the age / Terms were confirmed. */
export type ContentSettings = { level: ContentLevel; ageConfirmedAt: string | null; tosAcceptedAt: string | null };

const BASE = "/api/proxy/users/me/content-settings";

export async function getContentSettings(token: string): Promise<ContentSettings> {
  const r = await fetch(BASE, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`content settings ${r.status}`);
  return r.json();
}

export async function saveContentSettings(
  token: string,
  body: { level: ContentLevel; confirmAge?: boolean; acceptTos?: boolean },
): Promise<ContentSettings> {
  const r = await fetch(BASE, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`content settings ${r.status}`);
  return r.json();
}
