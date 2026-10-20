"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { COUNTRIES } from "../lib/countries";
import { useModalTransition } from "../../hooks/useModalTransition";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CountrySelect({ value, onChange, placeholder = "ค้นหาหรือเลือกประเทศ..." }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const { mounted: renderPanel, visible: isOpen } = useModalTransition(open, { duration: 200 });
  const [dropUp, setDropUp] = useState(false);

  const labelForValue = useCallback((v: string) => {
    const current = COUNTRIES.find(c => c.label === v || c.code === v);
    return current ? current.label : v;
  }, []);

  const [search, setSearch] = useState(() => labelForValue(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = COUNTRIES.filter(c => 
    c.label.toLowerCase().includes(search.toLowerCase()) || 
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const checkFlip = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < dropdownHeight + 12);
  }, []);

  const openDropdown = useCallback(() => {
    checkFlip();
    setOpen(true);
  }, [checkFlip]);

  const closeDropdown = useCallback((label?: string) => {
    setSearch(label ?? labelForValue(value));
    setOpen(false);
  }, [labelForValue, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) openDropdown();
          }}
          onFocus={() => {
            if (!isOpen) openDropdown();
          }}
          placeholder={placeholder}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
            isOpen
              ? "border-ink-3 bg-raised text-ink ring-1 ring-line"
              : "border-line bg-fill text-ink placeholder-ink-3 hover:border-ink-3 hover:bg-raised hover:text-ink"
          }`}
        />
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {renderPanel && (
        <div
          ref={listRef}
          className={`absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_40px_-16px_rgb(0_0_0/.3)] transition-all duration-200 ease-in-out ${
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
                      closeDropdown(country.label);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-sm transition hover:bg-fill ${
                      isSelected ? "text-accent" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <span>{country.label}</span>
                    {isSelected ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-xs text-ink-3">
                ไม่พบข้อมูลประเทศ &ldquo;{search}&rdquo;
                <button
                  type="button"
                  onClick={() => {
                    onChange(search);
                    closeDropdown(search);
                  }}
                  className="block mx-auto mt-2 text-accent font-bold hover:underline"
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
