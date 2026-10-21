import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import ReviewCard from "../../../components/ReviewCard";
import Mascot from "../../../components/mascot/Mascot";
import StarRating from "../../../components/StarRating";
import { fetchReviews } from "../../../lib/reviewsFetch";
import { PageTitle } from "../../../hooks/pageTitle";

type Props = { params: Promise<{ id: string }> };

const BACKEND = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: "รีวิว · MangaDock", description: `รีวิวผู้อ่านสำหรับ manga ${id}` };
}

export default async function ReviewsPage({ params }: Props) {
  const { id } = await params;
  const { reviews, summary } = await fetchReviews(id, { backend: BACKEND });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <PageTitle title="รีวิว" />
      <Navbar />
      <main className="page-shell page-shell-nav">
        <div className="max-w-3xl">
          <Link
            href={`/book/${id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 transition hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            กลับไปหน้ามังงะ
          </Link>

          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold text-ink md:text-3xl">รีวิวทั้งหมด</h1>
            {summary.count > 0 ? (
              <div className="mt-2 flex items-center gap-3">
                <StarRating value={Math.round(summary.averageRating)} readonly size="md" />
                <span className="text-sm text-ink-2">
                  {summary.averageRating.toFixed(1)} / 5 · {summary.count} รีวิว
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-3">ความเห็นของผู้อ่านเรื่องนี้</p>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
              <div className="flex justify-center">
                <Mascot area="community" size={72} />
              </div>
              <p className="mt-3 font-medium text-ink-3">ยังไม่มีรีวิว</p>
              <Link href={`/book/${id}`} className="mt-1 inline-block text-sm text-accent hover:underline">
                อ่านแล้วเขียนรีวิวแรกได้ที่หน้ามังงะ
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
