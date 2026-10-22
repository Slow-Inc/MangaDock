"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getTrendingManga, type TrendingManga } from "../../lib/communityApi";
import { cacheGet, cacheSet, TTL } from "../../lib/apiCache";
import Mascot from "../../components/mascot/Mascot";
import { usePageTitle } from "../../hooks/pageTitle";
import LoadError from "../../components/ui/LoadError";

function TrendingMangaCard({ item, rank }: { item: TrendingManga; rank: number }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/community/manga/${item.mangaId}`)}
      className="block group text-left w-full"
    >
      <div className="rounded-2xl overflow-hidden bg-surface border border-line smooth-hover hover:border-ink-3 hover:shadow-2xl transition-all">
        {/* Cover */}
        <div className="relative w-full aspect-[2/3] overflow-hidden bg-surface">
          {item.mangaCover ? (
            <Image
              src={item.mangaCover}
              alt={item.mangaTitle}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-10 h-10 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.582.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent" />
          {/* Rank badge */}
          <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-bg/80 border border-line flex items-center justify-center">
            <span className={`text-[10px] font-black ${rank <= 3 ? "text-accent" : "text-ink-2"}`}>
              {rank}
            </span>
          </div>
          {/* Post count badge */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-bg/80 border border-line">
            <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-[10px] font-black text-ink-2">{item.postCount}</span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-sm font-black text-ink leading-snug line-clamp-2 group-hover:text-accent transition-colors">
            {item.mangaTitle}
          </h3>
          <p className="mt-1.5 text-[10px] font-bold text-ink-3 uppercase">
            {item.postCount} โพสต์
          </p>
        </div>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-surface border border-line">
      <div className="w-full aspect-[2/3] bg-fill animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-3.5 bg-fill rounded-full animate-pulse w-4/5" />
        <div className="h-2.5 bg-fill rounded-full animate-pulse w-1/3" />
      </div>
    </div>
  );
}

export default function TrendingPage() {
  usePageTitle("ยอดนิยม · คอมมูนิตี้");
  const [trending, setTrending] = useState<TrendingManga[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false); // shown with a retry, not as "nothing trending" (#911)
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const cached = cacheGet<TrendingManga[]>("community:trending");
    if (cached) { setTrending(cached); setLoading(false); return; }

    let mounted = true;
    setLoading(true);
    setLoadFailed(false);

    getTrendingManga(20)
      .then((items) => {
        if (!mounted) return;
        cacheSet("community:trending", items, TTL.MEDIUM);
        setTrending(items);
      })
      .catch(() => {
        if (mounted) setLoadFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [retry]);

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-ink mb-1">ยอดนิยม</h1>
          <p className="text-ink-3 text-sm font-medium">มังงะที่มีการพูดคุยมากที่สุดในชุมชน</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 self-start sm:self-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-black text-accent uppercase tracking-wider">Trending</span>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : loadFailed ? (
        <LoadError what="มังงะที่กำลังเป็นที่นิยม" area="community" onRetry={() => setRetry((n) => n + 1)} />
      ) : trending.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {trending.map((item, i) => (
            <TrendingMangaCard key={item.mangaId} item={item} rank={i + 1} />
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-dashed border-line rounded-2xl py-16 text-center space-y-3">
          <div className="flex justify-center">
            <Mascot area="community" size={88} />
          </div>
          <p className="text-ink-3 font-medium">ยังไม่มีมังงะที่กำลังเป็นที่นิยม</p>
        </div>
      )}
    </div>
  );
}
