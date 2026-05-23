"use client";

import { useEffect, useState, useCallback } from "react";
import { listPosts, createPost } from "../lib/communityApi";
import { useAuth } from "../contexts/AuthContext";
import PostCard from "./PostCard";
import { PostSkeleton } from "./ForumSkeleton";
import type { ForumPost } from "../lib/types";

export default function MangaDiscussion({ mangaId, title }: { mangaId: string, title: string }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPosts({ mangaId, sort: 'new', limit: 5 });
      setPosts(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mangaId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleQuickPost = async () => {
    if (!newPostContent.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createPost({
        title: `พูดคุยเกี่ยวกับเรื่อง ${title}`,
        content: newPostContent,
        category: 'general',
        targetMangaId: mangaId
      });
      setNewPostContent("");
      setIsPosting(false);
      fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="px-6 py-8 border-t border-white/5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">กระทู้พูดคุย</h3>
        {!isPosting && user && (
          <button 
            onClick={() => setIsPosting(true)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            + เริ่มการสนทนา
          </button>
        )}
      </div>

      {isPosting && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="คุณคิดยังไงกับเรื่องนี้..."
            className="w-full bg-transparent border-none text-sm text-white placeholder:text-white/20 focus:ring-0 resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-white/5">
            <button 
              onClick={() => setIsPosting(false)}
              className="px-3 py-1.5 text-xs font-bold text-white/40 hover:text-white"
            >
              ยกเลิก
            </button>
            <button 
              onClick={handleQuickPost}
              disabled={!newPostContent.trim() || submitting}
              className="px-4 py-1.5 bg-indigo-600 rounded-lg text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? "กำลังส่ง..." : "โพสต์"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="py-12 text-center bg-white/2 border border-dashed border-white/5 rounded-2xl">
            <p className="text-xs font-medium text-white/20 uppercase tracking-widest">ยังไม่มีบทสนทนา</p>
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <div className="mt-6 text-center">
          <button className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">
            ดูการสนทนาทั้งหมด
          </button>
        </div>
      )}
    </section>
  );
}
