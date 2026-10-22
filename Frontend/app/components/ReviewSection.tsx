"use client";

import { PRIMARY_FILL } from "./ui/Button";
import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { parseJsonOrNull } from "../lib/safeJson";
import StarRating from "./StarRating";
import ReviewCard from "./ReviewCard";
import Loader from "./ui/Loader";
import StatusMessage from "./ui/StatusMessage";
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
  const [submitError, setSubmitError] = useState("");
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
      const data = await parseJsonOrNull<ReviewItem>(res);
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
    setSubmitError("");
    try {
      const token = await getToken();
      if (!token) { showLoginPrompt(); return; }
      const res = await fetch(BASE(mangaId), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mangaTitle, rating, body: body.trim() }),
      });
      if (res.ok) {
        setShowForm(false);
        await Promise.all([fetchPublic(), fetchMyReview()]);
      } else {
        setSubmitError("บันทึกรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    } catch {
      setSubmitError("บันทึกรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง");
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
    <section className="mt-8 px-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">รีวิวจากผู้อ่าน</h3>
        <div className="flex items-center gap-2">
          {summary.count > 0 && (
            <span className="text-sm text-ink-2">
              {summary.averageRating.toFixed(1)} / 5 · {summary.count} รีวิว
            </span>
          )}
          {user && !myReview && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-line bg-fill px-3 py-1 text-xs font-medium text-ink-2 transition hover:border-ink-3 hover:text-ink"
            >
              เขียนรีวิว
            </button>
          )}
          {user && myReview && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/20"
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
          className="mb-5 rounded-xl border border-accent/40 bg-accent/10 p-4"
        >
          <p className="mb-3 text-sm font-medium text-ink">
            {myReview ? "แก้ไขรีวิวของคุณ" : "เขียนรีวิว"}
          </p>
          <div className="mb-3 flex items-center gap-2">
            <StarRating value={rating} onChange={setRating} size="lg" />
            {rating > 0 && (
              <span className="text-sm text-ink-2">{rating} / 5</span>
            )}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="แสดงความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
            rows={3}
            className="w-full resize-none rounded-lg border border-line bg-fill px-3 py-2 text-sm text-ink placeholder-ink-3 outline-none transition focus:border-ink-3 focus:bg-raised"
          />
          <StatusMessage
            kind="alert"
            message={submitError}
            className="mt-2 text-xs text-danger"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSubmitError("");
                if (myReview) { setRating(myReview.rating); setBody(myReview.body ?? ""); }
                else { setRating(0); setBody(""); }
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-2 transition hover:text-ink"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className={`${PRIMARY_FILL} rounded-lg px-4 py-1.5 text-sm font-semibold transition disabled:opacity-40`}
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
        <div className="flex justify-center py-6 text-ink-3">
          <Loader context="section" label="กำลังโหลดรีวิว" />
        </div>
      ) : others.length === 0 && !myReview ? (
        <div className="py-6 text-center text-sm text-ink-3">ยังไม่มีรีวิว เป็นคนแรกที่รีวิว!</div>
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
          className="mt-4 w-full rounded-xl border border-line py-3 text-sm text-ink-2 transition hover:border-line hover:text-ink"
        >
          เข้าสู่ระบบเพื่อเขียนรีวิว
        </button>
      )}
    </section>
  );
}
