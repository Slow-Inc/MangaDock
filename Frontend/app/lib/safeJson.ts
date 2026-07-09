/**
 * Parse a fetch Response body as a JSON array, tolerating anomalous responses.
 *
 * A backend that returns HTTP 200 with an empty or non-JSON body makes
 * `res.json()` throw `SyntaxError`, and a body that is valid JSON but not an
 * array makes downstream `.map`/`.filter` throw `TypeError`. At the call sites
 * both are swallowed by a `catch { /* ignore *\/ }`, so the data load silently
 * never happens. This helper collapses both anomalies into a single `null`
 * return the caller can branch on.
 *
 * @returns the parsed array, or `null` if the body is missing, malformed, or
 *          not a JSON array.
 */
export async function parseJsonArray<T>(res: Response): Promise<T[] | null> {
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as T[]) : null;
}
