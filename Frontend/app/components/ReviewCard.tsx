"use client";

import StarRating from "./StarRating";
import { safeUrl } from "../lib/safeUrl";
import type { ReviewItem } from "../lib/reviewTypes";
import { useState } from "react";

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
  // A blocked scheme comes back as "#" — show the initials rather than an <img src="#"> that refetches the page.
  const photo = review.photoUrl ? safeUrl(review.photoUrl) : "#";
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div className={`rounded-xl border p-4 ${isOwn ? "border-accent/40 bg-accent/10" : "border-line bg-fill"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {photo !== "#" && !photoFailed ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
              {/* User avatar host is arbitrary → plain <img>; next/image throws on un-allow-listed hosts. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-bold text-ink-2">
              {initials}
            </div>
          )}
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
              className="rounded-lg p-1 text-ink-3 transition hover:text-danger"
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
