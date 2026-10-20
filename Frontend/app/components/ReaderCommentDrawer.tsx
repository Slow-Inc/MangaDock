"use client";

import { PRIMARY_FILL } from "./ui/Button";
import UserAvatar from "./ui/UserAvatar";
import Loader from "./ui/Loader";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

type Comment = {
  id: string;
  uid: string;
  body: string;
  createdAt: string;
  displayName: string | null;
  photoUrl: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  mangaId: string;
  chapterId: string;
  pageNumber: number;
};

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อกี้";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

export default function ReaderCommentDrawer({ open, onClose, mangaId, chapterId, pageNumber }: Props) {
  const { user, showLoginPrompt } = useContext(AuthContext);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/reader-comments?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}&page=${pageNumber}`,
        { signal },
      );
      const data = res.ok ? await res.json() : null;
      // A newer page's request superseded this one — never let it overwrite.
      if (data && !signal.aborted) setComments(data);
    } catch (err) {
      if (!signal.aborted) throw err;
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [mangaId, chapterId, pageNumber]);

  useEffect(() => {
    if (!open) {
      setComments([]);
      setText("");
      return;
    }
    const controller = new AbortController();
    fetchComments(controller.signal);
    setTimeout(() => textareaRef.current?.focus(), 300);
    return () => controller.abort();
  }, [open, fetchComments]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { showLoginPrompt(); return; }
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/proxy/reader-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mangaId, chapterId, pageNumber, body: text.trim() }),
      });
      if (res.ok) {
        const newComment: Comment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setText("");
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`/api/proxy/reader-comments/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-scrim/40 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 z-50 flex h-full w-80 max-w-full flex-col border-l border-line bg-bg/90 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">ความคิดเห็น</p>
            <p className="text-xs text-ink-3">หน้า {pageNumber}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 transition hover:text-ink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-6 text-ink-3">
              <Loader context="section" label="กำลังโหลดความคิดเห็น" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-ink-3">ยังไม่มีความคิดเห็น</p>
          ) : (
            <div className="flex flex-col gap-4">
              {comments.map((c) => {
                const isOwn = user?.uid === c.uid;
                return (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <UserAvatar uid={c.uid} photoUrl={c.photoUrl} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="text-xs font-semibold text-ink-2">{c.displayName ?? "ผู้ใช้"}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-ink-3">{timeAgo(c.createdAt)}</span>
                          {isOwn && (
                            <button onClick={() => handleDelete(c.id)} className="text-ink-3 transition hover:text-danger">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm leading-snug text-ink-2">{c.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-line p-3">
          {user ? (
            <form onSubmit={handlePost} className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(e); } }}
                placeholder="เขียนความคิดเห็น..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-line bg-fill px-3 py-2 text-sm text-ink placeholder-ink-3 outline-none transition focus:border-ink-3"
              />
              <button
                type="submit"
                disabled={posting || !text.trim()}
                className={`${PRIMARY_FILL} self-end rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-40`}
              >
                ส่ง
              </button>
            </form>
          ) : (
            <button onClick={showLoginPrompt} className="w-full rounded-xl border border-line py-2.5 text-sm text-ink-3 transition hover:text-ink-2">
              เข้าสู่ระบบเพื่อแสดงความคิดเห็น
            </button>
          )}
        </div>
      </div>
    </>
  );
}
