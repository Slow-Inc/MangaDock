"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import VoteButtons from "./VoteButtons";
import { createComment } from "../lib/communityApi";
import type { ForumComment } from "../lib/types";

export default function CommentThread({ 
  comment, 
  depth = 0,
  onCommentAdded
}: { 
  comment: ForumComment; 
  depth?: number;
  onCommentAdded: (newComment: ForumComment) => void;
}) {
  const [isReplying, setIsIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newReply = await createComment({
        postId: comment.postId,
        parentId: comment.id,
        content: replyContent,
      });
      onCommentAdded(newReply);
      setReplyContent("");
      setIsIsReplying(false);
    } catch (err) {
      console.error("Failed to post reply", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`mt-4 ${depth > 0 ? "ml-4 pl-4 border-l border-white/5" : ""}`}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden shrink-0">
            {comment.authorPhotoUrl && (
              <Image 
                src={comment.authorPhotoUrl} 
                alt={comment.authorName || 'user'} 
                width={32} 
                height={32}
                className="object-cover"
              />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <header className="flex items-center gap-2 text-xs mb-1">
            <span className={`font-bold ${
              comment.authorRole === 'translator' ? "text-indigo-400" : 
              comment.authorRole === 'creator' ? "text-orange-400" : "text-white/80"
            }`}>
              {comment.authorName || 'Unknown User'}
            </span>
            <span className="text-white/30">•</span>
            <span className="text-white/30">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: th })}
            </span>
          </header>

          <p className="text-white/90 text-sm leading-relaxed mb-2 whitespace-pre-wrap">
            {comment.content}
          </p>

          <div className="flex items-center gap-4">
            <VoteButtons
              targetType="comment"
              targetId={comment.id}
              initialUpvotes={comment.upvotes}
              initialDownvotes={comment.downvotes}
              initialUserVote={comment.userVote}
            />
            
            <button 
              onClick={() => setIsIsReplying(!isReplying)}
              className="text-xs font-bold text-white/40 hover:text-white transition-colors"
            >
              ตอบกลับ
            </button>
          </div>

          {isReplying && (
            <div className="mt-3">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="เขียนข้อความตอบกลับ..."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={() => setIsIsReplying(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/50 hover:bg-white/5 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleReply}
                  disabled={!replyContent.trim() || submitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? "กำลังส่ง..." : "ส่งข้อความ"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Render nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-1">
          {comment.replies.map((reply) => (
            <CommentThread 
              key={reply.id} 
              comment={reply} 
              depth={depth + 1}
              onCommentAdded={onCommentAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
