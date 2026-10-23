import { getHardwareId } from "./fingerprint";
import { getContentLevel, isCatalogUrl } from "./contentLevel";
import { supabase } from "./supabase";

/**
 * HWID-tagged fetch (zero-trust asset protection): every reader/chapter request
 * carries the `x-hardware-id` header the backend's HardwareIdMiddleware requires.
 * Extracted from MangaReader (#302) so the chapter-list hook reuses the single
 * source of the header instead of duplicating the HWID logic.
 *
 * Catalog reads also carry the session token while the user's 18+ level is above `off`, so the server can apply it
 * (#1102); at `off` nothing changes.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const hwid = getHardwareId();
  const auth: Record<string, string> = {};
  if (getContentLevel() !== "off" && isCatalogUrl(url)) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) auth.Authorization = `Bearer ${data.session.access_token}`;
  }
  return fetch(url, {
    ...init,
    headers: {
      "x-hardware-id": hwid,
      ...auth,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}
