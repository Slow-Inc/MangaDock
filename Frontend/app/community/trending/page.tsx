"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getTrendingManga, type TrendingManga } from "../../lib/communityApi";
import { useToast } from "../../contexts/ToastContext";
import { cacheGet, cacheSet, TTL } from "../../lib/apiCache";

function TrendingMangaCard({ item, rank }: { item: TrendingManga; rank: number }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/community/manga/${item.mangaId}`)}
      className="block group text-left w-full"
    >
      <div className="rounded-2xl overflow-hidden bg-[#1a1a1a] border border-white/5 smooth-hover hover:border-white/15 hover:shadow-2xl transition-all">
        {/* Cover */}
        <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#141414]">
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
              <svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.582.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/90 via-transparent to-transparent" />
          {/* Rank badge */}
          <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center">
            <span className={`text-[10px] font-black ${rank <= 3 ? "text-amber-400" : "text-white/50"}`}>
              {rank}
            </span>
          </div>
          {/* Post count badge */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
            <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-[10px] font-black text-white/70">{item.postCount}</span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-sm font-black text-white leading-snug line-clamp-2 group-hover:text-amber-400 transition-colors tracking-tight">
            {item.mangaTitle}
          </h3>
          <p className="mt-1.5 text-[10px] font-bold text-white/30 uppercase tracking-wider">
            {item.postCount} โพสต์
          </p>
        </div>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-[#1a1a1a] border border-white/5">
      <div className="w-full aspect-[2/3] bg-white/5 animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-3.5 bg-white/5 rounded-full animate-pulse w-4/5" />
        <div className="h-2.5 bg-white/5 rounded-full animate-pulse w-1/3" />
      </div>
    </div>
  );
}

export default function TrendingPage() {
  const [trending, setTrending] = useState<TrendingManga[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const cached = cacheGet<TrendingManga[]>("community:trending");
    if (cached) { setTrending(cached); setLoading(false); return; }

    let mounted = true;
    setLoading(true);

    getTrendingManga(20)
      .then((items) => {
        if (!mounted) return;
        cacheSet("community:trending", items, TTL.MEDIUM);
        setTrending(items);
      })
      .catch(() => {
        if (!mounted) return;
        showToast({ type: "error", message: "โหลดมังงะ trending ไม่สำเร็จ", duration: 4000 });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [showToast]);

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-1 tracking-tight">ยอดนิยม</h1>
          <p className="text-white/40 text-sm font-medium">มังงะที่มีการพูดคุยมากที่สุดในชุมชน</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 self-start sm:self-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Trending</span>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : trending.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {trending.map((item, i) => (
            <TrendingMangaCard key={item.mangaId} item={item} rank={i + 1} />
          ))}
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-dashed border-white/10 rounded-2xl py-20 text-center">
          <p className="text-white/40 font-medium">ยังไม่มีมังงะที่กำลังเป็นที่นิยม</p>
        </div>
      )}
    </div>
  );
}
