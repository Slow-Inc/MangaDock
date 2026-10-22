"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { ROLE } from "../lib/types/user";
import { useSearchParams, useRouter } from "next/navigation";
import PostCard from "../components/PostCard";
import { PostSkeleton } from "../components/ForumSkeleton";
import { listPosts, createPost } from "../lib/communityApi";
import { useAuth } from "../contexts/AuthContext";
import type { ForumPost, ForumCategory, LandingBook } from "../lib/types";
import MangaSearchSelector from "../components/MangaSearchSelector";
import PostImageUploader from "../components/PostImageUploader";
import { useLocalLenis } from "../hooks/useLocalLenis";
import { useModalTransition } from "../hooks/useModalTransition";
import { useFeedStream } from "../hooks/useForumStream";
import { useIsMobile } from "../hooks/useIsMobile";
import { availableCategories, isRestrictedCategory, CATEGORY_LIST } from "../lib/forumCategories";
import { useToast } from "../contexts/ToastContext";
import { CommunityErrorBoundary } from "./components/CommunityErrorBoundary";
import Loader from "../components/ui/Loader";
import { PRIMARY_FILL } from "../components/ui/Button";
import Mascot from "../components/mascot/Mascot";
import { usePageTitle } from "../hooks/pageTitle";
import LoadError from "../components/ui/LoadError";

function CommunityContent() {
  const { user, userRole, showLoginPrompt } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [category, setCategory] = useState<ForumCategory | undefined>(
    (searchParams.get('category') as ForumCategory) || undefined
  );
  const [mangaId, setMangaId] = useState<string | undefined>(
    searchParams.get('mangaId') || undefined
  );
  const [sort, setSort] = useState<'new' | 'hot'>('new');
  const [viewMode, setViewMode] = useState<'card' | 'compact'>('card');
  const isMobile = useIsMobile();

  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" as ForumCategory });
  const [selectedManga, setSelectedManga] = useState<LandingBook | null>(null);
  const [postImages, setPostImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const {
    mounted: showCreateModal,
    visible: isModalVisible,
  } = useModalTransition(createOpen, {
    duration: 220,
    onClosed: () => {
      setPostImages([]);
      setNewPost({ title: "", content: "", category: "general" as ForumCategory });
      setSelectedManga(null);
    },
  });

  const openModal = useCallback(() => setCreateOpen(true), []);
  const closeModal = useCallback(() => setCreateOpen(false), []);

  // Reset to 'general' when role changes and current category becomes restricted
  useEffect(() => {
    if (isRestrictedCategory(newPost.category) && !availableCategories(userRole).includes(newPost.category)) {
      setNewPost((prev) => ({ ...prev, category: "general" }));
    }
  }, [userRole, newPost.category]);

  // Modal Smooth Scrolling
  const modalScrollRef = useRef<HTMLDivElement>(null);
  useLocalLenis(modalScrollRef, 'vertical', showCreateModal);

  // Sync state when URL params change
  useEffect(() => {
    setMangaId(searchParams.get('mangaId') || undefined);
    setCategory((searchParams.get('category') as ForumCategory) || undefined);
  }, [searchParams]);

  useEffect(() => {
    if (isMobile) setViewMode('compact');
  }, [isMobile]);

  const [newPostCount, setNewPostCount] = useState(0);

  useFeedStream({
    onNewPost: useCallback(() => {
      setNewPostCount(prev => prev + 1);
    }, []),
  });

  const [loadFailed, setLoadFailed] = useState(false);

  // Only the latest request may write: a slow answer for the previous category must not overwrite this one (#911)
  const fetchSeq = useRef(0);
  const fetchPosts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setLoadFailed(false);
    setOffset(0);
    try {
      const res = await listPosts({ category, mangaId, sort, offset: 0, limit: LIMIT });
      if (seq !== fetchSeq.current) return;
      setPosts(res.items);
      setTotal(res.total);
      setOffset(res.items.length);
    } catch {
      if (seq !== fetchSeq.current) return;
      // Shown inline with a retry (#911), not as "no posts" — and the previous category's posts (and their
      // total, which drives "load more") must not linger
      setPosts([]);
      setTotal(0);
      setLoadFailed(true);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [category, mangaId, sort]);

  const loadMore = async () => {
    if (loadingMore) return;
    const seq = fetchSeq.current; // a feed reload (another category, sort or manga) since then makes this answer stale
    setLoadingMore(true);
    try {
      const res = await listPosts({ category, mangaId, sort, offset, limit: LIMIT });
      if (seq !== fetchSeq.current) return;
      // Offset paging shifts when posts arrive meanwhile: the next page can repeat the last one — keep each post once
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...res.items.filter(p => !seen.has(p.id))];
      });
      setOffset(prev => prev + res.items.length);
      setTotal(res.total);
    } catch {
      if (seq !== fetchSeq.current) return;
      showToast({ type: "error", message: "โหลดโพสต์เพิ่มไม่สำเร็จ กรุณาลองใหม่", duration: 4000 });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    setNewPostCount(0);
  }, [fetchPosts]);

  const handleMobileCategorySelect = (cat: ForumCategory | undefined) => {
    const params = new URLSearchParams(window.location.search);
    if (cat) params.set('category', cat);
    else params.delete('category');
    router.push(`/community${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleCreatePost = async () => {
    if (!user) { showLoginPrompt(); return; }
    if (!newPost.title.trim() || !newPost.content.trim() || submitting) return;

    // Snapshot form state for potential revert
    const postData = { ...newPost };
    const manga = selectedManga;
    const images = [...postImages];
    const tempId = `temp-${Date.now()}`;

    const tempPost: ForumPost = {
      id: tempId,
      title: postData.title,
      content: postData.content,
      category: postData.category,
      targetMangaId: manga?.id ?? null,
      targetMangaTitle: manga?.title ?? null,
      targetMangaCover: manga?.thumbnail ?? null,
      imageUrls: images,
      authorUid: user?.uid ?? '',
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

    // Optimistic: prepend post + close modal with animation
    setPosts(prev => [tempPost, ...prev]);
    setLoadFailed(false); // the new post is the feed now — do not keep it behind the load error
    setNewPost({ title: "", content: "", category: "general" });
    setSelectedManga(null);
    setPostImages([]);
    setSubmitting(true);
    setCreateOpen(false);

    try {
      const realPost = await createPost({
        ...postData,
        targetMangaId: manga?.id,
        targetMangaTitle: manga?.title,
        targetMangaCover: manga?.thumbnail,
        imageUrls: images,
      });
      // Replace temp with authoritative server post
      setPosts(prev => prev.map(p => p.id === tempId ? realPost : p));
    } catch (err) {
      console.error(err);
      // Revert: remove temp post, restore form
      setPosts(prev => prev.filter(p => p.id !== tempId));
      setNewPost(postData);
      setSelectedManga(manga);
      setPostImages(images);
      setCreateOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="w-full sm:w-auto">
          <h1 className="text-3xl font-extrabold text-ink mb-1">คอมมูนิตี้</h1>
          <p className="text-ink-3 text-sm font-medium">พื้นที่แบ่งปันและพูดคุยเกี่ยวกับมังงะที่คุณรัก</p>
        </div>
        
        <button
          onClick={() => user ? openModal() : showLoginPrompt()}
          className={`hidden sm:block px-8 py-3 rounded-2xl ${PRIMARY_FILL} font-black text-sm smooth-hover shrink-0 active:scale-95`}
        >
          + สร้างโพสต์ใหม่
        </button>
      </header>

      {/* Mobile Filter Strip — sort + category in one scrollable row */}
      <div className="sm:hidden -mx-4 px-4 mb-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex items-center bg-fill rounded-lg p-0.5 border border-line shrink-0">
            <button onClick={() => setSort('hot')} className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === 'hot' ? 'bg-fill text-ink' : 'text-ink-2'}`}>Hot</button>
            <button onClick={() => setSort('new')} className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === 'new' ? 'bg-fill text-ink' : 'text-ink-2'}`}>New</button>
          </div>
          <div className="w-px h-5 bg-fill shrink-0" />
          <button
            onClick={() => handleMobileCategorySelect(undefined)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border smooth-hover-fast ${!category ? 'bg-ink border-ink text-bg' : 'bg-fill border-line text-ink-2'}`}
          >ทั้งหมด</button>
          {availableCategories(userRole).map(cat => (
            <button
              key={cat}
              onClick={() => handleMobileCategorySelect(category === cat ? undefined : cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border smooth-hover-fast ${category === cat ? 'bg-ink border-ink text-bg' : 'bg-fill border-line text-ink-2'}`}
            >
              {cat === 'general' ? 'ทั่วไป' : cat === 'announcement' ? 'ประกาศ' : cat === 'spoiler' ? 'สปอยล์' : 'อัปเดต'}
            </button>
          ))}
        </div>
      </div>

      {/* Sorting & Search Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle - Moved to Left */}
          <div className="flex items-center bg-fill rounded-lg p-1 border border-line smooth-hover hidden sm:flex">
            <button 
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md smooth-hover-fast ${viewMode === 'card' ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"}`}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h16" />
              </svg>
            </button>
            <button 
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded-md smooth-hover-fast ${viewMode === 'compact' ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"}`}
              title="Compact View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {mangaId && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold animate-in fade-in zoom-in-95">
              <span>ชุมชนมังงะ</span>
              <button onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.delete('mangaId');
                router.push(`/community?${params.toString()}`);
              }} type="button" aria-label="ล้างตัวกรองมังงะ" className="hover:text-ink transition-colors">
                <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6L18 18" />
                </svg>
              </button>
            </div>
          )}
          {category && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-fill border border-accent/20 text-accent text-xs font-bold animate-in fade-in zoom-in-95">
              <span>หมวด: {category === 'general' ? 'ทั่วไป' : category === 'announcement' ? 'ประกาศ' : category === 'spoiler' ? 'สปอยล์' : 'อัปเดตมังงะ'}</span>
              <button onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.delete('category');
                router.push(`/community?${params.toString()}`);
              }} type="button" aria-label="ล้างตัวกรองหมวด" className="hover:text-ink transition-colors">
                <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6L18 18" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        <div className="hidden sm:flex items-center bg-fill rounded-lg p-1 border border-line smooth-hover">
          <button
            onClick={() => setSort('hot')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${
              sort === 'hot' ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            Hot
          </button>
          <button
            onClick={() => setSort('new')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${
              sort === 'new' ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            New
          </button>
        </div>
      </div>

      {/* New Posts Banner */}
      {newPostCount > 0 && (
        <div className="sticky top-20 z-30 flex justify-center mb-4 pointer-events-none">
          <button
            onClick={() => { fetchPosts(); setNewPostCount(0); }}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full ${PRIMARY_FILL} text-sm font-bold animate-in slide-in-from-top-2 duration-300 active:scale-95 transition-transform`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            มี {newPostCount} โพสต์ใหม่ — คลิกเพื่อดู
          </button>
        </div>
      )}

      {/* Posts Feed */}
      <div className={`space-y-4 ${viewMode === 'compact' ? 'space-y-2' : ''}`}>
        {loading ? (
          <>
            <PostSkeleton viewMode={viewMode} />
            <PostSkeleton viewMode={viewMode} />
            <PostSkeleton viewMode={viewMode} />
          </>
        ) : loadFailed ? (
          <LoadError what="โพสต์" area="community" onRetry={fetchPosts} />
        ) : posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} viewMode={viewMode} />)
        ) : (
          <div className="bg-surface border border-dashed border-line rounded-2xl py-16 text-center space-y-3">
            <div className="flex justify-center">
              <Mascot area="community" size={88} />
            </div>
            <p className="text-ink-3 font-medium">ยังไม่มีโพสต์ในหมวดหมู่นี้</p>
            {user && (
              <button onClick={openModal} className={`px-5 py-2 rounded-xl ${PRIMARY_FILL} text-sm font-bold smooth-hover`}>
                สร้างโพสต์แรก
              </button>
            )}
          </div>
        )}
      </div>

      {/* Load More */}
      {!loading && posts.length < total && (
        <div className="mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-3 rounded-2xl bg-fill border border-line text-sm font-bold text-ink-2 hover:bg-raised hover:text-ink disabled:opacity-40 smooth-hover flex items-center justify-center gap-2"
          >
            {loadingMore ? (
              <>
                <Loader context="inline" />
                กำลังโหลด...
              </>
            ) : 'โหลดโพสต์เพิ่ม'}
          </button>
        </div>
      )}

      {/* Create Post Modal — bottom sheet on mobile, centered dialog on desktop */}
      {showCreateModal && (
        <div
          className={`fixed inset-0 z-[100] flex items-end sm:items-center sm:p-4 bg-scrim/80 transition-opacity duration-300 ${isModalVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className={`
            w-full sm:max-w-2xl sm:mx-auto
            bg-surface border border-line border-b-0 sm:border-b
            rounded-t-[2rem] sm:rounded-3xl
            shadow-2xl flex flex-col
            h-[92dvh] sm:h-auto sm:max-h-[90vh]
            transition-all duration-300 ease-out
            ${isModalVisible
              ? 'translate-y-0 sm:scale-100 sm:opacity-100'
              : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'}
          `}>
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-fill" />
            </div>

            <header className="px-5 py-4 sm:p-6 border-b border-line flex items-center justify-between shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-ink">สร้างโพสต์ใหม่</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-fill hover:bg-raised text-ink-2 hover:text-ink transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6L18 18" />
                </svg>
              </button>
            </header>

            <div
              ref={modalScrollRef}
              className="p-5 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1"
            >
              {/* Category + Manga — stack on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-ink-3 uppercase mb-2">หมวดหมู่</label>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories(userRole).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewPost({ ...newPost, category: cat })}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                          newPost.category === cat
                            ? "bg-ink border-ink text-bg"
                            : "bg-fill text-ink-3 border-line hover:border-ink-3"
                        }`}
                      >
                        {cat === 'general' ? 'ทั่วไป' : cat === 'announcement' ? 'ประกาศ' : cat === 'spoiler' ? 'สปอยล์' : 'อัปเดตมังงะ'}
                      </button>
                    ))}
                  </div>
                </div>

                <MangaSearchSelector
                  onSelect={setSelectedManga}
                  selectedManga={selectedManga}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-ink-3 uppercase mb-2">หัวข้อ</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="เขียนหัวข้อโพสต์ที่นี่..."
                  className="w-full bg-fill border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-ink-3 uppercase mb-2">เนื้อหา</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="รายละเอียดสิ่งที่คุณต้องการจะพูดคุย..."
                  rows={4}
                  className="w-full bg-fill border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent transition-all resize-none"
                />
              </div>

              <PostImageUploader images={postImages} onChange={setPostImages} />
            </div>

            <footer className="px-5 py-4 sm:p-6 bg-fill border-t border-line flex gap-3 shrink-0"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={closeModal}
                className="flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-bold text-ink-2 bg-fill hover:bg-raised transition-all active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreatePost}
                disabled={!newPost.title.trim() || !newPost.content.trim() || submitting}
                className={`flex-1 sm:flex-none px-8 py-3 rounded-xl ${PRIMARY_FILL} font-black text-sm disabled:opacity-40 transition-all active:scale-95`}
              >
                {submitting ? "กำลังโพสต์..." : "โพสต์เลย"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* FAB — Mobile Create Post */}
      <button
        onClick={() => user ? openModal() : showLoginPrompt()}
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

export default function CommunityPage() {
  usePageTitle("คอมมูนิตี้");
  return (
    <CommunityErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <Loader context="page" />
        </div>
      }>
        <CommunityContent />
      </Suspense>
    </CommunityErrorBoundary>
  );
}
