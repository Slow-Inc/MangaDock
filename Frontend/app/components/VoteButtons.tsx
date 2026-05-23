"use client";

import { useState } from "react";
import { vote } from "../lib/communityApi";

interface VoteButtonsProps {
  targetType: 'post' | 'comment';
  targetId: string;
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote: number;
}

export default function VoteButtons({
  targetType,
  targetId,
  initialUpvotes,
  initialDownvotes,
  initialUserVote,
}: VoteButtonsProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [loading, setLoading] = useState(false);

  const handleVote = async (value: 1 | -1) => {
    if (loading) return;
    setLoading(true);

    try {
      const result = await vote({ targetType, targetId, voteValue: value });
      setUpvotes(result.upvotes);
      setDownvotes(result.downvotes);
      
      // If user clicks the same vote again, it toggles off (0), else sets to new value
      setUserVote(prev => prev === value ? 0 : value);
    } catch (err) {
      console.error("Vote failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
      <button
        onClick={() => handleVote(1)}
        disabled={loading}
        className={`p-1.5 rounded-full transition-colors ${
          userVote === 1 
            ? "text-orange-500 bg-orange-500/10" 
            : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      <span className={`text-xs font-bold min-w-[1.5rem] text-center ${
        userVote === 1 ? "text-orange-500" : userVote === -1 ? "text-indigo-500" : "text-white/80"
      }`}>
        {upvotes - downvotes}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={loading}
        className={`p-1.5 rounded-full transition-colors ${
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
