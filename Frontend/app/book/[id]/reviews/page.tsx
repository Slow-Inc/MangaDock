import type { Metadata } from "next";
import Link from "next/link";
import ReviewCard from "../../../components/ReviewCard";
import StarRating from "../../../components/StarRating";
import type { ReviewItem, ReviewSummary } from "../../../lib/reviewTypes";

type Props = { params: Promise<{ id: string }> };

const BACKEND = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function fetchReviews(mangaId: string): Promise<{ reviews: ReviewItem[]; summary: ReviewSummary }> {
  try {
    const [listRes, sumRes] = await Promise.all([
      fetch(`${BACKEND}/reviews/${encodeURIComponent(mangaId)}?limit=50`, { next: { revalidate: 60 } }),
      fetch(`${BACKEND}/reviews/${encodeURIComponent(mangaId)}/summary`, { next: { revalidate: 60 } }),
    ]);
    const reviews: ReviewItem[] = listRes.ok ? await listRes.json() : [];
    const summary: ReviewSummary = sumRes.ok ? await sumRes.json() : { averageRating: 0, count: 0 };
    return { reviews, summary };
  } catch {
    return { reviews: [], summary: { averageRating: 0, count: 0 } };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `รีวิว — MangaDock`, description: `รีวิวผู้อ่านสำหรับ manga ${id}` };
}

export default async function ReviewsPage({ params }: Props) {
  const { id } = await params;
  const { reviews, summary } = await fetchReviews(id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/book/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับ
      </Link>

      <div className="mb-8">
        <h1 className="text-xl font-bold text-white/90">รีวิวทั้งหมด</h1>
        {summary.count > 0 && (
          <div className="mt-2 flex items-center gap-3">
            <StarRating value={Math.round(summary.averageRating)} readonly size="md" />
            <span className="text-sm text-white/50">
              {summary.averageRating.toFixed(1)} / 5 · {summary.count} รีวิว
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="py-12 text-center text-sm text-white/30">ยังไม่มีรีวิว</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </main>
  );
}
