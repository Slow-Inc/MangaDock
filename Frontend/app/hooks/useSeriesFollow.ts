"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export const FOLLOW_EVENT = "mb-follow-updated";

export type FollowedSeries = {
  id: string;
  title: string;
  thumbnail: string;
  followedAt: string;
};

// ─── Module-level cache ────────────────────────────────────────────────────
let followedIds: Set<string> = new Set();
let followItems: FollowedSeries[] = [];
let loaded = false;

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FOLLOW_EVENT));
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function loadFollows(): Promise<void> {
  const token = await getToken();
  if (!token) {
    followedIds = new Set();
    followItems = [];
    loaded = true;
    notify();
    return;
  }
  try {
    const res = await fetch("/api/proxy/users/me/follows", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data: FollowedSeries[] = await res.json();
    followItems = data;
    followedIds = new Set(data.map((f) => f.id));
    loaded = true;
    notify();
  } catch { /* ignore */ }
}

export function clearFollowCache() {
  followedIds = new Set();
  followItems = [];
  loaded = false;
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
  const [following, setFollowing] = useState(() => followedIds.has(book.id));
  const [toggling, setToggling] = useState(false);

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
    const token = await getToken();
    if (!token || toggling) return;

    const wasFollowing = followedIds.has(book.id);
    // Optimistic update
    if (wasFollowing) {
      followedIds.delete(book.id);
      followItems = followItems.filter((f) => f.id !== book.id);
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
      if (wasFollowing) {
        await fetch(`/api/proxy/users/me/follows/${encodeURIComponent(book.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await fetch("/api/proxy/users/me/follows", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: book.id, title: book.title, thumbnail: book.thumbnail }),
        });
      }
    } catch {
      // Revert on network error
      if (wasFollowing) {
        followedIds.add(book.id);
        followItems = [
          { id: book.id, title: book.title, thumbnail: book.thumbnail, followedAt: "" },
          ...followItems,
        ];
      } else {
        followedIds.delete(book.id);
        followItems = followItems.filter((f) => f.id !== book.id);
      }
      setFollowing(wasFollowing);
      notify();
    } finally {
      setToggling(false);
    }
  }, [user, book, toggling, showLoginPrompt]);

  return { following, toggling, toggle };
}
