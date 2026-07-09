"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import PostCard from "../../../components/PostCard";
import { PostSkeleton } from "../../../components/ForumSkeleton";
import { listPosts, createPost } from "../../../lib/communityApi";
import { useAuth } from "../../../contexts/AuthContext";
import PostImageUploader from "../../../components/PostImageUploader";
import { useLocalLenis } from "../../../hooks/useLocalLenis";
import { useIsMobile } from "../../../hooks/useIsMobile";
import type { ForumPost, ForumCategory } from "../../../lib/types";
import { CATEGORY_LIST } from "../../../lib/forumCategories";
import { cacheOrFetch, TTL } from "../../../lib/apiCache";
import { proxyImageUrl } from "../../../lib/imgUrl";

/** Minimal shape read from the manga-detail endpoint (title + first cover). */
type MangaMeta = { title?: string; covers?: { url: string; localUrl?: string }[] };

export default function MangaCommunityPage() {
  const { mangaId } = useParams<{ mangaId: string }>();
  const { user, showLoginPrompt } = useAuth();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"new" | "hot">("hot");
  const [viewMode, setViewMode] = useState<'card' | 'compact'>('card');
  const isMobile = useIsMobile();
  const [mangaTitle, setMangaTitle] = useState<string | null>(null);
  const [mangaCover, setMangaCover] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" as ForumCategory });
  const [postImages, setPostImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const modalScrollRef = useRef<HTMLDivElement>(null);
  useLocalLenis(modalScrollRef, "vertical", showCreateModal);

  const fetchMangaMeta = useCallback(async () => {
    try {
      const book = await cacheOrFetch<MangaMeta | null>(
        `manga:${mangaId}:detail`,
        async () => {
          const res = await fetch(`/api/proxy/books/manga/${mangaId}`);
          if (!res.ok) return null;
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

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPosts({ mangaId, sort });
      setPosts(res.items);
      const infoPost = res.items.find((p) => p.targetMangaTitle);
      if (infoPost) {
        setMangaTitle((prev) => prev ?? infoPost.targetMangaTitle);
        setMangaCover((prev) => prev ?? infoPost.targetMangaCover);
      } else {
        fetchMangaMeta();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mangaId, sort, fetchMangaMeta]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (isMobile) setViewMode('compact');
  }, [isMobile]);

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim() || submitting) return;

    const postData = { ...newPost };
    const images = [...postImages];
    const tempId = `temp-${Date.now()}`;

    const tempPost: ForumPost = {
      id: tempId,
      title: postData.title,
      content: postData.content,
      category: postData.category,
      targetMangaId: mangaId,
      targetMangaTitle: mangaTitle,
      targetMangaCover: mangaCover,
      imageUrls: images,
      authorUid: user?.uid ?? "",
      authorName: user?.displayName ?? null,
      authorPhotoUrl: user?.photoURL ?? null,
      authorRole: user?.role ?? "user",
      upvotes: 0,
      downvotes: 0,
      userVote: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPosts((prev) => [tempPost, ...prev]);
    setShowCreateModal(false);
    setNewPost({ title: "", content: "", category: "general" });
    setPostImages([]);
    setSubmitting(true);

    try {
      const realPost = await createPost({
        ...postData,
        targetMangaId: mangaId,
        targetMangaTitle: mangaTitle ?? undefined,
        targetMangaCover: mangaCover ?? undefined,
        imageUrls: images,
      });
      setPosts((prev) => prev.map((p) => (p.id === tempId ? realPost : p)));
    } catch (err) {
      console.error(err);
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
        <div className="h-32 sm:h-40 relative bg-gradient-to-br from-indigo-900/40 via-purple-900/30 to-[#1a1a2e] overflow-hidden">
          {mangaCover && (
            <Image
              src={mangaCover}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-20 blur-xl scale-110"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent" />
        </div>

        {/* Info row */}
        <div className="relative px-5 pb-5 -mt-10 flex items-end gap-4">
          {/* Cover thumbnail */}
          <div className="relative w-16 h-24 sm:w-20 sm:h-28 shrink-0 rounded-xl overflow-hidden border-2 border-[#141414] shadow-2xl bg-white/5">
            {mangaCover ? (
              <Image src={mangaCover} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/10">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.582.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            {mangaTitle ? (
              <h1 className="text-xl sm:text-2xl font-black text-white truncate tracking-tight">
                {mangaTitle}
              </h1>
            ) : (
              <div className="h-7 w-48 bg-white/5 rounded-lg animate-pulse mb-1" />
            )}
            <p className="text-white/40 text-xs font-semibold mt-1">
              {loading ? "..." : `${posts.length} โพสต์`}
            </p>
          </div>

          <button
            onClick={() =>
              user ? setShowCreateModal(true) : showLoginPrompt()
            }
            className="hidden sm:block shrink-0 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 smooth-hover active:scale-95"
          >
            + โพสต์
          </button>
        </div>
      </div>

      {/* ── Sort ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10 smooth-hover">
          <button
            onClick={() => setSort("hot")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === "hot" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
          >
            Hot
          </button>
          <button
            onClick={() => setSort("new")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === "new" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
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
        ) : posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} viewMode={viewMode} />)
        ) : (
          <div className="bg-[#1a1a1a] border border-dashed border-white/10 rounded-2xl py-20 text-center">
            <p className="text-white/40 font-medium">ยังไม่มีโพสต์ในชุมชนนี้</p>
            <p className="text-white/20 text-sm mt-1">เป็นคนแรกที่เริ่มการสนทนา!</p>
          </div>
        )}
      </div>

      {/* ── Create Post Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <header className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">สร้างโพสต์</h2>
                {mangaTitle && (
                  <p className="text-xs text-amber-500/80 font-semibold mt-0.5">ใน {mangaTitle}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setPostImages([]);
                  setNewPost({ title: "", content: "", category: "general" as ForumCategory });
                }}
                className="text-white/40 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </header>

            <div ref={modalScrollRef} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase mb-2">หมวดหมู่</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_LIST.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setNewPost({ ...newPost, category: cat })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border smooth-hover ${
                        newPost.category === cat
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
                      }`}
                    >
                      {cat === "general" ? "ทั่วไป" : cat === "announcement" ? "ประกาศ" : cat === "spoiler" ? "สปอยล์" : "อัปเดตมังงะ"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/40 uppercase mb-2">หัวข้อ</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="เขียนหัวข้อโพสต์ที่นี่..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/40 uppercase mb-2">เนื้อหา</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="รายละเอียดสิ่งที่คุณต้องการจะพูดคุย..."
                  rows={5}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <PostImageUploader images={postImages} onChange={setPostImages} />
            </div>

            <footer className="p-6 bg-white/2 border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setPostImages([]); }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/50 hover:bg-white/5 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreatePost}
                disabled={!newPost.title.trim() || !newPost.content.trim() || submitting}
                className="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
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
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/40 sm:hidden active:scale-95 transition-transform"
        aria-label="สร้างโพสต์"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
