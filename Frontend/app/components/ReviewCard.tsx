"use client";

import StarRating from "./StarRating";
import UserAvatar from "./ui/UserAvatar";
import type { ReviewItem } from "../lib/reviewTypes";

type Props = {
  review: ReviewItem;
  isOwn?: boolean;
  onDelete?: () => void;
  /** The delete is in flight: the button is disabled (#987). */
  deleting?: boolean;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อกี้";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function ReviewCard({ review, isOwn, onDelete, deleting }: Props) {

  return (
    <div className={`rounded-xl border p-4 ${isOwn ? "border-accent/40 bg-accent/10" : "border-line bg-fill"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <UserAvatar uid={review.uid} photoUrl={review.photoUrl} size={32} />
          <div>
            <p className="text-sm font-semibold text-ink">
              {review.displayName ?? "ผู้ใช้ไม่ระบุชื่อ"}
              {isOwn && <span className="ml-1.5 text-xs font-medium text-accent">คุณ</span>}
            </p>
            <p className="text-xs text-ink-3">{timeAgo(review.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} readonly size="sm" />
          {isOwn && onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="rounded-lg p-1 text-ink-2 transition hover:text-danger disabled:opacity-40"
              title="ลบรีวิวของฉัน"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {review.body && (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{review.body}</p>
      )}
    </div>
  );
}
