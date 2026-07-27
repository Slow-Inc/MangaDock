"use client";

import { useState, useEffect } from "react";
import { vote } from "../lib/communityApi";
import { useAuth } from "../contexts/AuthContext";

interface VoteButtonsProps {
  targetType: 'post' | 'comment';
  targetId: string;
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote: number;
  externalCounts?: { upvotes: number; downvotes: number };
}

export default function VoteButtons({
  targetType,
  targetId,
  initialUpvotes,
  initialDownvotes,
  initialUserVote,
  externalCounts,
}: VoteButtonsProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [loading, setLoading] = useState(false);

  const { user, showLoginPrompt } = useAuth();

  // Resync when the target changes (e.g. VoteButtons reused across different posts).
  // Intentionally omits initialUpvotes/Downvotes from deps — those update via externalCounts,
  // not by prop drilling, so including them here would overwrite in-progress optimistic state.
  useEffect(() => {
    setUpvotes(initialUpvotes);
    setDownvotes(initialDownvotes);
    setUserVote(initialUserVote);
  }, [targetId]);

  // Sync SSE vote updates from other users (ignored while user is actively voting)
  useEffect(() => {
    if (!loading && externalCounts) {
      setUpvotes(externalCounts.upvotes);
      setDownvotes(externalCounts.downvotes);
    }
  }, [externalCounts, loading]);

  const handleVote = async (value: 1 | -1) => {
    if (!user) {
      showLoginPrompt();
      return;
    }
    if (loading) return;

    // Snapshot for revert
    const prevUpvotes = upvotes;
    const prevDownvotes = downvotes;
    const prevUserVote = userVote;
    const isToggleOff = userVote === value;

    // Apply optimistic delta immediately — no await
    if (isToggleOff) {
      if (value === 1) setUpvotes(v => v - 1);
      else setDownvotes(v => v - 1);
      setUserVote(0);
    } else {
      if (prevUserVote === 1) setUpvotes(v => v - 1);
      if (prevUserVote === -1) setDownvotes(v => v - 1);
      if (value === 1) setUpvotes(v => v + 1);
      else setDownvotes(v => v + 1);
      setUserVote(value);
    }

    setLoading(true);
    try {
      const result = await vote({ targetType, targetId, voteValue: value });
      // Sync with authoritative server counts
      setUpvotes(result.upvotes);
      setDownvotes(result.downvotes);
    } catch {
      // Revert to pre-click state
      setUpvotes(prevUpvotes);
      setDownvotes(prevDownvotes);
      setUserVote(prevUserVote);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={loading}
        aria-label="โหวตขึ้น"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border smooth-hover-fast transition-colors ${
          userVote === 1
            ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
            : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.06] hover:border-white/10"
        }`}
      >
        <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        <span>{upvotes}</span>
      </button>

      <div className="w-px h-3.5 bg-white/10 shrink-0" />

      <button
        onClick={() => handleVote(-1)}
        disabled={loading}
        aria-label="โหวตลง"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border smooth-hover-fast transition-colors ${
          userVote === -1
            ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/25"
            : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.06] hover:border-white/10"
        }`}
      >
        <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        <span>{downvotes}</span>
      </button>
    </div>
  );
}
