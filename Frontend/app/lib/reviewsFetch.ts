import type { ReviewItem, ReviewSummary } from "./reviewTypes";
import { SERVER_FETCH_TIMEOUT_MS } from "./serverFetch";

type Options = { backend: string; fetchImpl?: typeof fetch; timeoutMs?: number };

/** A book's reviews and rating summary for the server-rendered reviews page; "no reviews" when the backend fails or hangs. */
export async function fetchReviews(
  mangaId: string,
  { backend, fetchImpl = fetch, timeoutMs = SERVER_FETCH_TIMEOUT_MS }: Options,
): Promise<{ reviews: ReviewItem[]; summary: ReviewSummary }> {
  const signal = AbortSignal.timeout(timeoutMs);
  const id = encodeURIComponent(mangaId);
  try {
    const [listRes, sumRes] = await Promise.all([
      fetchImpl(`${backend}/reviews/${id}?limit=50`, { next: { revalidate: 60 }, signal } as RequestInit),
      fetchImpl(`${backend}/reviews/${id}/summary`, { next: { revalidate: 60 }, signal } as RequestInit),
    ]);
    const reviews: ReviewItem[] = listRes.ok ? await listRes.json() : [];
    const summary: ReviewSummary = sumRes.ok ? await sumRes.json() : { averageRating: 0, count: 0 };
    return { reviews, summary };
  } catch {
    return { reviews: [], summary: { averageRating: 0, count: 0 } };
  }
}
