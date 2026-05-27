"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { COUNTRIES } from "../lib/countries";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CountrySelect({ value, onChange, placeholder = "ค้นหาหรือเลือกประเทศ..." }: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [renderPanel, setRenderPanel] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const openFrameRef = useRef<number | null>(null);

  // Initialize search with current label if found
  useEffect(() => {
    if (!isOpen) {
      const current = COUNTRIES.find(c => c.label === value || c.code === value);
      setSearch(current ? current.label : value);
    }
  }, [value, isOpen]);

  const filtered = COUNTRIES.filter(c => 
    c.label.toLowerCase().includes(search.toLowerCase()) || 
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const checkFlip = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 320; // matches max-h-80
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < dropdownHeight + 12);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync renderPanel with isOpen for exit transitions — EXACT logic from StudioSelect
  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setRenderPanel(true);
    } else if (renderPanel) {
      closeTimerRef.current = window.setTimeout(() => {
        setRenderPanel(false);
        closeTimerRef.current = null;
      }, 200);
    }
  }, [isOpen, renderPanel]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (openFrameRef.current) window.cancelAnimationFrame(openFrameRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) {
              checkFlip();
              setRenderPanel(true);
              openFrameRef.current = window.requestAnimationFrame(() => {
                setIsOpen(true);
                openFrameRef.current = null;
              });
            }
          }}
          onFocus={() => {
            if (!isOpen) {
              checkFlip();
              setRenderPanel(true);
              openFrameRef.current = window.requestAnimationFrame(() => {
                setIsOpen(true);
                openFrameRef.current = null;
              });
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
            isOpen
              ? "border-white/20 bg-white/12 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.75)] ring-1 ring-white/8 backdrop-blur-xl"
              : "border-white/10 bg-white/5 text-white placeholder-white/30 hover:border-white/20 hover:bg-white/8 hover:text-white"
          }`}
        />
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {renderPanel && (
        <div
          ref={listRef}
          className={`absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-white/15 bg-black/70 shadow-2xl shadow-black/45 ring-1 ring-white/6 backdrop-blur-md transition-all duration-200 ease-in-out ${
            dropUp ? "bottom-full mb-1.5 origin-bottom-left" : "top-full mt-1.5 origin-top-left"
          } ${
            isOpen
              ? "pointer-events-auto scale-100 opacity-100 translate-y-0"
              : dropUp
                ? "pointer-events-none scale-95 opacity-0 translate-y-2"
                : "pointer-events-none scale-95 opacity-0 -translate-y-2"
          }`}
        >
          <div className="custom-scrollbar max-h-80 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((country) => {
                const isSelected = value === country.label || value === country.code;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      onChange(country.label);
                      setSearch(country.label);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-sm transition hover:bg-white/10 ${
                      isSelected ? "text-indigo-400" : "text-white/70 hover:text-white"
                    }`}
                  >
                    <span>{country.label}</span>
                    {isSelected ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-xs text-white/30">
                ไม่พบข้อมูลประเทศ "{search}"
                <button 
                  type="button"
                  onClick={() => {
                    onChange(search);
                    setIsOpen(false);
                  }}
                  className="block mx-auto mt-2 text-indigo-400 font-bold hover:underline"
                >
                  ใช้ค่านี้แทน
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
