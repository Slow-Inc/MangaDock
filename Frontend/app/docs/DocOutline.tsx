'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedDisclosure } from './Collapse';
import { scrollBehavior } from '../hooks/reducedMotion';
import { useLang } from './lang-context';
import type { Heading } from './markdown';
import type { Reveal } from './docContext';

/** A hairline across the top of the window that fills as the document is read. Updated off-React (no re-render per scroll). */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div ref={bar} className="h-full origin-left scale-x-0 bg-accent" />
    </div>
  );
}

/** Id of the heading currently being read: the last one whose top has passed the reading line. */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    if (ids.length === 0) return;
    const update = () => {
      const line = window.matchMedia('(min-width: 1024px)').matches ? 96 : 120;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      }
      setActive(cur);
    };
    update();
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [ids]);
  return active;
}

/** `reveal` first renders the piece of the document that holds the heading, if it is not on the page yet. */
async function jumpTo(id: string, reveal?: Reveal) {
  await reveal?.(id);
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

function OutlineList({ headings, active, reveal }: { headings: Heading[]; active: string; reveal?: Reveal }) {
  return (
    <ol className="space-y-px border-l border-line">
      {headings.map(h => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            onClick={e => { e.preventDefault(); void jumpTo(h.id, reveal); }}
            aria-current={active === h.id ? 'location' : undefined}
            className={`-ml-px block border-l py-1.5 pr-2 text-[13px] leading-snug transition-colors duration-[var(--t1)] max-lg:py-2.5 ${h.level === 3 ? 'pl-7' : 'pl-4'} ${
              active === h.id ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * "On this page". A sticky rail on wide screens; on a phone it is a collapsed row above the article
 * (a rail has no room there, and a floating button would cover the text).
 */
export default function DocOutline({ headings, variant, reveal }: { headings: Heading[]; variant: 'rail' | 'inline'; reveal?: Reveal }) {
  const lang = useLang();
  const ids = useMemo(() => headings.map(h => h.id), [headings]); // same array while the headings are: the scroll listener is not re-bound
  const active = useActiveHeading(ids);
  if (headings.length < 2) return null;
  const title = lang === 'th' ? 'บนหน้านี้' : 'On this page';

  if (variant === 'inline') {
    return (
      <div className="mb-6 xl:hidden">
        <AnimatedDisclosure summary={<span className="font-mono text-xs text-ink-2">{title} · {headings.length}</span>}>
          <OutlineList headings={headings} active={active} reveal={reveal} />
        </AnimatedDisclosure>
      </div>
    );
  }
  return (
    <aside aria-label={title} className="hidden xl:block">
      <div className="sticky top-14 max-h-[calc(100dvh-5rem)] overflow-y-auto pb-8" data-lenis-prevent>
        <p className="mb-3 font-mono text-[11px] text-ink-3">{title}</p>
        <OutlineList headings={headings} active={active} reveal={reveal} />
      </div>
    </aside>
  );
}
