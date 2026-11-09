"use client";

/**
 * A forum post's images at full size (#1094): opens on the image that was clicked; previous/next by the arrow
 * buttons (shown on hover and keyboard focus), ← / →, or a swipe on touch screens (IG-style — the image follows the
 * finger, the ends resist, no wrap). Escape or a click on the backdrop closes it, and focus goes back to the image
 * that opened it (useModalDialog).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import PostImage from "./PostImage";
import { useModalTransition } from "../hooks/useModalTransition";
import { ownsKeyboardNow, useModalDialog } from "../hooks/useDialogFocus";
import { useReducedMotion } from "../hooks/reducedMotion";
import { dragOffset, stepIndex, swipeTarget } from "../lib/imageViewer";

export default function PostImageViewer({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const count = urls.length;
  const [index, setIndex] = useState(start);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  const { visible, close } = useModalTransition(true, { duration: 250, onClosed: onClose });
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useModalDialog(rootRef, close);

  const go = useCallback((delta: number) => setIndex((i) => stepIndex(i, delta, count)), [count]);

  // An arrow is removed at its end of the row; if it held focus, hand focus to the other one instead of <body>
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (document.activeElement !== document.body) return;
    if (index === count - 1) prevRef.current?.focus();
    else if (index === 0) nextRef.current?.focus();
  }, [index, count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || !ownsKeyboardNow(rootRef.current)) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Swipe (touch and pen; a mouse uses the arrows). A mostly-vertical gesture is not a swipe.
  const gesture = useRef<{ x: number; y: number; t: number; horizontal: boolean | null } | null>(null);
  const justSwiped = useRef(false); // the click that ends a swipe must not close the viewer
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || count < 2) return;
    gesture.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, horizontal: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.horizontal === null && Math.hypot(dx, dy) > 8) {
      g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (g.horizontal) { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); }
    }
    if (g.horizontal) setDrag(dragOffset(dx, index, count));
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.horizontal) return;
    justSwiped.current = true;
    const dx = e.clientX - g.x;
    const velocity = dx / Math.max(1, e.timeStamp - g.t);
    const width = trackRef.current?.clientWidth ?? window.innerWidth;
    setIndex((i) => swipeTarget({ dx, width, velocity, index: i, count }));
    setDrag(0);
    setDragging(false);
  };

  const arrow = "absolute top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-bg/70 text-ink shadow-lg ring-1 ring-line backdrop-blur-sm transition-opacity hover:bg-bg/90 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden";

  const content = (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={count > 1 ? `รูปภาพในโพสต์ (${count} รูป)` : "รูปภาพในโพสต์"}
      className={`group fixed inset-0 z-300 outline-none transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="absolute inset-0 bg-scrim/90" onClick={close} />

      <button
        type="button"
        onClick={close}
        aria-label="ปิด"
        className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-fill text-ink-2 backdrop-blur-sm transition hover:bg-raised hover:text-ink"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {count > 1 && (
        <p aria-live="polite" className="absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-full bg-bg/70 px-3 py-1 text-xs font-semibold tabular-nums text-ink-2 backdrop-blur-sm">
          {index + 1} / {count}
        </p>
      )}

      {/* The track: one full-screen slide per image, moved by index and by the finger while swiping */}
      <div
        ref={trackRef}
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: count > 1 ? "pan-y" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
            transition: dragging || reduced ? "none" : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {urls.map((url, i) => (
            <div
              key={i}
              className="relative flex h-full w-full shrink-0 items-center justify-center px-4 py-16 sm:px-20"
              onClick={(e) => {
                if (justSwiped.current) { justSwiped.current = false; return; }
                if (e.target === e.currentTarget) close();
              }}
              aria-hidden={i !== index}
            >
              <div className={`relative h-full w-full transition-transform duration-250 ${visible ? "scale-100" : "scale-95"}`}>
                <PostImage url={url} alt={`รูปที่ ${i + 1} จาก ${count}`} fit="contain" priority={Math.abs(i - index) <= 1} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {index > 0 && (
        <button ref={prevRef} type="button" onClick={() => go(-1)} aria-label="รูปก่อนหน้า" className={`${arrow} left-4`}>
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
      )}
      {index < count - 1 && (
        <button ref={nextRef} type="button" onClick={() => go(1)} aria-label="รูปถัดไป" className={`${arrow} right-4`}>
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      )}

      {count > 1 && (
        <div aria-hidden className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-1.5">
          {urls.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-4 bg-ink" : "w-1.5 bg-ink-3"}`} />
          ))}
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
