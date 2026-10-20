"use client";

import { PRIMARY_FILL } from "./ui/Button";
import UserAvatar from "./ui/UserAvatar";
import Loader from "./ui/Loader";
import { useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import VoteButtons from "./VoteButtons";
import { createComment, updateComment, deleteComment } from "../lib/communityApi";
import { useAuth } from "../contexts/AuthContext";
import { useModalTransition } from "../hooks/useModalTransition";
import type { ForumComment } from "../lib/types";

function CommentThreadImpl({
  comment,
  depth = 0,
  onCommentAdded
}: {
  comment: ForumComment;
  depth?: number;
  onCommentAdded: (newComment: ForumComment) => void;
}) {
  const { user, showLoginPrompt } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [displayContent, setDisplayContent] = useState(comment.content);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingComment, setDeletingComment] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  // Mobile long-press context menu
  const [sheetOpen, setSheetOpen] = useState(false);
  const { mounted: contextMenuOpen, visible: sheetVisible } = useModalTransition(sheetOpen, {
    duration: 300,
    onClosed: () => setConfirmDelete(false),
  });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  const isOwnComment = !!(user?.uid === comment.authorUid && !comment.id.startsWith('temp-') && !isEditing);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || !isOwnComment) return;
    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
      setConfirmDelete(false);
      setSheetOpen(true);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!longPressStartRef.current) return;
    const dx = e.clientX - longPressStartRef.current.x;
    const dy = e.clientY - longPressStartRef.current.y;
    if (dx * dx + dy * dy > 100) cancelLongPress();
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  const handleDeleteComment = async () => {
    if (deletingComment) return;
    setDeletingComment(true);
    try {
      await deleteComment(comment.id, comment.postId);
      setIsDeleted(true);
    } catch {
      console.error("Failed to delete comment");
      setDeletingComment(false);
      setConfirmDelete(false);
    }
  };

  const closeSheet = () => setSheetOpen(false);

  const handleEditStart = () => {
    setEditContent(displayContent);
    setIsEditing(true);
    closeSheet();
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await updateComment(comment.id, { content: editContent });
      setDisplayContent(editContent);
      setIsEditing(false);
    } catch {
      console.error("Failed to update comment");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || submitting) return;

    const content = replyContent;

    setReplyContent("");
    setIsReplying(false);
    setSubmitting(true);

    try {
      const result = await createComment({ postId: comment.postId, parentId: comment.id, content });
      onCommentAdded(result);
    } catch {
      console.error("Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  if (isDeleted) return null;

  return (
    <div className={`mt-4 ${depth > 0 ? "ml-4 pl-4 border-l border-line" : ""}`}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <UserAvatar uid={comment.authorUid} photoUrl={comment.authorPhotoUrl} size={32} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Long-pressable bubble area (mobile only) */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onContextMenu={isOwnComment ? (e) => e.preventDefault() : undefined}
            className={isOwnComment ? "select-none sm:select-auto" : ""}
          >
            <header className="flex items-center gap-2 text-xs mb-1">
              <Link
                href={`/community/profile/${comment.authorUid}`}
                className={`font-bold hover:underline underline-offset-2 transition-opacity hover:opacity-80 ${
                  comment.authorRole === 1 ? "text-accent" :
                  comment.authorRole === 2 ? "text-ink" : "text-ink"
                }`}
              >
                {comment.authorName || 'Unknown User'}
              </Link>
              <span className="text-ink-3">•</span>
              <span className="text-ink-3">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: th })}
              </span>
            </header>

            {isEditing ? (
              <div className="mb-2 animate-in fade-in duration-200">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="w-full bg-fill border border-line rounded-lg p-3 text-sm text-ink focus:outline-none focus:border-ink-3 smooth-hover resize-none"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-ink-2 hover:bg-fill smooth-hover"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || savingEdit}
                    className={`${PRIMARY_FILL} px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed smooth-hover`}
                  >
                    {savingEdit ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-ink text-sm leading-relaxed mb-2 whitespace-pre-wrap">
                {displayContent}
              </p>
            )}
          </div>

          {comment.id.startsWith('temp-') && (
            <p className="text-ink-3 text-xs mb-2 flex items-center gap-1">
              <Loader context="inline" />
              กำลังโพสต์...
            </p>
          )}

          <div className="flex items-center gap-4">
            <VoteButtons
              targetType="comment"
              targetId={comment.id}
              initialUpvotes={comment.upvotes}
              initialDownvotes={comment.downvotes}
              initialUserVote={comment.userVote}
            />

            <button
              onClick={() => user ? setIsReplying(!isReplying) : showLoginPrompt()}
              className="text-xs font-bold text-ink-2 hover:text-ink transition-colors"
            >
              ตอบกลับ
            </button>

            {/* Desktop-only inline edit/delete */}
            {isOwnComment && !isEditing && (
              <div className="hidden sm:flex items-center gap-3">
                {confirmDelete ? (
                  <div className="flex items-center gap-2 animate-in fade-in duration-150">
                    <span className="text-[10px] text-ink-3">ลบใช่ไหม?</span>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs font-bold text-ink-2 hover:text-ink transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleDeleteComment}
                      disabled={deletingComment}
                      className="text-xs font-bold text-danger hover:text-danger disabled:opacity-50 transition-colors"
                    >
                      {deletingComment ? "กำลังลบ..." : "ลบ"}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleEditStart}
                      className="text-xs font-bold text-ink-2 hover:text-ink transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      แก้ไข
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="text-xs font-bold text-danger/30 hover:text-danger transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      ลบ
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {isReplying && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="เขียนข้อความตอบกลับ..."
                className="w-full bg-fill border border-line rounded-lg p-3 text-sm text-ink focus:outline-none focus:border-ink-3 smooth-hover resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsReplying(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-ink-2 hover:bg-fill smooth-hover"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleReply}
                  disabled={!replyContent.trim() || submitting}
                  className={`${PRIMARY_FILL} px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed smooth-hover`}
                >
                  {submitting ? "กำลังส่ง..." : "ส่งข้อความ"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile long-press bottom sheet — portalled to body, sm:hidden */}
      {contextMenuOpen && typeof window !== "undefined" && createPortal(
        <div className="sm:hidden">
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-50 bg-scrim/60 transition-opacity duration-300 ${sheetVisible ? "opacity-100" : "opacity-0"}`}
            onPointerDown={closeSheet}
          />
          {/* Sheet */}
          <div
            className={`fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-line shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${sheetVisible ? "translate-y-0" : "translate-y-full"}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-fill" />
            </div>

            {/* Comment preview */}
            <p className="px-5 pt-1 pb-3 text-xs text-ink-3 line-clamp-2 border-b border-line">
              {displayContent}
            </p>

            {confirmDelete ? (
              <div key="confirm" className="p-4 space-y-3 animate-in fade-in slide-in-from-right-2 duration-150">
                <p className="text-sm text-ink-2 text-center font-medium">ลบความคิดเห็นนี้ใช่ไหม?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-ink-2 bg-fill active:bg-raised transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleDeleteComment}
                    disabled={deletingComment}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-bg bg-danger hover:bg-danger/90 active:bg-danger/80 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingComment && <Loader context="inline" />}
                    {deletingComment ? "กำลังลบ..." : "ลบ"}
                  </button>
                </div>
                <div style={{ height: "env(safe-area-inset-bottom)" }} />
              </div>
            ) : (
              <div key="menu" className="p-2 animate-in fade-in slide-in-from-left-2 duration-150" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
                <button
                  onClick={handleEditStart}
                  className="flex items-center gap-4 w-full px-4 py-4 rounded-2xl text-base font-semibold text-ink hover:bg-fill active:bg-fill transition-colors"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  แก้ไข
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-4 w-full px-4 py-4 rounded-2xl text-base font-semibold text-danger hover:bg-danger/8 active:bg-danger/12 transition-colors"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  ลบ
                </button>
                <div className="h-px bg-fill mx-3 my-1" />
                <button
                  onClick={closeSheet}
                  className="flex items-center justify-center w-full px-4 py-4 rounded-2xl text-base font-semibold text-ink-3 hover:bg-fill active:bg-fill transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

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

/**
 * Memoized: PostDetailPage re-renders on post-vote / comment-add SSE events.
 * With a stable onCommentAdded (parent useCallback) memo skips reconciling
 * unchanged comment subtrees (plan 2026-07-11 Perf 3). The recursive reference
 * above resolves to this memoized component at render time.
 */
const CommentThread = memo(CommentThreadImpl);
export default CommentThread;
