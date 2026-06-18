import { getHardwareId } from "./fingerprint";

/**
 * HWID-tagged fetch (zero-trust asset protection): every reader/chapter request
 * carries the `x-hardware-id` header the backend's HardwareIdMiddleware requires.
 * Extracted from MangaReader (#302) so the chapter-list hook reuses the single
 * source of the header instead of duplicating the HWID logic.
 */
export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const hwid = getHardwareId();
  return fetch(url, {
    ...init,
    headers: {
      "x-hardware-id": hwid,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}
