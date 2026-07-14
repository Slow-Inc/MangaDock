"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { PostDetailSkeleton } from "../../../components/ForumSkeleton";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { getPost, listComments, createComment, updatePost, deletePost } from "../../../lib/communityApi";
import VoteButtons from "../../../components/VoteButtons";
import CommentThread from "../../../components/CommentThread";
import { useAuth } from "../../../contexts/AuthContext";
import { usePostStream } from "../../../hooks/useForumStream";

const ROLE_LABEL: Record<number, string> = { 1: 'นักแปล', 2: 'นักเขียน', 8: 'ผู้ดูแล', 9: 'ผู้พัฒนา' };
import type { ForumPost, ForumComment } from "../../../lib/types";
import { isDisplayedVoteEvent } from "../../../lib/voteEvents";

function MarqueeText({ text, textClassName, active }: { text: string; textClassName?: string; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const txt = textRef.current;
    if (!container || !txt) return;
    const measure = () => setOverflow(Math.max(0, txt.scrollWidth - container.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [text]);

  const shouldScroll = active && overflow > 0;
  const duration = Math.max(5, overflow / 25);

  return (
    <div ref={containerRef} className="overflow-hidden">
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap ${textClassName ?? ""}`}
        style={shouldScroll ? ({
          "--marquee-overflow": `${overflow}px`,
          animation: `marquee-title ${duration}s linear 1s infinite`,
        } as React.CSSProperties) : undefined}
      >
        {text}
      </span>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, showLoginPrompt } = useAuth();
  
  const [post, setPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostContent, setEditPostContent] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [voteCounts, setVoteCounts] = useState<Map<string, { upvotes: number; downvotes: number }>>(new Map());
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  usePostStream({
    postId: id ?? "",
    enabled: !!id,
    onEvent: useCallback((event) => {
      switch (event.type) {
        case "vote":
          if (!isDisplayedVoteEvent(event.targetType)) break;
          setVoteCounts(prev => new Map(prev).set(
            `${event.targetType}:${event.targetId}`,
            { upvotes: event.upvotes, downvotes: event.downvotes },
          ));
          break;
        case "comment":
          setComments(prev => {
            if (prev.some(c => c.id === event.comment.id)) return prev;
            return [...prev, event.comment];
          });
          setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
          break;
        case "post_edited":
          setPost(prev => prev ? { ...prev, title: event.title, content: event.content, updatedAt: event.updatedAt } : prev);
          break;
        case "post_deleted":
          router.push("/community");
          break;
        case "comment_deleted":
          setComments(prev => prev.filter(c => c.id !== event.commentId));
          break;
      }
    }, [router]),
  });

  const openMenu = () => {
    setConfirmDeletePost(false);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    flushSync(() => setMenuVisible(false));
    setTimeout(() => setMenuOpen(false), 150);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const t = setTimeout(() => setMenuVisible(true), 10);
    return () => clearTimeout(t);
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 44);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const fetchData = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        getPost(id),
        listComments(id)
      ]);
      setPost(postRes);
      setComments(commentsRes);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stable identity so the React.memo'd CommentThread items are not invalidated
  // on every post re-render (plan 2026-07-11 Perf 3).
  const handleCommentAdded = useCallback(() => fetchData(true), [fetchData]);

  const handleDeletePost = async () => {
    if (!post || deletingPost) return;
    setDeletingPost(true);
    try {
      await deletePost(post.id);
      router.push('/community');
    } catch (err) {
      console.error(err);
      setDeletingPost(false);
      setConfirmDeletePost(false);
    }
  };

  const handleEditPostStart = () => {
    if (!post) return;
    setEditPostTitle(post.title);
    setEditPostContent(post.content);
    setIsEditingPost(true);
  };

  const handleSavePost = async () => {
    if (!post || savingPost) return;
    if (!editPostTitle.trim() || !editPostContent.trim()) return;
    setSavingPost(true);
    try {
      const updated = await updatePost(post.id, { title: editPostTitle, content: editPostContent });
      setPost(updated);
      setIsEditingPost(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPost(false);
    }
  };

  const handlePostComment = async () => {
    if (!user) {
      showLoginPrompt();
      return;
    }
    const content = newComment.trim();
    if (!content || submitting || !post) return;
    setSubmitting(true);
    setNewComment("");
    try {
      const created = await createComment({ postId: post.id, content });
      if (!mountedRef.current) return;
      setComments(prev => [...prev, created]);
      setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setNewComment(content);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  if (loading) {
    return <PostDetailSkeleton />;
  }

  if (!post) return (
    <div className="py-20 text-center text-white/40">ไม่พบข้อมูลกระทู้</div>
  );

  return (
    <div className="relative [overflow-x:clip]">
      {/* 
        Sticky Secondary Header (Bar) 
        - Always present back button
        - Dynamic background and title on scroll
      */}
      <div
        className={`sticky top-16 z-50 flex h-14 items-center gap-3 border-b transition-all duration-300 ${
          headerScrolled
            ? "bg-[#141414]/80 backdrop-blur-md border-white/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
            : "bg-transparent border-transparent"
        }`}
      >
        <button
          onClick={() => router.back()}
          className="group relative flex items-center gap-2 h-9 px-3 sm:px-5 rounded-full overflow-hidden shrink-0
            bg-white/[0.07] hover:bg-white/[0.13]
            border border-white/[0.13] hover:border-white/25
            backdrop-blur-xl
            shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.10)]
            hover:shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.18)]
            text-white/70 hover:text-white
            transition-all duration-200"
          aria-label="ย้อนกลับ"
        >
          {/* Liquid Glass top shimmer */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <svg
            className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          <span className="hidden sm:block text-xs font-bold tracking-wide">ย้อนกลับ</span>
        </button>

        <div className={`min-w-0 flex-1 transition-opacity duration-300 ${headerScrolled ? "opacity-100" : "opacity-0"}`}>
          <MarqueeText
            text={post.title}
            textClassName="text-sm font-semibold text-white"
            active={headerScrolled}
          />
        </div>
      </div>

      <article className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden mb-8 shadow-xl">
        <div className="flex">
          <div className="hidden sm:flex flex-col items-center p-4 bg-white/2 border-r border-white/5">
             <VoteButtons
                targetType="post"
                targetId={post.id}
                initialUpvotes={post.upvotes}
                initialDownvotes={post.downvotes}
                initialUserVote={post.userVote}
                externalCounts={voteCounts.get(`post:${post.id}`)}
              />
          </div>

          <div className="flex-1 p-4 sm:p-8">
            <header className="flex items-center flex-wrap gap-3 mb-3 sm:mb-4 text-xs text-white/40 relative">
              <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
                {post.authorPhotoUrl && (
                  <Image 
                    src={post.authorPhotoUrl} 
                    alt={post.authorName || 'user'} 
                    width={24} 
                    height={24}
                    className="object-cover"
                  />
                )}
              </div>
              <Link
                href={`/community/profile/${post.authorUid}`}
                className={`font-bold text-sm hover:underline underline-offset-2 transition-opacity hover:opacity-80 ${
                  post.authorRole === 1 ? "text-indigo-400" :
                  post.authorRole === 2 ? "text-orange-400" : "text-white/80"
                }`}
              >
                {post.authorName || 'Unknown User'}
                {post.authorRole > 0 && (
                  <span className="ml-1.5 px-1 bg-white/10 rounded text-[9px] uppercase tracking-tighter text-white/70">
                    {ROLE_LABEL[post.authorRole] ?? String(post.authorRole)}
                  </span>
                )}
              </Link>
              <span>•</span>
              <span>
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: th })}
              </span>
              {post.category !== 'general' && (
                <>
                  <span>•</span>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-wider text-[10px] border border-indigo-500/20">
                    {post.category}
                  </span>
                </>
              )}
              {post.targetMangaTitle && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">
                    {post.targetMangaCover && (
                      <div className="w-3.5 h-3.5 rounded-sm overflow-hidden relative border border-amber-500/20 shrink-0">
                        <Image src={post.targetMangaCover} alt="manga" fill sizes="14px" className="object-cover" />
                      </div>
                    )}
                    <span className="max-w-[140px] truncate">{post.targetMangaTitle}</span>
                  </div>
                </>
              )}
              {user?.uid === post.authorUid && !isEditingPost && (
                <div ref={menuRef} className="ml-auto relative shrink-0">
                  <button
                    onClick={() => menuOpen ? closeMenu() : openMenu()}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/8 active:bg-white/12 transition-colors"
                    aria-label="ตัวเลือกโพสต์"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div
                      className={`absolute right-0 top-full mt-1 z-30 w-44 bg-[#202020] border border-white/10 rounded-2xl shadow-2xl overflow-hidden origin-top-right transition-[opacity,transform] duration-150 ease-out ${
                        menuVisible
                          ? "opacity-100 scale-100 translate-y-0"
                          : "opacity-0 scale-95 -translate-y-1"
                      }`}
                    >
                      {confirmDeletePost ? (
                        <div key="confirm" className="p-3 space-y-2.5 animate-in fade-in slide-in-from-right-2 duration-150">
                          <p className="text-xs text-white/40 text-center font-medium">ลบโพสต์นี้ใช่ไหม?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDeletePost(false)}
                              className="flex-1 py-2 rounded-xl text-xs font-bold text-white/50 hover:bg-white/8 active:bg-white/12 transition-colors"
                            >
                              ยกเลิก
                            </button>
                            <button
                              onClick={handleDeletePost}
                              disabled={deletingPost}
                              className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 active:bg-red-500/35 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                              {deletingPost && <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />}
                              {deletingPost ? "กำลังลบ..." : "ลบ"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key="menu" className="animate-in fade-in slide-in-from-left-2 duration-150">
                          <button
                            onClick={() => { handleEditPostStart(); closeMenu(); }}
                            className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-semibold text-white/70 hover:bg-white/5 active:bg-white/8 transition-colors"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="sm:hidden">แก้ไข</span>
                            <span className="hidden sm:inline">แก้ไขโพสต์</span>
                          </button>
                          <div className="h-px bg-white/5 mx-3" />
                          <button
                            onClick={() => setConfirmDeletePost(true)}
                            className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-semibold text-red-400/70 hover:bg-red-500/8 active:bg-red-500/12 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="sm:hidden">ลบ</span>
                            <span className="hidden sm:inline">ลบโพสต์</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </header>

            {isEditingPost ? (
              <div className="mb-4 sm:mb-6 animate-in fade-in duration-200">
                <input
                  value={editPostTitle}
                  onChange={(e) => setEditPostTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl sm:text-2xl font-black text-white focus:outline-none focus:border-indigo-500 transition-colors mb-3"
                  placeholder="หัวข้อกระทู้"
                />
                <textarea
                  value={editPostContent}
                  onChange={(e) => setEditPostContent(e.target.value)}
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm sm:text-base text-white/90 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                  placeholder="เนื้อหากระทู้"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setIsEditingPost(false)}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white/50 hover:bg-white/5 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSavePost}
                    disabled={savingPost || !editPostTitle.trim() || !editPostContent.trim()}
                    className="px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingPost ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl sm:text-3xl font-black text-white mb-3 sm:mb-6 leading-tight tracking-tight">
                  {post.title}
                </h1>

                {/* Spoiler gate for post detail */}
                {post.category === 'spoiler' ? (
                  <div className="relative mb-4 sm:mb-6">
                    <div
                      className={`text-white/90 text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${spoilerRevealed ? '' : 'select-none pointer-events-none line-clamp-4'}`}
                      style={{ filter: spoilerRevealed ? 'blur(0px)' : 'blur(4px)', transition: 'filter 0.5s ease' }}
                    >
                      {post.content}
                    </div>
                    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 rounded-xl backdrop-blur-[2px] transition-opacity duration-500 ${
                      spoilerRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}>
                      <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      <p className="text-amber-400 font-bold text-sm">เนื้อหานี้มีสปอยล์</p>
                      <button
                        onClick={() => setSpoilerRevealed(true)}
                        className="px-5 py-2 rounded-full bg-amber-500 text-black font-black text-sm hover:bg-amber-400 active:scale-95 transition-all duration-150"
                      >
                        คลิกเพื่อดูสปอยล์
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-white/90 text-sm sm:text-base leading-relaxed whitespace-pre-wrap mb-4 sm:mb-6">
                    {post.content}
                  </div>
                )}
              </>
            )}

            {post.imageUrls && post.imageUrls.length > 0 && (
              <div
                className={`mb-8 rounded-xl overflow-hidden grid gap-1.5 ${
                  post.imageUrls.length === 1 ? 'grid-cols-1' :
                  post.imageUrls.length === 2 ? 'grid-cols-2' :
                  post.imageUrls.length >= 3 ? 'grid-cols-2' : 'grid-cols-1'
                } ${post.category === 'spoiler' && !spoilerRevealed ? 'pointer-events-none' : ''}`}
                style={{ filter: post.category === 'spoiler' && !spoilerRevealed ? 'blur(4px)' : 'blur(0px)', transition: 'filter 0.5s ease' }}
              >
                {post.imageUrls.map((url, i) => {
                  const trimmed = url.trim();
                  const safeUrl = /^\s*(javascript|data|vbscript|file):/i.test(trimmed) ? '#' : trimmed;
                  return (
                  <a
                    key={i}
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`relative block overflow-hidden bg-white/5 rounded-lg group ${
                      post.imageUrls.length === 1 ? 'aspect-video' : 'aspect-square'
                    } ${post.imageUrls.length === 3 && i === 0 ? 'col-span-2 aspect-video' : ''}`}
                  >
                    <Image
                      src={safeUrl}
                      alt={`รูปที่ ${i + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </a>
                  );
                })}
              </div>
            )}

            <footer className="pt-4 sm:pt-6 border-t border-white/5 flex items-center gap-6">
               <div className="sm:hidden">
                  <VoteButtons
                    targetType="post"
                    targetId={post.id}
                    initialUpvotes={post.upvotes}
                    initialDownvotes={post.downvotes}
                    initialUserVote={post.userVote}
                    externalCounts={voteCounts.get(`post:${post.id}`)}
                  />
               </div>
               <div className="text-sm font-bold text-white/30">
                 {post.commentCount} ความคิดเห็น
               </div>
            </footer>
          </div>
        </div>
      </article>

      {/* Comment Input */}
      <section id="comments" className="mb-10">
        <h2 className="text-xl font-bold text-white mb-6">ความคิดเห็น</h2>
        
        {user ? (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="ร่วมแสดงความคิดเห็นของคุณ..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all resize-none mb-3"
            />
            <div className="flex justify-end">
              <button
                onClick={handlePostComment}
                disabled={!newComment.trim() || submitting}
                className="px-8 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
              >
                {submitting ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl py-8 text-center">
            <p className="text-white/40 text-sm font-medium">กรุณาเข้าสู่ระบบเพื่อร่วมแสดงความคิดเห็น</p>
          </div>
        )}
      </section>

      {/* Comments List */}
      <section className="space-y-6">
        {comments.length > 0 ? (
          comments.map(comment => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onCommentAdded={handleCommentAdded}
            />
          ))
        ) : (
          <div className="py-10 text-center">
            <p className="text-white/20 font-bold">ยังไม่มีใครมาแสดงความเห็นเลย...</p>
          </div>
        )}
      </section>
    </div>
  );
}
