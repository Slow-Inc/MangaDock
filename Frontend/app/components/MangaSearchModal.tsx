"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

interface MangaResult {
  id: string;
  title: string;
  coverUrl: string | null;
  description: string;
}

interface MangaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (manga: MangaResult) => void;
}

export default function MangaSearchModal({ isOpen, onClose, onSelect }: MangaSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MangaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      setTimeout(() => setVisible(false), 200);
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  const fetchResults = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(searchQuery)}&limit=10&includes[]=cover_art&order[relevance]=desc`);
      if (!res.ok) throw new Error("ไม่สามารถค้นหาข้อมูลได้");
      const data = await res.json();
      
      const mapped: MangaResult[] = data.data.map((m: any) => {
        const titleRaw = m.attributes.title;
        const title = titleRaw.th || titleRaw.en || titleRaw.ja || titleRaw['ja-ro'] || Object.values(titleRaw)[0] || "No Title";
        
        const descRaw = m.attributes.description;
        const description = descRaw.th || descRaw.en || "";

        const coverRel = m.relationships.find((r: any) => r.type === "cover_art");
        const coverFileName = coverRel?.attributes?.fileName;
        const coverUrl = coverFileName ? `https://uploads.mangadex.org/covers/${m.id}/${coverFileName}.256.jpg` : null;

        return {
          id: m.id,
          title,
          description,
          coverUrl
        };
      });
      setResults(mapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchResults(query);
    }, 500);
  }, [query]);

  if (!isOpen && !visible) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className={`flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl transition-transform duration-200 ${isOpen ? "scale-100" : "scale-95"}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold text-white">ค้นหามังงะจาก MangaDex</h2>
          <button onClick={onClose} className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-white/5 bg-black/20">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="พิมพ์ชื่อมังงะ..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none transition focus:border-indigo-500/50 focus:bg-white/10"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex justify-center p-8 text-white/50">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
          {!loading && error && (
            <div className="p-8 text-center text-red-400 text-sm">{error}</div>
          )}
          {!loading && !error && query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-white/40 text-sm">ไม่พบเรื่องที่ค้นหา</div>
          )}
          {!loading && !error && results.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {results.map((manga) => (
                <button
                  key={manga.id}
                  onClick={() => {
                    onSelect(manga);
                    onClose();
                  }}
                  className="flex items-center gap-4 rounded-xl p-2 text-left transition hover:bg-white/5"
                >
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-white/5">
                    {manga.coverUrl ? (
                      <Image
                        src={manga.coverUrl}
                        alt="cover"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-white/20">No Cover</div>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="truncate font-semibold text-white/90 text-sm">{manga.title}</h3>
                    {manga.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-white/50 leading-relaxed">
                        {manga.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}