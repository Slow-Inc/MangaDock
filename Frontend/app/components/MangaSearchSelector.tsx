"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { cacheOrFetch, TTL } from "../lib/apiCache";
import type { LandingBook } from "../lib/types";

interface MangaSearchSelectorProps {
  onSelect: (manga: LandingBook | null) => void;
  selectedManga: LandingBook | null;
}

export default function MangaSearchSelector({ onSelect, selectedManga }: MangaSearchSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LandingBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchManga = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const items = await cacheOrFetch<LandingBook[]>(
        // Distinct namespace from studioApi's `search:${query}` (which is
        // `search:` + arbitrary user text) — a studio search for the literal
        // "tag:foo" would otherwise collide with this key and cross-poison the
        // cache with a different response shape ({items,total} vs LandingBook[]).
        `tagsearch:${q}`,
        async () => {
          const res = await fetch(`/api/proxy/books/search?q=${encodeURIComponent(q)}&limit=5`);
          if (!res.ok) throw new Error("search failed");
          const data = await res.json();
          return data.items || [];
        },
        TTL.MEDIUM,
      );
      setResults(items);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) searchManga(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, searchManga]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">แท็กมังงะ (เลือกได้ 1 เรื่อง)</label>
      </div>
      
      {selectedManga ? (
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3.5 overflow-hidden">
            <div className="relative w-10 aspect-[2/3] shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-lg">
              <Image src={selectedManga.thumbnail} alt="" fill sizes="40px" className="object-cover" />
            </div>
            <div className="truncate">
              <p className="text-sm font-black text-white truncate tracking-tight">{selectedManga.title}</p>
              <p className="text-[10px] text-white/40 truncate font-bold uppercase tracking-wider">{selectedManga.authors[0] || "Unknown Artist"}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-all smooth-hover"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="พิมพ์ชื่อมังงะเพื่อแท็กในโพสต์..."
            className="w-full bg-white/3 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/5 transition-all shadow-xl smooth-hover"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {searching ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
            ) : (
              <svg className="w-4.5 h-4.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth={2.5} />
                <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-4.35-4.35" />
              </svg>
            )}
          </div>

          {showDropdown && (query.length >= 2 || results.length > 0) && (
            <div className="absolute z-50 top-full mt-2 w-full bg-[#151518]/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              {results.length > 0 ? (
                <div className="p-1.5">
                  {results.map((manga) => (
                    <button
                      key={manga.id}
                      onClick={() => {
                        onSelect(manga);
                        setShowDropdown(false);
                        setQuery("");
                      }}
                      className="w-full flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/5 text-left transition-colors group"
                    >
                      <div className="relative w-8 aspect-[2/3] shrink-0 rounded-lg overflow-hidden bg-white/5 border border-white/5 shadow-md">
                        <Image src={manga.thumbnail} alt="" fill sizes="32px" className="object-cover" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-black text-white group-hover:text-indigo-400 transition-colors truncate">{manga.title}</p>
                        <p className="text-[10px] text-white/40 truncate font-medium uppercase tracking-tighter">{manga.authors[0] || "Unknown"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : !searching ? (
                <div className="p-5 text-center text-xs text-white/20 font-bold">ไม่พบมังงะที่ตรงกับ "{query}"</div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
