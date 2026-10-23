"use client";

import { useEffect, useState, useCallback, useRef, useId } from "react";
import { ROLE } from "../../../lib/types/user";
import Image from "next/image";
import { useParams } from "next/navigation";
import PostCard from "../../../components/PostCard";
import { PostSkeleton } from "../../../components/ForumSkeleton";
import { listPosts, createPost } from "../../../lib/communityApi";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import PostImageUploader from "../../../components/PostImageUploader";
import { useLocalLenis } from "../../../hooks/useLocalLenis";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useModalDialog } from "../../../hooks/useDialogFocus";
import type { ForumPost, ForumCategory } from "../../../lib/types";
import { availableCategories, isRestrictedCategory } from "../../../lib/forumCategories";
import { FORUM_LIMITS, clipToLimit } from "../../../lib/forumLimits";
import LimitCounter from "../../../components/ui/LimitCounter";
import { cacheOrFetch, TTL } from "../../../lib/apiCache";
import { proxyImageUrl } from "../../../lib/imgUrl";
import { PRIMARY_FILL } from "../../../components/ui/Button";
import { usePageTitle } from "../../../hooks/pageTitle";
import LoadError from "../../../components/ui/LoadError";

/** Minimal shape read from the manga-detail endpoint (title + first cover). */
type MangaMeta = { title?: string; covers?: { url: string; localUrl?: string }[] };

export default function MangaCommunityPage() {
  const { mangaId } = useParams<{ mangaId: string }>();
  const { user, userRole, showLoginPrompt } = useAuth();
  const { showToast } = useToast();
  const postTitleLimitId = useId();
  const postContentLimitId = useId();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sort, setSort] = useState<"new" | "hot">("hot");
  const [viewMode, setViewMode] = useState<'card' | 'compact'>('card');
  const isMobile = useIsMobile();
  const [mangaTitle, setMangaTitle] = useState<string | null>(null);
  usePageTitle(mangaTitle ? `${mangaTitle} · คอมมูนิตี้` : null);
  const [mangaCover, setMangaCover] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" as ForumCategory });
  const [postImages, setPostImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const modalScrollRef = useRef<HTMLDivElement>(null);
  useLocalLenis(modalScrollRef, "vertical", showCreateModal);
  const closeCreate = useCallback(() => {
    setShowCreateModal(false);
    setPostImages([]);
    setNewPost({ title: "", content: "", category: "general" as ForumCategory });
  }, []);
  const createDialogRef = useRef<HTMLDivElement>(null);
  useModalDialog(createDialogRef, closeCreate, showCreateModal);

  const fetchMangaMeta = useCallback(async () => {
    try {
      const book = await cacheOrFetch<MangaMeta | null>(
        `manga:${mangaId}:detail`,
        async () => {
          const res = await fetch(`/api/proxy/books/manga/${mangaId}`);
          // thrown, not cached: a cached miss left the header (and new posts' manga fields) empty for 30 min (#983)
          if (!res.ok) throw new Error(`manga detail ${res.status}`);
          return res.json();
        },
        TTL.LONG,
      );
      if (!book) return;
      setMangaTitle((prev) => prev ?? book.title ?? null);
      const cover = book.covers?.[0];
      const coverUrl = cover
        ? (cover.localUrl ? `/api/proxy${cover.localUrl}` : proxyImageUrl(cover.url))
        : null;
      setMangaCover((prev) => prev ?? coverUrl);
    } catch {
      // non-critical, header just stays empty
    }
  }, [mangaId]);

  // Only the latest request writes: switching hot ⇄ new while the other sort is still loading must not let the
  // slower answer replace the chosen list (#999)
  const fetchSeq = useRef(0);
  const fetchPosts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await listPosts({ mangaId, sort });
      if (seq !== fetchSeq.current) return;
      setPosts(res.items);
      const infoPost = res.items.find((p) => p.targetMangaTitle);
      if (infoPost) {
        setMangaTitle((prev) => prev ?? infoPost.targetMangaTitle);
        setMangaCover((prev) => prev ?? infoPost.targetMangaCover);
      } else {
        fetchMangaMeta();
      }
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      console.error(err);
      setPosts([]);
      setLoadFailed(true); // not "no posts in this community" (#913)
      fetchMangaMeta(); // the title comes from the posts when they load; fetch it on its own so the header is not a skeleton
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [mangaId, sort, fetchMangaMeta]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (isMobile) setViewMode('compact');
  }, [isMobile]);

  // The picker offers only what this role may post in (as on /community); a category that became unavailable
  // falls back to 'general' — the backend refuses an announcement from a non-admin (#988)
  useEffect(() => {
    if (isRestrictedCategory(newPost.category) && !availableCategories(userRole).includes(newPost.category)) {
      setNewPost((prev) => ({ ...prev, category: "general" }));
    }
  }, [userRole, newPost.category]);

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim() || submitting) return;

    const postData = { ...newPost };
    const images = [...postImages];
    const tempId = `temp-${Date.now()}`;
    const targetMangaTitle = mangaTitle ? clipToLimit(mangaTitle, FORUM_LIMITS.title) : null;

    const tempPost: ForumPost = {
      id: tempId,
      title: postData.title,
      content: postData.content,
      category: postData.category,
      targetMangaId: mangaId,
      targetMangaTitle,
      targetMangaCover: mangaCover,
      imageUrls: images,
      authorUid: user?.uid ?? "",
      authorName: user?.displayName ?? null,
      authorPhotoUrl: user?.photoURL ?? null,
      authorRole: user?.role ?? ROLE.USER,
      upvotes: 0,
      downvotes: 0,
      userVote: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPosts((prev) => [tempPost, ...prev]);
    setLoadFailed(false); // the new post is the list now — do not keep it behind the load error
    setShowCreateModal(false);
    setNewPost({ title: "", content: "", category: "general" });
    setPostImages([]);
    setSubmitting(true);

    try {
      const realPost = await createPost({
        ...postData,
        targetMangaId: mangaId,
        targetMangaTitle: targetMangaTitle ?? undefined,
        targetMangaCover: mangaCover ?? undefined,
        imageUrls: images,
      });
      setPosts((prev) => prev.map((p) => (p.id === tempId ? realPost : p)));
    } catch {
      showToast({ type: "error", message: "โพสต์ไม่สำเร็จ ลองใหม่อีกครั้ง", duration: 3500 }); // the modal reopens with the text, now with a reason (#987)
      setPosts((prev) => prev.filter((p) => p.id !== tempId));
      setNewPost(postData);
      setPostImages(images);
      setShowCreateModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* ── Subreddit-style header ── */}
      <div className="relative mb-8 rounded-2xl overflow-hidden">
        {/* Banner */}
        <div className="h-32 sm:h-40 relative bg-fill overflow-hidden">
          {mangaCover && (
            <Image
              src={mangaCover}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-15"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
        </div>

        {/* Info row */}
        <div className="relative px-5 pb-5 -mt-10 flex items-end gap-4">
          {/* Cover thumbnail */}
          <div className="relative w-16 h-24 sm:w-20 sm:h-28 shrink-0 rounded-xl overflow-hidden border-2 border-surface shadow-2xl bg-fill">
            {mangaCover ? (
              <Image src={mangaCover} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.582.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            {mangaTitle ? (
              <h1 className="text-xl sm:text-2xl font-black text-ink truncate">
                {mangaTitle}
              </h1>
            ) : (
              <div className="h-7 w-48 bg-fill rounded-lg animate-pulse mb-1" />
            )}
            <p className="text-ink-3 text-xs font-semibold mt-1">
              {loading ? "..." : loadFailed ? "" : `${posts.length} โพสต์`}
            </p>
          </div>

          <button
            onClick={() =>
              user ? setShowCreateModal(true) : showLoginPrompt()
            }
            className={`hidden sm:block shrink-0 px-5 py-2.5 rounded-xl ${PRIMARY_FILL} font-black text-xs smooth-hover active:scale-95`}
          >
            + โพสต์
          </button>
        </div>
      </div>

      {/* ── Sort ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center bg-fill rounded-lg p-1 border border-line smooth-hover">
          <button
            onClick={() => setSort("hot")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === "hot" ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            Hot
          </button>
          <button
            onClick={() => setSort("new")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === "new" ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            New
          </button>
        </div>
      </div>

      {/* ── Posts ── */}
      <div className="space-y-4">
        {loading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : loadFailed ? (
          <LoadError what="โพสต์" area="community" onRetry={fetchPosts} />
        ) : posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} viewMode={viewMode} />)
        ) : (
          <div className="bg-surface border border-dashed border-line rounded-2xl py-20 text-center">
            <p className="text-ink-3 font-medium">ยังไม่มีโพสต์ในชุมชนนี้</p>
            <p className="text-ink-3 text-sm mt-1">เป็นคนแรกที่เริ่มการสนทนา!</p>
          </div>
        )}
      </div>

      {/* ── Create Post Modal ── */}
      {showCreateModal && (
        <div ref={createDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="สร้างโพสต์"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/80 outline-none">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <header className="p-6 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-ink">สร้างโพสต์</h2>
                {mangaTitle && (
                  <p className="text-xs text-accent/80 font-semibold mt-0.5">ใน {mangaTitle}</p>
                )}
              </div>
              <button
                onClick={closeCreate}
                aria-label="ปิด"
                className="text-ink-2 hover:text-ink"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </header>

            <div ref={modalScrollRef} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase mb-2">หมวดหมู่</label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories(userRole).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setNewPost({ ...newPost, category: cat })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border smooth-hover ${
                        newPost.category === cat
                          ? "bg-ink border-ink text-bg"
                          : "bg-fill text-ink-3 border-line hover:border-ink-3"
                      }`}
                    >
                      {cat === "general" ? "ทั่วไป" : cat === "announcement" ? "ประกาศ" : cat === "spoiler" ? "สปอยล์" : "อัปเดตมังงะ"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase mb-2">หัวข้อ</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  maxLength={FORUM_LIMITS.title}
                  aria-describedby={postTitleLimitId}
                  placeholder="เขียนหัวข้อโพสต์ที่นี่..."
                  className="w-full bg-fill border border-line rounded-xl px-4 py-3 text-ink focus:border-accent transition-all"
                />
                <LimitCounter id={postTitleLimitId} value={newPost.title} max={FORUM_LIMITS.title} />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase mb-2">เนื้อหา</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  maxLength={FORUM_LIMITS.content}
                  aria-describedby={postContentLimitId}
                  placeholder="รายละเอียดสิ่งที่คุณต้องการจะพูดคุย..."
                  rows={5}
                  className="w-full bg-fill border border-line rounded-xl px-4 py-3 text-ink focus:border-accent transition-all resize-none"
                />
                <LimitCounter id={postContentLimitId} value={newPost.content} max={FORUM_LIMITS.content} />
              </div>

              <PostImageUploader images={postImages} onChange={setPostImages} />
            </div>

            <footer className="p-6 bg-fill border-t border-line flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setPostImages([]); }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-ink-2 hover:bg-fill transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreatePost}
                disabled={!newPost.title.trim() || !newPost.content.trim() || submitting}
                className={`px-8 py-2.5 rounded-xl ${PRIMARY_FILL} font-black text-sm disabled:opacity-50 transition-all`}
              >
                {submitting ? "กำลังโพสต์..." : "โพสต์เลย"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* FAB — Mobile Create Post */}
      <button
        onClick={() => user ? setShowCreateModal(true) : showLoginPrompt()}
        className={`fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full ${PRIMARY_FILL} flex items-center justify-center sm:hidden active:scale-95 transition-transform`}
        aria-label="สร้างโพสต์"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
