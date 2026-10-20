/** Client for the caller's mascot (Backend GET/PUT /users/me/mascot, Epic D #784). */
import { apiFetch } from "./apiFetch";
import { createAuthHeaders } from "./apiUtils";
import { sanitizeMascot, type MascotConfig } from "./mascot";

const BASE = "/api/proxy/users/me/mascot";

/** The saved mascot, or null when none is saved (or the server cannot say — the editor then starts from a default). */
export async function getMyMascot(token: string): Promise<MascotConfig | null> {
  const res = await apiFetch(BASE, { headers: createAuthHeaders(token) });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { mascot?: unknown } | null;
  return sanitizeMascot(body?.mascot);
}

export async function saveMyMascot(token: string, mascot: MascotConfig): Promise<void> {
  const res = await apiFetch(BASE, {
    method: "PUT",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(mascot),
  });
  if (!res.ok) throw new Error(`บันทึกมาสคอตไม่สำเร็จ (${res.status})`);
}
