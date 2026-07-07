"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalLenis } from "../../hooks/useLocalLenis";
import { useModalTransition } from "../../hooks/useModalTransition";

export type StudioSelectOption = {
  value: string;
  label: string;
};

export function StudioSelect({
  value,
  onChange,
  options,
  placeholder = "-- เลือก --",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: StudioSelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [wantOpen, setWantOpen] = useState(false);
  const { mounted: renderPanel, visible: open } = useModalTransition(wantOpen, { duration: 200 });
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useLocalLenis(listRef as React.RefObject<HTMLElement | null>, "vertical", open && !disabled);

  const checkFlip = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(320, Math.max(200, options.length * 44));
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < dropdownHeight + 12);
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setWantOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => checkFlip();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    updatePosition();

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, checkFlip]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setWantOpen(false);
            return;
          }
          checkFlip();
          setWantOpen(true);
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
          disabled
            ? "cursor-not-allowed border-white/8 bg-white/[0.04] text-white/25"
            : open
              ? "border-white/20 bg-white/12 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.75)] ring-1 ring-white/8 backdrop-blur-xl"
              : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/8 hover:text-white"
        }`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {renderPanel && (
        <div
          className={`absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-white/15 bg-black/70 shadow-2xl shadow-black/45 ring-1 ring-white/6 backdrop-blur-md transition-all duration-200 ease-in-out ${
            dropUp ? "bottom-full mb-1.5 origin-bottom-left" : "top-full mt-1.5 origin-top-left"
          } ${
            open
              ? "pointer-events-auto scale-100 opacity-100 translate-y-0"
              : dropUp
                ? "pointer-events-none scale-95 opacity-0 translate-y-2"
                : "pointer-events-none scale-95 opacity-0 -translate-y-2"
          }`}
        >
          <ul ref={listRef} className="custom-scrollbar max-h-80 overflow-y-auto py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setWantOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-sm transition hover:bg-white/10 ${
                      isSelected ? "text-indigo-400" : "text-white/70 hover:text-white"
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
