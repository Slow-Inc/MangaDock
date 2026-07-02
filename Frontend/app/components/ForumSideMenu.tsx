"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getTrendingManga, type TrendingManga } from "../lib/communityApi";
import type { LandingBook, ForumCategory } from "../lib/types";
import { CATEGORY_LIST } from "../lib/forumCategories";

interface ForumSideMenuProps {
  onMangaSelect: (mangaId: string | undefined) => void;
  selectedMangaId?: string;
  onCategorySelect: (cat: ForumCategory | undefined) => void;
  selectedCategory?: ForumCategory;
  onTrendingSelect?: () => void;
  isOnTrending?: boolean;
}

export default function ForumSideMenu({
  onMangaSelect,
  selectedMangaId,
  onCategorySelect,
  selectedCategory,
  onTrendingSelect,
  isOnTrending = false,
}: ForumSideMenuProps) {
  const router = useRouter();
  const [trending, setTrending] = useState<TrendingManga[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LandingBook[]>([]);
  const [searching, setSearching] = useState(false);

  const categoryMetadata = {
    general: {
      label: 'ทั่วไป',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    announcement: {
      label: 'ประกาศ',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
    },
    spoiler: {
      label: 'สปอยล์',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    manga_update: {
      label: 'อัปเดตมังงะ',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.582.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  } as const;

  const categories = CATEGORY_LIST.map(cat => ({
    id: cat,
    label: categoryMetadata[cat].label,
    icon: categoryMetadata[cat].icon,
  }));

  useEffect(() => {
    getTrendingManga(6) // Fetch 6 to detect if more exist beyond the 5 shown
      .then(setTrending)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/proxy/books/search?q=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) handleSearch(searchQuery);
      else setSearchResults([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  return (
    <aside className="space-y-8 w-full pb-10">
      {/* Sidebar Search - Premium Search Bar */}
      <div className="relative group px-1">
        <div className="absolute inset-0 bg-indigo-500/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาชุมชนมังงะ..."
          className="relative w-full bg-white/3 border border-white/10 rounded-2xl px-4 py-3 pl-11 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/5 transition-all shadow-xl backdrop-blur-xl smooth-hover"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-indigo-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Search Results Dropdown */}
        {searchQuery.length >= 2 && (
          <div className="absolute z-30 top-full mt-3 w-full bg-[#151518]/98 border border-white/10 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            {searching ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="p-1.5">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onMangaSelect(m.id);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-white/5 text-left transition-all group/item"
                  >
                    <div className="relative w-9 aspect-[2/3] shrink-0 rounded-lg overflow-hidden bg-white/5 border border-white/5 shadow-lg group-hover/item:border-indigo-500/30 transition-all">
                      <Image src={m.thumbnail} alt="" fill sizes="36px" className="object-cover" />
                    </div>
                    <p className="text-xs font-black text-white/80 group-hover/item:text-indigo-400 transition-colors truncate">{m.title}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-white/20 font-bold">ไม่พบมังงะที่คุณค้นหา</div>
            )}
          </div>
        )}
      </div>

      {/* 1. FEEDS SECTION */}
      <div>
        <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/25 mb-3">Feeds</h3>
        <div className="space-y-1">
          <button
            onClick={() => { onMangaSelect(undefined); onCategorySelect(undefined); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all smooth-hover ${
              !selectedMangaId && !selectedCategory && !isOnTrending
                ? "bg-white/5 text-indigo-400"
                : "text-white/50 hover:text-white hover:bg-white/2"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-sm font-bold tracking-tight">หน้าแรก</span>
          </button>
          
          <button
            onClick={onTrendingSelect}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all smooth-hover ${
              isOnTrending
                ? "bg-white/5 text-amber-400"
                : "text-white/50 hover:text-white hover:bg-white/2"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-sm font-bold tracking-tight">ยอดนิยม</span>
          </button>
        </div>
      </div>

      {/* 2. TOPICS SECTION */}
      <div>
        <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/25 mb-3">Topics</h3>
        <div className="space-y-0.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(selectedCategory === cat.id ? undefined : cat.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all smooth-hover group ${
                selectedCategory === cat.id 
                  ? "bg-white/5 text-indigo-400" 
                  : "text-white/50 hover:text-white hover:bg-white/2"
              }`}
            >
              <div className={`transition-colors ${selectedCategory === cat.id ? "text-indigo-400" : "text-white/30 group-hover:text-white/50"}`}>
                {cat.icon}
              </div>
              <span className="text-sm font-bold tracking-tight">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. POPULAR COMMUNITIES (Reddit-style Manga List) */}
      <div>
        <div className="flex items-center justify-between px-4 mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25">Communities</h3>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
        </div>

        <div className="space-y-0.5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-6 h-6 rounded-full bg-white/5 animate-pulse" />
                <div className="h-3 w-32 bg-white/5 rounded-full animate-pulse" />
              </div>
            ))
          ) : trending.slice(0, 5).map((item, index) => (
            <button
              key={item.mangaId}
              onClick={() => onMangaSelect(item.mangaId)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all smooth-hover group ${
                selectedMangaId === item.mangaId 
                  ? "bg-white/5 text-amber-400 shadow-sm" 
                  : "text-white/50 hover:text-white hover:bg-white/2"
              }`}
            >
              <div className="relative w-6 h-6 shrink-0 rounded-full overflow-hidden bg-white/5 border border-white/10 shadow-lg group-hover:border-white/20 transition-all">
                {item.mangaCover ? (
                  <Image src={item.mangaCover} alt="" fill sizes="24px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[6px] font-black text-white/20 uppercase">M</div>
                )}
                {/* Micro Rank */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-[8px] font-black text-amber-400">{index + 1}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate tracking-tight">{item.mangaTitle}</p>
              </div>
            </button>
          ))}
          
          {trending.length > 5 && (
            <button
              onClick={() => router.push("/community/trending")}
              className="w-full mt-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400/60 hover:text-indigo-400 hover:bg-indigo-500/5 rounded-xl transition-all text-center"
            >
              ดูทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* 4. GUIDELINES */}
      <div className="pt-6 border-t border-white/5">
        <div className="px-4 py-4 rounded-2xl bg-white/[0.01] border border-white/5">
           <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">กฎของชุมชน</h4>
           <ul className="space-y-2">
             {["เคารพซึ่งกันและกัน", "ไม่สปอย", "ไม่สแปม"].map((r, i) => (
               <li key={i} className="flex items-center gap-2 text-[10px] text-white/30 font-medium">
                 <div className="w-1 h-1 rounded-full bg-white/10" />
                 {r}
               </li>
             ))}
           </ul>
        </div>
      </div>
    </aside>
  );
}
