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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10 smooth-hover">
      <button
        onClick={() => handleVote(1)}
        disabled={loading}
        className={`p-1.5 rounded-full smooth-hover-fast ${
          userVote === 1 
            ? "text-orange-500 bg-orange-500/10" 
            : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      <span className={`text-xs font-bold min-w-[1.5rem] text-center smooth-hover-fast ${
        userVote === 1 ? "text-orange-500" : userVote === -1 ? "text-indigo-500" : "text-white/80"
      }`}>
        {upvotes - downvotes}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={loading}
        className={`p-1.5 rounded-full smooth-hover-fast ${
          userVote === -1 
            ? "text-indigo-500 bg-indigo-500/10" 
            : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
