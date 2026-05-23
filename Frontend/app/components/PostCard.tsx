"use client";

import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import VoteButtons from "./VoteButtons";
import type { ForumPost } from "../lib/types";

export default function PostCard({ post }: { post: ForumPost }) {
  return (
    <article className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all flex group">
      {/* Left Vote Column */}
      <div className="hidden sm:flex flex-col items-center p-3 bg-white/2 border-r border-white/5">
        <VoteButtons
          targetType="post"
          targetId={post.id}
          initialUpvotes={post.upvotes}
          initialDownvotes={post.downvotes}
          initialUserVote={post.userVote}
        />
      </div>

      <div className="flex-1 p-4 sm:p-5">
        <header className="flex items-center gap-2 mb-2 text-xs text-white/40">
          <div className="w-5 h-5 rounded-full bg-white/10 overflow-hidden">
            {post.authorPhotoUrl && (
              <Image 
                src={post.authorPhotoUrl} 
                alt={post.authorName || 'user'} 
                width={20} 
                height={20}
                className="object-cover"
              />
            )}
          </div>
          <span className={`font-semibold ${
            post.authorRole === 'translator' ? "text-indigo-400" : 
            post.authorRole === 'creator' ? "text-orange-400" : "text-white/70"
          }`}>
            {post.authorName || 'Unknown User'}
            {post.authorRole !== 'user' && (
              <span className="ml-1 px-1 bg-white/10 rounded text-[9px] uppercase tracking-tighter">
                {post.authorRole}
              </span>
            )}
          </span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: th })}
          </span>
          {post.category !== 'general' && (
            <>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">
                {post.category}
              </span>
            </>
          )}
        </header>

        <Link href={`/community/p/${post.id}`}>
          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
            {post.title}
          </h3>
          <p className="text-white/60 text-sm line-clamp-3 mb-4 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </Link>

        <footer className="flex items-center gap-4 text-xs font-semibold">
          <Link 
            href={`/community/p/${post.id}#comments`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentCount} ความคิดเห็น
          </Link>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 101.316-2.684 3 3 0 00-1.316 2.684zm0 12a3 3 0 101.316 2.684 3 3 0 00-1.316-2.684z" />
            </svg>
            แชร์
          </button>

          {/* Mobile-only vote buttons */}
          <div className="sm:hidden ml-auto">
            <VoteButtons
              targetType="post"
              targetId={post.id}
              initialUpvotes={post.upvotes}
              initialDownvotes={post.downvotes}
              initialUserVote={post.userVote}
            />
          </div>
        </footer>
      </div>
    </article>
  );
}
