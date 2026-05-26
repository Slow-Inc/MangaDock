"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import BookDetailModal from "./BookDetailModal";
import HeroDescription from "./HeroDescription";
import HeroDetailButton from "./HeroDetailButton";
import type { LandingBook } from "../lib/types";
import { resolvedThumbnail } from "../lib/imgUrl";

type Props = { books: LandingBook[] };

function splitTitle(book: LandingBook): [string, string] {
  const parts = book.title.split(/[:\-]/).map((p) => p.trim()).filter(Boolean);
  return [parts[0] ?? book.title, parts[1] ?? book.subtitle ?? ""];
}

const ROTATION_MS = 5000;
const FADE_MS = 300;

// ─── Liquid pill indicator ────────────────────────────────────────────────────
type DotsProps = {
  total: number;
  idx: number;
  desktop: boolean;
  onDotClick: (i: number) => void;
};

function Dots({ total, idx, desktop, onDotClick }: DotsProps) {
  const pillRef = useRef<HTMLDivElement>(null);
  const dotEls = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdxRef = useRef(idx);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const fromIdx = prevIdxRef.current;
    prevIdxRef.current = idx;

    const pill = pillRef.current;
    const prevDot = dotEls.current[fromIdx];
    const nextDot = dotEls.current[idx];
    if (!pill || !prevDot || !nextDot) return;

    const container = pill.parentElement;
    if (!container) return;

    const cLeft = container.getBoundingClientRect().left;
    const pR = prevDot.getBoundingClientRect();
    const nR = nextDot.getBoundingClientRect();

    const prevLeft = pR.left - cLeft;
    const nextLeft = nR.left - cLeft;
    const goingRight = nR.left >= pR.left;
    // stretch spans from the leading edge of whichever dot is earlier to the
    // trailing edge of whichever dot is later
    const stretchLeft = goingRight ? prevLeft : nextLeft;
    const stretchWidth = goingRight ? nR.right - pR.left : pR.right - nR.left;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Snap pill to "from" position with no transition
    pill.style.setProperty('transition', 'none');
    pill.style.setProperty('left', `${prevLeft}px`);
    pill.style.setProperty('width', `${pR.width}px`);

    // Double rAF flushes the 'none' transition before new one starts
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Phase 1: stretch toward target
        pill.style.setProperty('transition', 'left 200ms ease-out, width 200ms ease-out');
        pill.style.setProperty('left', `${stretchLeft}px`);
        pill.style.setProperty('width', `${stretchWidth}px`);

        timerRef.current = setTimeout(() => {
          // Phase 2: retract onto target dot
          pill.style.setProperty('transition', 'left 160ms ease-in-out, width 160ms ease-in-out');
          pill.style.setProperty('left', `${nextLeft}px`);
          pill.style.setProperty('width', `${nR.width}px`);
        }, 200);
      });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idx]);

  return (
    <div
      className={`relative flex items-center gap-1.5 ${
        desktop ? 'mt-8 justify-start' : 'mt-3 justify-center'
      }`}
    >
      <div ref={pillRef} className="pointer-events-none absolute h-2 rounded-full bg-white" />
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          ref={(el) => { dotEls.current[i] = el; }}
          onClick={() => onDotClick(i)}
          className="h-2 w-2 rounded-full bg-white/25 transition-colors duration-300 hover:bg-white/50"
          aria-label={`สลับไปรายการที่ ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function HeroCarousel({ books }: { books: LandingBook[] }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [mobileDlOpen, setMobileDlOpen] = useState(false);
  const pausedRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);
  const total = books.length;

  const advance = useCallback((toIdx: number, byUser = false) => {
    if (byUser) {
      pausedRef.current = true;
      setTimeout(() => { pausedRef.current = false; }, ROTATION_MS);
    }
    setVisible(false);
    setTimeout(() => {
      setIdx(toIdx);
      setVisible(true);
    }, FADE_MS);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
    didSwipeRef.current = false;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeStartRef.current || total <= 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      didSwipeRef.current = true;
      advance(dx < 0 ? (idx + 1) % total : (idx - 1 + total) % total, true);
    }
  }, [advance, idx, total]);

  const handleMobileTap = useCallback(() => {
    if (didSwipeRef.current) return;
    setMobileDlOpen(true);
  }, []);

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => {
      if (!pausedRef.current) {
        setVisible(false);
        setTimeout(() => {
          setIdx((i) => (i + 1) % total);
          setVisible(true);
        }, FADE_MS);
      }
    }, ROTATION_MS);
    return () => clearInterval(t);
  }, [total]);

  const book = books[idx];
  const resolvedUrl = resolvedThumbnail(book);
  const [imgUrl, setImgUrl] = useState(resolvedUrl);
  const [imgFellBack, setImgFellBack] = useState(false);
  useEffect(() => { setImgUrl(resolvedUrl); setImgFellBack(false); }, [resolvedUrl]);
  const handleImgError = () => {
    if (!imgFellBack && book.thumbnail) {
      setImgFellBack(true);
      setImgUrl(book.thumbnail.includes("mangadex.org")
        ? `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`
        : book.thumbnail);
    }
  };
  const [titleMain, titleSub] = splitTitle(book);

  return (
    <>
      {/* ─── Mobile ─── */}
      <section className="relative px-4 pb-2 pt-20 md:hidden">
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          type="button"
          onClick={handleMobileTap}
          aria-label={`ดูรายละเอียด ${book.title}`}
          className="group relative mx-auto block aspect-2/3 w-full max-w-[88%] overflow-hidden rounded-2xl text-left shadow-2xl"
        >
          <div className={`absolute inset-0 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
            {book.thumbnailCached === false ? (
              <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent" />
            ) : (
              <Image
                src={imgUrl}
                alt={book.title}
                fill
                priority={idx === 0}
                sizes="88vw"
                className="object-cover object-center transition duration-300 group-active:scale-[0.985]"
                onError={handleImgError}
              />
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/90 via-black/50 to-transparent" />
          <div className={`absolute inset-x-0 bottom-0 p-5 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
            <h1 className="text-2xl font-black leading-tight text-white drop-shadow-lg">{titleMain}</h1>
            {titleSub && (
              <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-white/80 drop-shadow-lg">
                {titleSub}
              </p>
            )}
          </div>
        </button>

        <div className={`mt-3 flex flex-wrap items-center justify-center gap-x-1 text-xs text-white/70 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
          {(book.categories.length > 0 ? book.categories : ["E-Book"]).slice(0, 4).map((cat, i) => (
            <span key={cat} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/30">•</span>}
              {cat}
            </span>
          ))}
        </div>

        {total > 1 && <Dots total={total} idx={idx} desktop={false} onDotClick={(i) => advance(i, true)} />}
        </div>
      </section>

      {/* ─── Desktop ─── */}
      <section
        className="relative hidden w-full overflow-hidden pb-12 pt-28 md:block lg:pb-16 lg:pt-32"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
      >
        {/* Blurred background */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
          {book.thumbnailCached !== false && (
            <Image
              src={imgUrl}
              alt=""
              fill
              priority={idx === 0}
              sizes="100vw"
              aria-hidden
              className="scale-110 object-cover object-center blur-2xl brightness-[0.25] saturate-150"
              onError={handleImgError}
            />
          )}
        </div>
        <div className="absolute inset-0 bg-linear-to-b from-background/60 via-background/40 to-background" />

        {/* Two-panel card */}
        <div className="relative z-10 mx-auto flex h-96 max-w-5xl gap-8 px-8 lg:h-108 lg:gap-12 lg:px-12 xl:h-120 xl:max-w-6xl">
          {/* Poster */}
          <div className="relative aspect-2/3 w-64 shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 lg:w-72 xl:w-80">
            <div className={`absolute inset-0 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
              {book.thumbnailCached === false ? (
                <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent" />
              ) : (
                <Image
                  src={imgUrl}
                  alt={book.title}
                  fill
                  priority={idx === 0}
                  sizes="320px"
                  className="object-cover object-center"
                  onError={handleImgError}
                />
              )}
            </div>
          </div>

          {/* Info */}
          <div className={`flex min-w-0 flex-1 flex-col justify-center overflow-hidden py-4 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
            <p className="mb-3 text-xs font-semibold tracking-[0.32em] text-red-400">Top 10 หนังสือที่น่าอ่านวันนี้</p>
            <h1 className="text-4xl font-black uppercase leading-tight text-white lg:text-5xl xl:text-6xl">
              {titleMain}
            </h1>
            {titleSub && (
              <p className="mt-2 text-lg font-semibold uppercase tracking-[0.16em] text-white/80 lg:text-xl">
                {titleSub}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              {(book.categories.length > 0 ? book.categories : ["E-Book"]).slice(0, 5).map((cat) => (
                <span key={cat} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
                  {cat}
                </span>
              ))}
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
                {book.publishedDate || "ปีที่ไม่ระบุ"}
              </span>
            </div>
            <div className="mt-5">
              <HeroDescription key={book.id} description={book.description ?? ""} />
            </div>
            <div className="mt-7">
              <HeroDetailButton key={book.id} book={book} />
            </div>
            {total > 1 && <Dots total={total} idx={idx} desktop={true} onDotClick={(i) => advance(i, true)} />}
          </div>
        </div>
      </section>

      {mobileDlOpen && (
        <BookDetailModal book={book} onClose={() => setMobileDlOpen(false)} />
      )}
    </>
  );
}
