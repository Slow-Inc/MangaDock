"use client";

import React from "react";

export function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />;
}

export function StudioOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/2 p-5 space-y-3">
            <SkeletonPulse className="h-3 w-20" />
            <SkeletonPulse className="h-8 w-16" />
            <SkeletonPulse className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        {/* Insight Stats Grid */}
        <div className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-4">
          <SkeletonPulse className="h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/2 p-4 space-y-2">
                <SkeletonPulse className="h-3 w-16" />
                <SkeletonPulse className="h-6 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Skeleton */}
        <div className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-4">
          <SkeletonPulse className="h-4 w-24" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-white/5 rounded-xl">
                <SkeletonPulse className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonPulse className="h-3 w-24" />
                  <SkeletonPulse className="h-2 w-32" />
                </div>
                <SkeletonPulse className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Skeleton Row */}
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/2 p-6 h-64 flex flex-col gap-4">
            <SkeletonPulse className="h-4 w-40" />
            <SkeletonPulse className="flex-1 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudioWorksSkeleton({ viewMode }: { viewMode: "list" | "card" }) {
  if (viewMode === "list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-white/10 bg-white/3 p-4">
            <SkeletonPulse className="h-24 w-16 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-3 pt-1">
              <SkeletonPulse className="h-4 w-1/2" />
              <SkeletonPulse className="h-3 w-20" />
              <div className="flex gap-1.5 pt-1">
                <SkeletonPulse className="h-4 w-20 rounded-full" />
                <SkeletonPulse className="h-4 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <SkeletonPulse className="aspect-[2/3] w-full rounded-xl" />
          <div className="px-0.5 space-y-2">
            <SkeletonPulse className="h-3 w-full" />
            <SkeletonPulse className="h-2 w-1/2 opacity-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudioChaptersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/5 bg-white/2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SkeletonPulse className="h-4 w-24" />
            <SkeletonPulse className="h-4 w-20 rounded-full" />
          </div>
          <div className="space-y-3 pl-4 border-l border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SkeletonPulse className="h-4 w-16" />
                <SkeletonPulse className="h-3 w-20" />
              </div>
              <div className="flex gap-2">
                <SkeletonPulse className="h-7 w-16 rounded-lg" />
                <SkeletonPulse className="h-7 w-16 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudioWalletSkeleton() {
  return (
    <div className="space-y-6">
      {/* Wallet Summary */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/2 p-5 space-y-3">
            <SkeletonPulse className="h-3 w-20" />
            <SkeletonPulse className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-2xl border border-white/5 bg-white/2 p-6 h-64">
          <SkeletonPulse className="h-4 w-32 mb-4" />
          <SkeletonPulse className="h-full w-full opacity-50" />
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/2 p-6 h-64">
          <SkeletonPulse className="h-4 w-32 mb-4" />
          <SkeletonPulse className="h-full w-full opacity-50" />
        </div>
      </div>

      {/* Transaction List */}
      <div className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-4">
        <SkeletonPulse className="h-4 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
              <SkeletonPulse className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <SkeletonPulse className="h-3 w-32" />
                <SkeletonPulse className="h-2 w-24" />
              </div>
              <div className="text-right space-y-2">
                <SkeletonPulse className="h-4 w-12 ml-auto" />
                <SkeletonPulse className="h-2 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StudioAccountSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
        <div className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <SkeletonPulse className="h-24 w-24 rounded-full" />
            <SkeletonPulse className="h-4 w-32" />
          </div>
          <div className="space-y-4 pt-4 border-t border-white/5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonPulse className="h-3 w-16" />
                <SkeletonPulse className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-4">
          <SkeletonPulse className="h-4 w-40" />
          <SkeletonPulse className="h-32 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
             <SkeletonPulse className="h-24 w-full" />
             <SkeletonPulse className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
