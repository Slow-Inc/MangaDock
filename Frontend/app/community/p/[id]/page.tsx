"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "../../../components/Navbar";
import { PostDetailSkeleton } from "../../../components/ForumSkeleton";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { getPost, listComments, createComment } from "../../../lib/communityApi";
import VoteButtons from "../../../components/VoteButtons";
import CommentThread from "../../../components/CommentThread";
import { useAuth } from "../../../contexts/AuthContext";
import type { ForumPost, ForumComment } from "../../../lib/types";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [post, setPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        getPost(id),
        listComments(id)
      ]);
      setPost(postRes);
      setComments(commentsRes);
    } catch (err) {
      console.error(err);
      // router.push("/community");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePostComment = async () => {
    if (!newComment.trim() || submitting || !post) return;
    setSubmitting(true);
    try {
      await createComment({ postId: post.id, content: newComment });
      setNewComment("");
      fetchData(); // Refresh all to show new nested comment if needed, or just append
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414]">
        <Navbar />
        <main className="pt-24 pb-20 px-4 lg:px-10">
          <div className="max-w-4xl mx-auto">
            <PostDetailSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-[#141414]">
      <Navbar />
      
      <main className="pt-24 pb-20 px-4 lg:px-10">
        <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-6 transition-colors font-bold text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          ย้อนกลับ
        </button>

        <article className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden mb-8">
          <div className="flex">
            <div className="hidden sm:flex flex-col items-center p-4 bg-white/2 border-r border-white/5">
               <VoteButtons
                  targetType="post"
                  targetId={post.id}
                  initialUpvotes={post.upvotes}
                  initialDownvotes={post.downvotes}
                  initialUserVote={post.userVote}
                />
            </div>

            <div className="flex-1 p-6 sm:p-8">
              <header className="flex items-center gap-3 mb-4 text-xs text-white/40">
                <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden shrink-0">
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
                <span className={`font-bold text-sm ${
                  post.authorRole === 'translator' ? "text-indigo-400" : 
                  post.authorRole === 'creator' ? "text-orange-400" : "text-white/80"
                }`}>
                  {post.authorName || 'Unknown User'}
                </span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: th })}
                </span>
                <span className="ml-auto px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                  {post.category}
                </span>
              </header>

              <h1 className="text-2xl sm:text-3xl font-black text-white mb-6 leading-tight">
                {post.title}
              </h1>

              <div className="text-white/90 text-base leading-relaxed whitespace-pre-wrap mb-8">
                {post.content}
              </div>

              <footer className="pt-6 border-t border-white/5 flex items-center gap-6">
                 <div className="sm:hidden">
                    <VoteButtons
                      targetType="post"
                      targetId={post.id}
                      initialUpvotes={post.upvotes}
                      initialDownvotes={post.downvotes}
                      initialUserVote={post.userVote}
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
                onCommentAdded={fetchData}
              />
            ))
          ) : (
            <div className="py-10 text-center">
              <p className="text-white/20 font-bold">ยังไม่มีใครมาแสดงความเห็นเลย...</p>
            </div>
          )}
        </section>
      </div>
    </main>
  </div>
  );
}
