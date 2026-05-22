"use client";
import { useEffect, useRef, useState } from "react";
import TopTenCard from "./TopTenCard";
import type { LandingBook } from "../lib/types";

type TopTenRowProps = {
  books: LandingBook[];
};


export default function TopTenRow({ books }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoveredArrow, setHoveredArrow] = useState<"left" | "right" | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
  }, [books]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section
      className="relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <h2 className="mb-3 text-lg font-bold text-white sm:mb-4 sm:text-xl md:text-2xl">Top 10 หนังสือที่น่าอ่านวันนี้</h2>

      <div className="relative">
        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          onMouseEnter={() => setHoveredArrow("left")}
          onMouseLeave={() => setHoveredArrow(null)}
          className={`absolute left-2 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 md:flex ${
            hoveredArrow === "left" ? "h-11 w-11" : "h-9 w-9"
          } ${
            isHovering && canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label="เลื่อนซ้าย"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-5 w-5">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scroll("right")}
          onMouseEnter={() => setHoveredArrow("right")}
          onMouseLeave={() => setHoveredArrow(null)}
          className={`absolute right-2 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 md:flex ${
            hoveredArrow === "right" ? "h-11 w-11" : "h-9 w-9"
          } ${
            isHovering && canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label="เลื่อนขวา"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-5 w-5">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto overflow-y-visible pb-4 pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:pt-8 md:gap-4"
          onScroll={updateScrollState}
        >
          {books.map((book, index) => (
            <TopTenCard key={`${book.id}-${index}`} book={book} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
