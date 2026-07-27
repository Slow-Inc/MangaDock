"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import StarRating from "./StarRating";
import ReviewCard from "./ReviewCard";
import type { ReviewItem, ReviewSummary } from "../lib/reviewTypes";

type Props = { mangaId: string; mangaTitle: string };

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

const BASE = (id: string) => `/api/proxy/reviews/${encodeURIComponent(id)}`;

export default function ReviewSection({ mangaId, mangaTitle }: Props) {
  const { user, showLoginPrompt } = useContext(AuthContext);

  const [summary, setSummary] = useState<ReviewSummary>({ averageRating: 0, count: 0 });
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [myReview, setMyReview] = useState<ReviewItem | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchPublic = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const [sumRes, listRes] = await Promise.all([
        fetch(`${BASE(mangaId)}/summary`),
        fetch(BASE(mangaId)),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (listRes.ok) setReviews(await listRes.json());
    } finally {
      setLoadingReviews(false);
    }
  }, [mangaId]);

  const fetchMyReview = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${BASE(mangaId)}/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setMyReview(data);
      if (data) {
        setRating(data.rating);
        setBody(data.body ?? "");
      }
    }
  }, [mangaId]);

  useEffect(() => {
    fetchPublic();
  }, [fetchPublic]);

  useEffect(() => {
    if (user) fetchMyReview();
    else setMyReview(null);
  }, [user, fetchMyReview]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { showLoginPrompt(); return; }
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(BASE(mangaId), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mangaTitle, rating, body: body.trim() }),
      });
      if (res.ok) {
        setShowForm(false);
        await Promise.all([fetchPublic(), fetchMyReview()]);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(BASE(mangaId), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMyReview(null);
      setRating(0);
      setBody("");
      await fetchPublic();
    }
  }

  const others = reviews.filter((r) => !myReview || r.id !== myReview.id);

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white/90">รีวิวจากผู้อ่าน</h3>
        <div className="flex items-center gap-2">
          {summary.count > 0 && (
            <span className="text-sm text-white/50">
              {summary.averageRating.toFixed(1)} / 5 · {summary.count} รีวิว
            </span>
          )}
          {user && !myReview && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white/90"
            >
              เขียนรีวิว
            </button>
          )}
          {user && myReview && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400 transition hover:bg-indigo-500/20"
            >
              แก้ไขรีวิว
            </button>
          )}
        </div>
      </div>

      {/* Write / Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4"
        >
          <p className="mb-3 text-sm font-medium text-white/80">
            {myReview ? "แก้ไขรีวิวของคุณ" : "เขียนรีวิว"}
          </p>
          <div className="mb-3 flex items-center gap-2">
            <StarRating value={rating} onChange={setRating} size="lg" />
            {rating > 0 && (
              <span className="text-sm text-white/50">{rating} / 5</span>
            )}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="แสดงความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
            rows={3}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none transition focus:border-indigo-500/50 focus:bg-white/8"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                if (myReview) { setRating(myReview.rating); setBody(myReview.body ?? ""); }
                else { setRating(0); setBody(""); }
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-white/40 transition hover:text-white/70"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition enabled:hover:bg-indigo-500 disabled:opacity-40"
            >
              {submitting ? "กำลังบันทึก..." : myReview ? "อัปเดต" : "ส่งรีวิว"}
            </button>
          </div>
        </form>
      )}

      {/* Own review preview */}
      {myReview && !showForm && (
        <div className="mb-4">
          <ReviewCard review={myReview} isOwn onDelete={handleDelete} />
        </div>
      )}

      {/* Other reviews */}
      {loadingReviews ? (
        <div className="py-6 text-center text-sm text-white/30">กำลังโหลด...</div>
      ) : others.length === 0 && !myReview ? (
        <div className="py-6 text-center text-sm text-white/30">ยังไม่มีรีวิว เป็นคนแรกที่รีวิว!</div>
      ) : (
        <div className="flex flex-col gap-3">
          {others.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}

      {!user && (
        <button
          onClick={showLoginPrompt}
          className="mt-4 w-full rounded-xl border border-white/8 py-3 text-sm text-white/40 transition hover:border-white/15 hover:text-white/60"
        >
          เข้าสู่ระบบเพื่อเขียนรีวิว
        </button>
      )}
    </section>
  );
}
