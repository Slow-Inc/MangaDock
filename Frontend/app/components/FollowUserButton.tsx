"use client";

import { useContext, useEffect, useRef, useState } from "react";
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
  const togglingRef = useRef(false);

  useEffect(() => {
    // The instance is reused across /community/profile/[uid] navigations: drop the
    // previous profile's state and ignore responses that arrive for an old targetUid.
    let cancelled = false;
    setFollowing(false);
    if (!user) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      let next = false; // unknown (no token / non-ok / network error) → not following
      try {
        const token = await getToken();
        if (token) {
          const res = await fetch(`/api/proxy/user-follows/${encodeURIComponent(targetUid)}/is-following`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) next = (await res.json()).following ?? false;
        }
      } catch { /* keep `next = false`; the button stays usable */ }
      if (cancelled) return;
      setFollowing(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, targetUid]);

  async function handleToggle() {
    if (!user) { showLoginPrompt(); return; }
    // A ref, not the `toggling` state: two clicks before the re-render would both read the stale `false`.
    if (togglingRef.current) return;
    togglingRef.current = true;
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
      togglingRef.current = false;
      setToggling(false);
    }
  }

  if (loading) return <div className="h-8 w-24 animate-pulse rounded-full bg-fill" />;

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
        following
          ? "border-ink-3 bg-fill text-ink-2 hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
          : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
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
