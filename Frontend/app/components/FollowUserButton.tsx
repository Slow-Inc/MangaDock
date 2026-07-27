"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

type Props = { targetUid: string };

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function FollowUserButton({ targetUid }: Props) {
  const { user, showLoginPrompt } = useContext(AuthContext);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/proxy/user-follows/${encodeURIComponent(targetUid)}/is-following`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, [targetUid]);

  useEffect(() => {
    if (user) fetchStatus();
    else setLoading(false);
  }, [user, fetchStatus]);

  async function handleToggle() {
    if (!user) { showLoginPrompt(); return; }
    if (toggling) return;
    const next = !following;
    setFollowing(next);
    setToggling(true);
    try {
      const token = await getToken();
      const method = next ? "POST" : "DELETE";
      const res = await fetch(`/api/proxy/user-follows/${encodeURIComponent(targetUid)}/follow`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) setFollowing(!next);
    } catch {
      setFollowing(!next);
    } finally {
      setToggling(false);
    }
  }

  if (loading) return <div className="h-8 w-24 animate-pulse rounded-full bg-white/10" />;

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
        following
          ? "border-white/20 bg-white/8 text-white/70 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
          : "border-indigo-500/50 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/35"
      }`}
    >
      {following ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          ติดตามอยู่
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          ติดตาม
        </>
      )}
    </button>
  );
}
