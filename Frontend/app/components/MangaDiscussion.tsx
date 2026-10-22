"use client";

import { PRIMARY_FILL } from "./ui/Button";
import { useEffect, useState, useCallback } from "react";
import { ROLE } from "../lib/types/user";
import Link from "next/link";
import { listPosts, createPost } from "../lib/communityApi";
import { useAuth } from "../contexts/AuthContext";
import PostCard from "./PostCard";
import { PostSkeleton } from "./ForumSkeleton";
import LoadError from "./ui/LoadError";
import type { ForumPost } from "../lib/types";
import { FORUM_LIMITS, clipToLimit } from "../lib/forumLimits";
import LimitCounter from "./ui/LimitCounter";

export default function MangaDiscussion({ mangaId, title, cover }: { mangaId: string, title: string, cover?: string }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false); // a failed load is not "no discussion yet" (#930)
  const [isPosting, setIsPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await listPosts({ mangaId, sort: 'new', limit: 5 });
      setPosts(res.items);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [mangaId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleQuickPost = async () => {
    if (!newPostContent.trim() || submitting) return;

    const content = newPostContent;
    const tempId = `temp-${Date.now()}`;
    const tempPost: ForumPost = {
      id: tempId,
      // a long manga title would push these past the server's 200 (#988)
      title: clipToLimit(`พูดคุยเกี่ยวกับเรื่อง ${title}`, FORUM_LIMITS.title),
      content,
      category: 'general',
      targetMangaId: mangaId,
      targetMangaTitle: clipToLimit(title, FORUM_LIMITS.title),
      targetMangaCover: cover ?? null,
      imageUrls: [],
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

    // Optimistic: show post immediately, close form
    setPosts(prev => [tempPost, ...prev]);
    setNewPostContent("");
    setIsPosting(false);
    setSubmitting(true);

    try {
      const realPost = await createPost({
        title: tempPost.title,
        content,
        category: 'general',
        targetMangaId: mangaId,
        targetMangaTitle: clipToLimit(title, FORUM_LIMITS.title),
        targetMangaCover: cover,
      });
      // Replace temp with authoritative server post
      setPosts(prev => prev.map(p => p.id === tempId ? realPost : p));
      if (failed) fetchPosts(); // the list had failed: reload it, or the new post stays behind the error (#930)
    } catch (err) {
      console.error(err);
      // Revert: remove temp post, restore form
      setPosts(prev => prev.filter(p => p.id !== tempId));
      setNewPostContent(content);
      setIsPosting(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="px-6 py-8 border-t border-line">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-ink">กระทู้พูดคุย</h3>
        {!isPosting && user && (
          <button 
            onClick={() => setIsPosting(true)}
            className="text-xs font-bold text-accent hover:text-ink transition-colors"
          >
            + เริ่มการสนทนา
          </button>
        )}
      </div>

      {isPosting && (
        <div className="bg-fill border border-line rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            maxLength={FORUM_LIMITS.content}
            placeholder="คุณคิดยังไงกับเรื่องนี้..."
            className="w-full bg-transparent border-none text-sm text-ink placeholder:text-ink-3 focus:ring-0 resize-none"
            rows={3}
            autoFocus
          />
          <LimitCounter value={newPostContent} max={FORUM_LIMITS.content} />
          <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-line">
            <button 
              onClick={() => setIsPosting(false)}
              className="px-3 py-1.5 text-xs font-bold text-ink-2 hover:text-ink"
            >
              ยกเลิก
            </button>
            <button 
              onClick={handleQuickPost}
              disabled={!newPostContent.trim() || submitting}
              className={`${PRIMARY_FILL} px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50`}
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
        ) : failed ? (
          <LoadError what="บทสนทนา" onRetry={fetchPosts} />
        ) : posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="py-12 text-center bg-fill border border-dashed border-line rounded-2xl">
            <p className="text-xs font-medium text-ink-3 uppercase">ยังไม่มีบทสนทนา</p>
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <div className="mt-6 text-center">
          <Link
            href={`/community?mangaId=${mangaId}`}
            className="text-[10px] font-black uppercase text-ink-2 hover:text-ink transition-colors"
          >
            ดูการสนทนาทั้งหมด
          </Link>
        </div>
      )}
    </section>
  );
}
