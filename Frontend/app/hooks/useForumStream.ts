"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ForumComment } from "../lib/types";

export type ForumStreamEvent =
  | { type: "vote"; postId: string; targetType: "post" | "comment"; targetId: string; upvotes: number; downvotes: number }
  | { type: "comment"; postId: string; comment: ForumComment }
  | { type: "post_edited"; postId: string; title: string; content: string; updatedAt: string }
  | { type: "post_deleted"; postId: string }
  | { type: "comment_deleted"; postId: string; commentId: string }
  | { type: "heartbeat" };

export type FeedStreamEvent =
  | { type: "new_post"; id: string; title: string; authorName: string | null; authorPhotoUrl: string | null; category: string; createdAt: string }
  | { type: "heartbeat" };

interface UsePostStreamOptions {
  postId: string;
  onEvent: (event: ForumStreamEvent) => void;
  enabled?: boolean;
}

export function usePostStream({ postId, onEvent, enabled = true }: UsePostStreamOptions) {
  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    esRef.current?.close();
    const es = new EventSource(`/api/proxy/forum/posts/${postId}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as ForumStreamEvent;
        if (data.type !== "heartbeat") onEventRef.current(data);
        retriesRef.current = 0;
      } catch (err) {
        console.warn("[usePostStream] Failed to parse SSE event:", err);
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      const delay = Math.min(1_000 * 2 ** retriesRef.current, 30_000);
      retriesRef.current = Math.min(retriesRef.current + 1, 6);
      timerRef.current = setTimeout(connect, delay);
    };
  }, [postId]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect, enabled]);
}

interface UseFeedStreamOptions {
  onNewPost: (event: Extract<FeedStreamEvent, { type: "new_post" }>) => void;
  enabled?: boolean;
}

export function useFeedStream({ onNewPost, enabled = true }: UseFeedStreamOptions) {
  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNewPostRef = useRef(onNewPost);
  onNewPostRef.current = onNewPost;

  const connect = useCallback(() => {
    esRef.current?.close();
    const es = new EventSource(`/api/proxy/forum/feed/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as FeedStreamEvent;
        if (data.type === "new_post") {
          onNewPostRef.current(data);
          retriesRef.current = 0;
        }
      } catch (err) {
        console.warn("[useFeedStream] Failed to parse SSE event:", err);
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      const delay = Math.min(1_000 * 2 ** retriesRef.current, 30_000);
      retriesRef.current = Math.min(retriesRef.current + 1, 6);
      timerRef.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect, enabled]);
}
