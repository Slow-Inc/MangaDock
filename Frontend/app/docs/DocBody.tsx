'use client';

import { memo, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

// A long document is not rendered in one go: the first pieces appear at once, the rest are added as the reader
// nears them (and, meanwhile, a few at a time when the browser is idle). Rendering all of the 271 KB impact
// report in a single pass is ~6,000 nodes and a second of frozen page; pieces are ~20-40 nodes each.
// Each piece is also memoised, so when a translation of one piece arrives only that piece re-renders.

const Unit = memo(
  function Unit({ content, ids }: { content: string; ids: readonly string[] }) {
    return <MarkdownRenderer content={content} headingIds={ids} />;
  },
  (a, b) => a.content === b.content && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]),
);

const PER_IDLE_TICK = 2;
const PER_SCROLL_NEAR = 6;
const EST_UNIT_HEIGHT = 140; // px a not-yet-rendered piece holds open, so the scroll bar is not wildly wrong

export const INITIAL_UNITS = 4;

export default function DocBody({ units, ids, mounted, setMounted }: {
  units: readonly string[];
  /** `ids[i]` = heading ids of piece i (see headingsOfUnits). */
  ids: readonly (readonly string[])[];
  mounted: number;
  setMounted: (update: (n: number) => number) => void;
}) {
  const total = units.length;
  const sentinel = useRef<HTMLDivElement>(null);

  // When the reader scrolls near the end of what is rendered, add more at once.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || mounted >= total) return;
    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setMounted(n => Math.min(total, n + PER_SCROLL_NEAR)); },
      { rootMargin: '1500px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, total, setMounted]);

  // Otherwise fill in the rest a little at a time, whenever the browser has nothing better to do.
  useEffect(() => {
    if (mounted >= total) return;
    const add = () => setMounted(n => Math.min(total, n + PER_IDLE_TICK));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(add, { timeout: 400 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(add, 60);
    return () => clearTimeout(t);
  }, [mounted, total, setMounted]);

  const shown = Math.min(mounted, total);
  return (
    <>
      {units.slice(0, shown).map((u, i) => <Unit key={i} content={u} ids={ids[i] ?? []} />)}
      {shown < total && <div ref={sentinel} aria-hidden style={{ height: Math.min((total - shown) * EST_UNIT_HEIGHT, 4000) }} />}
    </>
  );
}
