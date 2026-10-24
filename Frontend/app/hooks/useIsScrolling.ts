import { useEffect, useRef, useState } from "react";

/**
 * True while the page is scrolling and for `settleMs` after the last scroll event.
 * `onStart` runs synchronously on the first scroll event, before the re-render.
 * Lets a canvas animation pause during a scroll so the two do not fight for the same frames
 * (the mascot editor's preview held /settings at 30 fps while scrolling, 2026-10-20).
 */
export function useIsScrolling(settleMs = 200, onStart?: () => void): boolean {
  const [scrolling, setScrolling] = useState(false);
  const active = useRef(false);
  const start = useRef(onStart);
  useEffect(() => {
    start.current = onStart;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      // Set state only on the edges: a same-value setState can still re-render the caller once,
      // and bot-avatars repaints even a paused avatar on every render.
      if (!active.current) {
        active.current = true;
        start.current?.();
        setScrolling(true);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        active.current = false;
        setScrolling(false);
      }, settleMs);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [settleMs]);
  return scrolling;
}
