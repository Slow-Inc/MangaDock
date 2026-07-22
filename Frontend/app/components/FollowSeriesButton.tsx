"use client";

import { useSeriesFollow } from "../hooks/useSeriesFollow";

type Props = {
  book: { id: string; title: string; thumbnail: string };
  variant?: "icon-rounded" | "icon-square";
};

export default function FollowSeriesButton({ book, variant = "icon-rounded" }: Props) {
  const { following, toggling, toggle } = useSeriesFollow(book);

  const isSquare = variant === "icon-square";
  const base = isSquare
    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition"
    : "flex h-9 w-9 items-center justify-center rounded-full border transition";

  const active = following
    ? "border-indigo-400 bg-indigo-500/20 text-indigo-300"
    : isSquare
      ? "border-white/25 text-white/80 hover:border-white/50"
      : "border-white/40 text-white hover:border-white";

  return (
    <button
      title={following ? "กำลังติดตามอยู่ — คลิกเพื่อเลิกติดตาม" : "ติดตาม series นี้"}
      onClick={toggle}
      disabled={toggling}
      className={`${base} ${active} disabled:opacity-50`}
    >
      {following ? (
        // Bell filled (following)
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ) : (
        // Bell outline (not following)
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
