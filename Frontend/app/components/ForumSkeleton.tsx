"use client";

/**
 * Skeleton loading for forum posts.
 */
export function PostSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden flex animate-pulse">
      <div className="hidden sm:flex flex-col items-center p-3 bg-white/2 border-r border-white/5 w-14 gap-2">
        <div className="w-6 h-6 rounded-full bg-white/10" />
        <div className="w-4 h-4 rounded bg-white/10" />
        <div className="w-6 h-6 rounded-full bg-white/10" />
      </div>
      <div className="flex-1 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white/10" />
          <div className="w-24 h-3 rounded bg-white/10" />
          <div className="w-12 h-3 rounded bg-white/10" />
        </div>
        <div className="space-y-2">
          <div className="w-3/4 h-5 rounded bg-white/15" />
          <div className="w-full h-3 rounded bg-white/10" />
          <div className="w-full h-3 rounded bg-white/10" />
          <div className="w-1/2 h-3 rounded bg-white/10" />
        </div>
        <div className="flex gap-4">
          <div className="w-24 h-8 rounded-lg bg-white/5" />
          <div className="w-16 h-8 rounded-lg bg-white/5" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loading for forum comments.
 */
export function CommentSkeleton() {
  return (
    <div className="mt-4 flex gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-20 h-3 rounded bg-white/15" />
          <div className="w-16 h-3 rounded bg-white/10" />
        </div>
        <div className="w-full h-4 rounded bg-white/10" />
        <div className="w-2/3 h-4 rounded bg-white/10" />
        <div className="flex gap-4 pt-1">
          <div className="w-16 h-6 rounded-full bg-white/5" />
          <div className="w-12 h-4 rounded bg-white/5 mt-1" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full page skeleton for post details.
 */
export function PostDetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="w-20 h-6 rounded bg-white/10 mb-6" />
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden h-64 flex">
        <div className="hidden sm:flex flex-col items-center p-4 bg-white/2 border-r border-white/5 w-16 gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="w-4 h-4 rounded bg-white/10" />
          <div className="w-8 h-8 rounded-full bg-white/10" />
        </div>
        <div className="p-8 flex-1 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white/10" />
            <div className="w-32 h-4 rounded bg-white/10" />
          </div>
          <div className="w-3/4 h-8 rounded bg-white/20" />
          <div className="space-y-3">
            <div className="w-full h-4 rounded bg-white/10" />
            <div className="w-full h-4 rounded bg-white/10" />
            <div className="w-1/2 h-4 rounded bg-white/10" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="w-32 h-6 rounded bg-white/15 mb-6" />
        <CommentSkeleton />
        <CommentSkeleton />
      </div>
    </div>
  );
}
