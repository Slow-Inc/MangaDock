/**
 * Shared HTTP helpers. Pure, dependency-light, unit-tested in apiUtils.test.ts.
 * Replaces the per-file authHeaders/parseErrorMessage copies in
 * communityApi.ts, studioApi.ts, userCache.ts, readingHistory.ts.
 */

export function createAuthHeaders(
  token?: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function parseErrorResponse(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const json = JSON.parse(body) as { message?: string | string[]; error?: string };
    if (Array.isArray(json?.message)) return json.message.join(", ");
    if (typeof json?.message === "string") return json.message;
    if (typeof json?.error === "string") return json.error;
  } catch {
    // body is not JSON — fall through
  }
  return body || `HTTP ${res.status}`;
}
