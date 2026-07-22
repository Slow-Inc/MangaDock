"use client";

import Image from "next/image";
import StarRating from "./StarRating";
import type { ReviewItem } from "../lib/reviewTypes";

type Props = {
  review: ReviewItem;
  isOwn?: boolean;
  onDelete?: () => void;
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

export default function ReviewCard({ review, isOwn, onDelete }: Props) {
  const initials = (review.displayName ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className={`rounded-xl border p-4 ${isOwn ? "border-indigo-500/40 bg-indigo-500/5" : "border-white/8 bg-white/3"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {review.photoUrl ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
              <Image src={review.photoUrl} alt="" fill className="object-cover" sizes="32px" />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white/90">
              {review.displayName ?? "ผู้ใช้ไม่ระบุชื่อ"}
              {isOwn && <span className="ml-1.5 text-xs font-medium text-indigo-400">คุณ</span>}
            </p>
            <p className="text-xs text-white/35">{timeAgo(review.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} readonly size="sm" />
          {isOwn && onDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg p-1 text-white/30 transition hover:text-red-400"
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
        <p className="mt-3 text-sm leading-relaxed text-white/65">{review.body}</p>
      )}
    </div>
  );
}
