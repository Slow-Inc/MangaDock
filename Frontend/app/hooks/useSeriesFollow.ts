"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import { removeFollowItem, restoreFollowItem, singleFlight, type FollowedSeries, type RemovedFollow } from "./seriesFollowState";

export type { FollowedSeries };

export const FOLLOW_EVENT = "mb-follow-updated";

// ─── Module-level cache ────────────────────────────────────────────────────
let followedIds: Set<string> = new Set();
let followItems: FollowedSeries[] = [];
let loaded = false;
/** The last load failed (#934): a failed load is not "no series followed". */
let loadFailed = false;

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FOLLOW_EVENT));
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Every follow button on a page calls loadFollows() before `loaded` flips — share one request.
const followsLoad = singleFlight(fetchFollows);

export function loadFollows(): Promise<void> {
  return followsLoad.run();
}

async function fetchFollows(isCurrent: () => boolean): Promise<void> {
  try {
    const token = await getToken();
    if (!isCurrent()) return; // signed out meanwhile — this result belongs to the previous user
    if (!token) {
      followedIds = new Set();
      followItems = [];
      loaded = true;
      loadFailed = false;
      notify();
      return;
    }
    const res = await fetch("/api/proxy/users/me/follows", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`follows ${res.status}`);
    const data: FollowedSeries[] = await res.json();
    if (!isCurrent()) return;
    followItems = data;
    followedIds = new Set(data.map((f) => f.id));
    loaded = true;
    loadFailed = false;
    notify();
  } catch {
    if (!isCurrent()) return;
    loadFailed = true;
    notify();
  }
}

export function followsLoadFailed(): boolean {
  return loadFailed;
}

export function clearFollowCache() {
  followsLoad.reset();
  followedIds = new Set();
  followItems = [];
  loaded = false;
  loadFailed = false;
  notify();
}

export function isFollowing(mangaId: string): boolean {
  return followedIds.has(mangaId);
}

export function getFollows(): FollowedSeries[] {
  return followItems;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useSeriesFollow(book: { id: string; title: string; thumbnail: string }) {
  const { user, showLoginPrompt } = useContext(AuthContext);
  const { showToast } = useToast();
  const [following, setFollowing] = useState(() => followedIds.has(book.id));
  const [toggling, setToggling] = useState(false);
  const busy = useRef(false); // re-entry guard; `toggling` state is stale inside a double click (#669)

  useEffect(() => {
    const sync = () => setFollowing(followedIds.has(book.id));
    window.addEventListener(FOLLOW_EVENT, sync);
    sync();
    return () => window.removeEventListener(FOLLOW_EVENT, sync);
  }, [book.id]);

  useEffect(() => {
    if (user && !loaded) loadFollows();
  }, [user]);

  const toggle = useCallback(async () => {
    if (!user) { showLoginPrompt(); return; }
    if (busy.current) return;
    busy.current = true;
    const token = await getToken().catch(() => null); // a rejected session must not leave busy set (#1013)
    if (!token) {
      busy.current = false;
      showLoginPrompt(); // signed in on screen but the session is gone: a silent no-op read as a missed click (#995)
      return;
    }

    const wasFollowing = followedIds.has(book.id);
    let removed: RemovedFollow = null;
    // Optimistic update
    if (wasFollowing) {
      followedIds.delete(book.id);
      ({ items: followItems, snapshot: removed } = removeFollowItem(followItems, book.id));
    } else {
      followedIds.add(book.id);
      followItems = [
        { id: book.id, title: book.title, thumbnail: book.thumbnail, followedAt: new Date().toISOString() },
        ...followItems,
      ];
    }
    setFollowing(!wasFollowing);
    notify();

    setToggling(true);
    try {
      const res = wasFollowing
        ? await fetch(`/api/proxy/users/me/follows/${encodeURIComponent(book.id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        : await fetch("/api/proxy/users/me/follows", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ id: book.id, title: book.title, thumbnail: book.thumbnail }),
          });
      if (!res.ok) throw new Error(`follow ${res.status}`);
    } catch {
      // Revert on a network error or an error response (#667)
      if (wasFollowing) {
        followedIds.add(book.id);
        followItems = restoreFollowItem(followItems, removed);
      } else {
        followedIds.delete(book.id);
        followItems = followItems.filter((f) => f.id !== book.id);
      }
      setFollowing(wasFollowing);
      notify();
      // the bell flipping back alone reads as a missed click (#995)
      showToast({ type: "error", message: wasFollowing ? "เลิกติดตามไม่สำเร็จ ลองใหม่อีกครั้ง" : "ติดตามไม่สำเร็จ ลองใหม่อีกครั้ง", duration: 3500 });
    } finally {
      busy.current = false;
      setToggling(false);
    }
  }, [user, book, showLoginPrompt, showToast]);

  return { following, toggling, toggle };
}
