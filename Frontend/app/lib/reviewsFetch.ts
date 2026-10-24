import type { ReviewItem, ReviewSummary } from "./reviewTypes";
import { SERVER_FETCH_TIMEOUT_MS } from "./serverFetch";

const BACKEND = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type Options = { backend?: string; fetchImpl?: typeof fetch; timeoutMs?: number };

/** A book's reviews and rating summary for the server-rendered reviews page; "no reviews" when the backend fails or hangs. */
export async function fetchReviews(
  mangaId: string,
  { backend = BACKEND, fetchImpl = fetch, timeoutMs = SERVER_FETCH_TIMEOUT_MS }: Options = {},
): Promise<{ reviews: ReviewItem[]; summary: ReviewSummary }> {
  const init: RequestInit = { next: { revalidate: 60 }, signal: AbortSignal.timeout(timeoutMs) }; // one deadline for the page
  const id = encodeURIComponent(mangaId);
  try {
    const [listRes, sumRes] = await Promise.all([
      fetchImpl(`${backend}/reviews/${id}?limit=50`, init),
      fetchImpl(`${backend}/reviews/${id}/summary`, init),
    ]);
    const reviews: ReviewItem[] = listRes.ok ? await listRes.json() : [];
    const summary: ReviewSummary = sumRes.ok ? await sumRes.json() : { averageRating: 0, count: 0 };
    return { reviews, summary };
  } catch {
    return { reviews: [], summary: { averageRating: 0, count: 0 } };
  }
}
