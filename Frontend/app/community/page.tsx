"use client";

import { useEffect, useState, useCallback } from "react";
import PostCard from "../components/PostCard";
import Navbar from "../components/Navbar";
import { PostSkeleton } from "../components/ForumSkeleton";
import { listPosts, createPost } from "../lib/communityApi";
import { useAuth } from "../contexts/AuthContext";
import type { ForumPost, ForumCategory } from "../lib/types";

export default function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ForumCategory | undefined>(undefined);
  const [sort, setSort] = useState<'new' | 'hot'>('new');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" as ForumCategory });
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPosts({ category, sort });
      setPosts(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [category, sort]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createPost(newPost);
      setShowCreateModal(false);
      setNewPost({ title: "", content: "", category: "general" });
      fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      <Navbar />
      
      <main className="pt-24 pb-20 px-4 lg:px-10">
        <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white mb-1 tracking-tight">คอมมูนิตี้</h1>
            <p className="text-white/40 text-sm">พูดคุย แลกเปลี่ยน และอัปเดตข่าวสารมังงะ</p>
          </div>
          
          <button
            onClick={() => user ? setShowCreateModal(true) : alert("กรุณาเข้าสู่ระบบก่อนโพสต์")}
            className="px-6 py-2.5 rounded-full bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all shrink-0"
          >
            + สร้างโพสต์ใหม่
          </button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(['general', 'announcement', 'spoiler', 'manga_update'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? undefined : cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                category === cat 
                  ? "bg-white text-black border-white" 
                  : "bg-white/5 text-white/50 border-white/10 hover:border-white/30"
              }`}
            >
              {cat === 'general' ? 'ทั่วไป' : cat === 'announcement' ? 'ประกาศ' : cat === 'spoiler' ? 'สปอยล์' : 'อัปเดตมังงะ'}
            </button>
          ))}
          
          <div className="ml-auto flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
            <button 
              onClick={() => setSort('new')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                sort === 'new' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
              }`}
            >
              New
            </button>
            <button 
              onClick={() => setSort('hot')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                sort === 'hot' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
              }`}
            >
              Hot
            </button>
          </div>
        </div>

        {/* Posts Feed */}
        <div className="space-y-4">
          {loading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : posts.length > 0 ? (
            posts.map(post => <PostCard key={post.id} post={post} />)
          ) : (
            <div className="bg-[#1a1a1a] border border-dashed border-white/10 rounded-2xl py-20 text-center">
              <p className="text-white/40 font-medium">ยังไม่มีโพสต์ในหมวดหมู่นี้</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">สร้างโพสต์ใหม่</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-white/40 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </header>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase mb-2">หมวดหมู่</label>
                <div className="flex flex-wrap gap-2">
                  {(['general', 'announcement', 'spoiler', 'manga_update'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setNewPost({ ...newPost, category: cat })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
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
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>
            </div>

            <footer className="p-6 bg-white/2 border-t border-white/5 flex justify-end gap-3">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/50 hover:bg-white/5 transition-all"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleCreatePost}
                disabled={!newPost.title.trim() || !newPost.content.trim() || submitting}
                className="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
              >
                {submitting ? "กำลังโพสต์..." : "โพสต์เลย"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  </div>
  );
}
