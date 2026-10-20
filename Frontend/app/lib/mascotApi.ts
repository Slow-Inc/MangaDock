/** Client for the caller's mascot (Backend GET/PUT /users/me/mascot, Epic D #784). */
import { apiFetch } from "./apiFetch";
import { createAuthHeaders } from "./apiUtils";
import { sanitizeMascot, type MascotConfig } from "./mascot";

const BASE = "/api/proxy/users/me/mascot";

/**
 * The saved mascot (null when none is saved, or the server cannot say — the editor then starts from a
 * default) and whether saving is possible: 503 means the server's mascot storage is not enabled yet.
 */
export async function getMyMascot(token: string): Promise<{ mascot: MascotConfig | null; canSave: boolean }> {
  const res = await apiFetch(BASE, { headers: createAuthHeaders(token) });
  if (!res.ok) return { mascot: null, canSave: res.status !== 503 };
  const body = (await res.json().catch(() => null)) as { mascot?: unknown } | null;
  return { mascot: sanitizeMascot(body?.mascot), canSave: true };
}

export async function saveMyMascot(token: string, mascot: MascotConfig): Promise<void> {
  const res = await apiFetch(BASE, {
    method: "PUT",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(mascot),
  });
  if (res.status === 503) throw new Error("ยังบันทึกมาสคอตไม่ได้ ระบบกำลังเปิดใช้งาน");
  if (!res.ok) throw new Error(`บันทึกมาสคอตไม่สำเร็จ (${res.status})`);
}
