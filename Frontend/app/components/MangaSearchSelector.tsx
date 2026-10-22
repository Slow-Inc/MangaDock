"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import Image from "next/image";
import { cacheOrFetch, TTL } from "../lib/apiCache";
import type { LandingBook } from "../lib/types";
import Loader from "./ui/Loader";
import { inputClass } from "./ui/Input";
import { usePopoverDismiss } from "../hooks/popoverDismiss";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  // Choosing swaps the input for the chip (and clearing swaps back), so the focused control unmounts; move focus
  // to its replacement once it renders (#874).
  const focusAfterSwap = useRef<"clear" | "input" | null>(null);
  const inputId = useId();
  const panelId = useId();

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

  const expanded = showDropdown && (query.length >= 2 || results.length > 0);

  // Outside click or Escape closes; Escape returns focus to the input (#874)
  usePopoverDismiss(showDropdown, containerRef, () => setShowDropdown(false));

  useEffect(() => {
    const target = focusAfterSwap.current === "clear" ? clearRef.current : focusAfterSwap.current === "input" ? inputRef.current : null;
    focusAfterSwap.current = null;
    target?.focus();
  }, [selectedManga]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <label htmlFor={inputId} className="block text-[10px] font-black text-ink-3 uppercase">แท็กมังงะ (เลือกได้ 1 เรื่อง)</label>
      </div>
      
      {selectedManga ? (
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-accent/40 bg-accent/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3.5 overflow-hidden">
            <div className="relative w-10 aspect-[2/3] shrink-0 rounded-lg overflow-hidden border border-line">
              <Image src={selectedManga.thumbnail} alt="" fill sizes="40px" className="object-cover" />
            </div>
            <div className="truncate">
              <p className="text-sm font-black text-ink truncate">{selectedManga.title}</p>
              <p className="text-[10px] text-ink-3 truncate font-bold uppercase">{selectedManga.authors[0] || "Unknown Artist"}</p>
            </div>
          </div>
          <button
            ref={clearRef}
            type="button"
            aria-label={`เอาแท็ก ${selectedManga.title} ออก`}
            onClick={() => {
              focusAfterSwap.current = "input";
              onSelect(null);
              setQuery("");
            }}
            className="p-1.5 rounded-full hover:bg-fill text-ink-2 hover:text-ink transition-all smooth-hover"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            // Opens on click or typing — not on focus, so focus returned here does not reopen the list (#874)
            onClick={() => setShowDropdown(true)}
            placeholder="พิมพ์ชื่อมังงะเพื่อแท็กในโพสต์..."
            className={inputClass}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {searching ? (
              <Loader context="inline" label="กำลังค้นหา" />
            ) : (
              <svg className="w-4.5 h-4.5 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth={2.5} />
                <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-4.35-4.35" />
              </svg>
            )}
          </div>

          {expanded && (
            <div id={panelId} className="absolute z-50 top-full mt-2 w-full bg-surface/95 border border-line rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              {results.length > 0 ? (
                <div className="p-1.5">
                  {results.map((manga) => (
                    <button
                      key={manga.id}
                      type="button"
                      onClick={() => {
                        focusAfterSwap.current = "clear";
                        onSelect(manga);
                        setShowDropdown(false);
                        setQuery("");
                      }}
                      className="w-full flex items-center gap-3.5 p-2 rounded-xl hover:bg-fill text-left transition-colors group"
                    >
                      <div className="relative w-8 aspect-[2/3] shrink-0 rounded-lg overflow-hidden bg-fill border border-line">
                        <Image src={manga.thumbnail} alt="" fill sizes="32px" className="object-cover" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-black text-ink group-hover:text-accent transition-colors truncate">{manga.title}</p>
                        <p className="text-[10px] text-ink-3 truncate font-medium uppercase">{manga.authors[0] || "Unknown"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : !searching ? (
                <div className="p-5 text-center text-xs text-ink-3 font-bold">ไม่พบมังงะที่ตรงกับ &ldquo;{query}&rdquo;</div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
