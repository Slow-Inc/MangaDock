"use client";

import { useLayoutEffect, useRef, useState } from "react";

import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import VoteButtons from "./VoteButtons";
import type { ForumPost } from "../lib/types";
import { isSocialCdnUrl } from "../lib/avatarUpload";

const ROLE_LABEL: Record<number, string> = { 1: 'นักแปล', 2: 'นักเขียน', 8: 'ผู้ดูแล', 9: 'ผู้พัฒนา' };

function MarqueeMangaTag({ title, maxWidth }: { title: string; maxWidth: number }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    const gap = text.scrollWidth - container.clientWidth;
    const overflow = gap > 2 ? gap : 0;
    if (overflow > 0) {
      text.style.setProperty("--marquee-overflow", `${overflow}px`);
      text.style.animation = `marquee-title ${Math.max(5, overflow / 22)}s linear infinite`;
    } else {
      text.style.removeProperty("--marquee-overflow");
      text.style.animation = "";
    }
  }, [title]);

  return (
    <span
      ref={containerRef}
      className="overflow-hidden inline-block align-middle"
      style={{ maxWidth }}
    >
      <span ref={textRef} className="inline-block whitespace-nowrap">
        {title}
      </span>
    </span>
  );
}

export default function PostCard({ post, viewMode = 'card' }: { post: ForumPost, viewMode?: 'card' | 'compact' }) {
  const isCompact = viewMode === 'compact';
  const isSpoiler = post.category === 'spoiler';
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  if (isCompact) {
    // ── COMPACT LAYOUT — Reddit-style: thumbnail left, content right ──
    const hasImage = (post.imageUrls?.length ?? 0) > 0;
    const thumbUrl = hasImage ? post.imageUrls[0] : null;

    return (
      <article className="bg-[--surface-raised] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 smooth-hover flex group">

        {/* Thumbnail — left side, only when images exist */}
        {hasImage && (
          <Link
            href={`/community/p/${post.id}`}
            className={`relative shrink-0 w-28 sm:w-36 self-stretch overflow-hidden bg-white/5 border-r border-white/5 ${isSpoiler && !spoilerRevealed ? 'pointer-events-none' : ''}`}
            style={{ filter: isSpoiler && !spoilerRevealed ? 'blur(4px)' : 'blur(0px)', transition: 'filter 0.5s ease' }}
          >
            <Image
              src={thumbUrl!}
              alt="thumbnail"
              fill
              loading="lazy"
              className="object-cover"
            />
            {post.imageUrls.length > 1 && (
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm">
                <svg className="w-2.5 h-2.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[9px] font-black text-white">{post.imageUrls.length}</span>
              </div>
            )}
          </Link>
        )}

        {/* Content */}
        <div className="flex-1 px-3 py-2.5 min-w-0 flex flex-col justify-center gap-1">
          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] text-white/35">
            <div className="w-4 h-4 rounded-full bg-white/10 overflow-hidden shrink-0">
              {post.authorPhotoUrl && (
                <Image src={post.authorPhotoUrl} alt={post.authorName || 'user'} width={16} height={16} className="object-cover" unoptimized={isSocialCdnUrl(post.authorPhotoUrl)} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
            </div>
            <Link
              href={`/community/profile/${post.authorUid}`}
              onClick={(e) => e.stopPropagation()}
              className={`font-bold hover:underline underline-offset-2 truncate max-w-[80px] sm:max-w-none smooth-hover ${
                post.authorRole === 1 ? "text-indigo-400" :
                post.authorRole === 2 ? "text-orange-400" : "text-white/50"
              }`}
            >
              {post.authorName || 'Unknown'}
            </Link>
            <span className="text-white/20">•</span>
            <span className="whitespace-nowrap shrink-0">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: th })}
            </span>
            {post.category !== 'general' && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold whitespace-nowrap shrink-0">
                {post.category === 'announcement' ? 'ประกาศ' : post.category === 'spoiler' ? 'สปอยล์' : 'อัปเดต'}
              </span>
            )}
            {post.targetMangaTitle && (
              <Link
                href={`/community/manga/${post.targetMangaId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold hover:bg-amber-500/20 smooth-hover shrink-0"
              >
                <MarqueeMangaTag title={post.targetMangaTitle!} maxWidth={100} />
              </Link>
            )}
          </div>

          {/* Title */}
          <Link href={`/community/p/${post.id}`} className="block group/link">
            <h3 className="font-bold text-white group-hover/link:text-indigo-400 smooth-hover text-sm leading-snug line-clamp-2">
              {post.title}
            </h3>
          </Link>

          {/* Action row */}
          <div className="flex items-center gap-3 mt-0.5">
            <VoteButtons
              targetType="post"
              targetId={post.id}
              initialUpvotes={post.upvotes}
              initialDownvotes={post.downvotes}
              initialUserVote={post.userVote}
            />
            <Link
              href={`/community/p/${post.id}#comments`}
              className="flex items-center gap-1 text-[10px] font-bold text-white/30 hover:text-white/60 smooth-hover"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {post.commentCount}
            </Link>
            {isSpoiler && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSpoilerRevealed(true); }}
                className={`text-[10px] font-bold text-amber-400 hover:text-amber-300 smooth-hover-fast ml-auto transition-opacity duration-500 ${spoilerRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                ดูสปอยล์
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  // ── NEW CARD LAYOUT (Almost square grid block, like Facebook post) ──
  return (
    <article className="bg-[--surface-raised] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 smooth-hover flex flex-col group p-5 min-h-[260px] shadow-lg">
      <header className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
          {post.authorPhotoUrl && (
            <Image
              src={post.authorPhotoUrl}
              alt={post.authorName || 'user'}
              width={40}
              height={40}
              className="object-cover"
              unoptimized={isSocialCdnUrl(post.authorPhotoUrl)}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <Link
            href={`/community/profile/${post.authorUid}`}
            onClick={(e) => e.stopPropagation()}
            className={`font-bold text-sm truncate smooth-hover hover:underline underline-offset-2 ${
              post.authorRole === 1 ? "text-indigo-400" :
              post.authorRole === 2 ? "text-orange-400" : "text-white/80"
            }`}
          >
            {post.authorName || 'Unknown User'}
            {post.authorRole > 0 && (
              <span className="ml-1.5 px-1 bg-white/10 rounded text-[9px] uppercase tracking-tighter text-white/70">
                {ROLE_LABEL[post.authorRole] ?? String(post.authorRole)}
              </span>
            )}
          </Link>
          <span className="text-[10px] text-white/40 font-medium">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: th })}
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        <Link href={`/community/p/${post.id}`} className="block group/link mb-3">
          <h3 className="text-lg font-black text-white mb-2 line-clamp-2 leading-tight tracking-tight group-hover/link:text-indigo-400 smooth-hover">
            {post.title}
          </h3>
          <div className="relative">
            <p
              className="text-white/50 text-sm line-clamp-3 leading-relaxed smooth-hover select-none"
              style={{ filter: isSpoiler && !spoilerRevealed ? 'blur(4px)' : 'blur(0px)', transition: 'filter 0.5s ease' }}
            >
              {post.content}
            </p>
            {isSpoiler && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSpoilerRevealed(true); }}
                className={`absolute inset-0 flex items-center justify-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 smooth-hover-fast transition-opacity duration-500 ${spoilerRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                คลิกเพื่อดูสปอยล์
              </button>
            )}
          </div>
        </Link>

        {post.imageUrls?.length > 0 && (
          <Link
            href={`/community/p/${post.id}`}
            className={`relative mb-3 rounded-xl overflow-hidden grid gap-1 ${
              post.imageUrls.length === 1 ? 'grid-cols-1' :
              post.imageUrls.length === 2 ? 'grid-cols-2' :
              'grid-cols-2'
            } ${isSpoiler && !spoilerRevealed ? 'pointer-events-none' : ''}`}
            style={{ filter: isSpoiler && !spoilerRevealed ? 'blur(4px)' : 'blur(0px)', transition: 'filter 0.5s ease' }}
          >
            {post.imageUrls.slice(0, 4).map((url, i) => (
              <div
                key={i}
                className={`relative overflow-hidden bg-white/5 ${
                  post.imageUrls.length === 1 ? 'aspect-video' : 'aspect-square'
                } ${post.imageUrls.length === 3 && i === 0 ? 'col-span-2' : ''}`}
              >
                <Image src={url} alt={`รูปที่ ${i + 1}`} fill loading="lazy" className="object-cover" unoptimized />
                {i === 3 && post.imageUrls.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-black text-xl">+{post.imageUrls.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </Link>
        )}

        {/* Tags area positioned at the bottom of the content area */}
        <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
          {post.category !== 'general' && (
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider smooth-hover border border-indigo-500/20">
              {post.category}
            </span>
          )}
          {post.targetMangaTitle && (
            <Link
              href={`/community/manga/${post.targetMangaId}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold hover:bg-amber-500/20 smooth-hover border border-amber-500/20"
            >
              {post.targetMangaCover && (
                <div className="w-3.5 h-3.5 rounded-sm overflow-hidden relative border border-amber-500/20 shrink-0">
                  <Image src={post.targetMangaCover} alt="manga" fill sizes="14px" className="object-cover" />
                </div>
              )}
              <MarqueeMangaTag title={post.targetMangaTitle!} maxWidth={140} />
            </Link>
          )}
        </div>
      </div>

      <footer className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
        <VoteButtons
          targetType="post"
          targetId={post.id}
          initialUpvotes={post.upvotes}
          initialDownvotes={post.downvotes}
          initialUserVote={post.userVote}
        />

        <div className="flex gap-2">
          <Link 
            href={`/community/p/${post.id}#comments`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white smooth-hover font-bold text-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentCount} <span className="hidden sm:inline">ความคิดเห็น</span>
          </Link>
        </div>
      </footer>
    </article>
  );
}
