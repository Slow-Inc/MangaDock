"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PostCard from "../components/PostCard";
import { PostSkeleton } from "../components/ForumSkeleton";
import { listPosts, createPost } from "../lib/communityApi";
import { useAuth } from "../contexts/AuthContext";
import type { ForumPost, ForumCategory, LandingBook } from "../lib/types";
import MangaSearchSelector from "../components/MangaSearchSelector";
import PostImageUploader from "../components/PostImageUploader";
import { useLocalLenis } from "../hooks/useLocalLenis";
import { useFeedStream } from "../hooks/useForumStream";

function CommunityContent() {
  const { user, showLoginPrompt } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [category, setCategory] = useState<ForumCategory | undefined>(
    (searchParams.get('category') as ForumCategory) || undefined
  );
  const [mangaId, setMangaId] = useState<string | undefined>(
    searchParams.get('mangaId') || undefined
  );
  const [sort, setSort] = useState<'new' | 'hot'>('hot');
  const [viewMode, setViewMode] = useState<'card' | 'compact'>('card');
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" as ForumCategory });
  const [selectedManga, setSelectedManga] = useState<LandingBook | null>(null);
  const [postImages, setPostImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Modal Smooth Scrolling
  const modalScrollRef = useRef<HTMLDivElement>(null);
  useLocalLenis(modalScrollRef, 'vertical', showCreateModal);

  // Sync state when URL params change
  useEffect(() => {
    setMangaId(searchParams.get('mangaId') || undefined);
    setCategory((searchParams.get('category') as ForumCategory) || undefined);
  }, [searchParams]);

  useEffect(() => {
    const handleToggle = () => setIsMobileMenuOpen(prev => !prev);
    window.addEventListener('toggleMobileMenu', handleToggle);
    return () => window.removeEventListener('toggleMobileMenu', handleToggle);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) setViewMode('compact');
  }, []);

  const [newPostCount, setNewPostCount] = useState(0);

  useFeedStream({
    onNewPost: useCallback(() => {
      setNewPostCount(prev => prev + 1);
    }, []),
  });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPosts({ category, mangaId, sort });
      setPosts(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [category, mangaId, sort]);

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
      authorRole: user?.role ?? 'user',
      upvotes: 0,
      downvotes: 0,
      userVote: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic: close modal + prepend post immediately
    setPosts(prev => [tempPost, ...prev]);
    setShowCreateModal(false);
    setNewPost({ title: "", content: "", category: "general" });
    setSelectedManga(null);
    setPostImages([]);
    setSubmitting(true);

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
      setShowCreateModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="w-full sm:w-auto">
          <h1 className="text-3xl font-extrabold text-white mb-1 tracking-tight">คอมมูนิตี้</h1>
          <p className="text-white/40 text-sm font-medium">พื้นที่แบ่งปันและพูดคุยเกี่ยวกับมังงะที่คุณรัก</p>
        </div>
        
        <button
          onClick={() => user ? setShowCreateModal(true) : showLoginPrompt()}
          className="hidden sm:block px-8 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 smooth-hover shrink-0 active:scale-95"
        >
          + สร้างโพสต์ใหม่
        </button>
      </header>

      {/* Mobile Filter Strip — sort + category in one scrollable row */}
      <div className="sm:hidden -mx-4 px-4 mb-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10 shrink-0">
            <button onClick={() => setSort('hot')} className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === 'hot' ? 'bg-white/10 text-white' : 'text-white/30'}`}>Hot</button>
            <button onClick={() => setSort('new')} className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${sort === 'new' ? 'bg-white/10 text-white' : 'text-white/30'}`}>New</button>
          </div>
          <div className="w-px h-5 bg-white/10 shrink-0" />
          <button
            onClick={() => handleMobileCategorySelect(undefined)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border smooth-hover-fast ${!category ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-white/50'}`}
          >ทั้งหมด</button>
          {(['general', 'announcement', 'spoiler', 'manga_update'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => handleMobileCategorySelect(category === cat ? undefined : cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border smooth-hover-fast ${category === cat ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-white/50'}`}
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
          <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10 smooth-hover hidden sm:flex">
            <button 
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md smooth-hover-fast ${viewMode === 'card' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h16" />
              </svg>
            </button>
            <button 
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded-md smooth-hover-fast ${viewMode === 'compact' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}
              title="Compact View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {mangaId && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold animate-in fade-in zoom-in-95">
              <span>ชุมชนมังงะ</span>
              <button onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.delete('mangaId');
                router.push(`/community?${params.toString()}`);
              }} className="hover:text-white transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </div>
          )}
          {category && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold animate-in fade-in zoom-in-95">
              <span>หมวด: {category === 'general' ? 'ทั่วไป' : category === 'announcement' ? 'ประกาศ' : category === 'spoiler' ? 'สปอยล์' : 'อัปเดตมังงะ'}</span>
              <button onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.delete('category');
                router.push(`/community?${params.toString()}`);
              }} className="hover:text-white transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        <div className="hidden sm:flex items-center bg-white/5 rounded-lg p-1 border border-white/10 smooth-hover">
          <button
            onClick={() => setSort('hot')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${
              sort === 'hot' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
            }`}
          >
            Hot
          </button>
          <button
            onClick={() => setSort('new')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase smooth-hover-fast ${
              sort === 'new' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
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
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-bold shadow-xl shadow-indigo-500/30 animate-in slide-in-from-top-2 duration-300 hover:bg-indigo-500 active:scale-95 transition-transform"
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
        ) : posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} viewMode={viewMode} />)
        ) : (
          <div className="bg-[#1a1a1a] border border-dashed border-white/10 rounded-2xl py-20 text-center">
            <p className="text-white/40 font-medium">ยังไม่มีโพสต์ในหมวดหมู่นี้</p>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <header className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">สร้างโพสต์ใหม่</h2>
              <button onClick={() => { setShowCreateModal(false); setPostImages([]); }} className="text-white/40 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </header>
            
            <div 
              ref={modalScrollRef}
              className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase mb-2">หมวดหมู่</label>
                  <div className="flex flex-wrap gap-2">
                    {(['general', 'announcement', 'spoiler', 'manga_update'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewPost({ ...newPost, category: cat })}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border smooth-hover ${
                          newPost.category === cat 
                            ? "bg-indigo-600 border-indigo-500 text-white" 
                            : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
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

export default function CommunityPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <CommunityContent />
    </Suspense>
  );
}
