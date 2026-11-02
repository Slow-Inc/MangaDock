'use client';

import { useState, type ReactNode } from 'react';

/**
 * The one way anything in the docs folds and unfolds. The box grows and shrinks between 0fr and 1fr (the
 * Strata "glide": a box that changes height) while its content fades, so the surrounding page moves smoothly
 * instead of jumping. Folded content is `inert`: not focusable and not read by a screen reader. Content stays
 * mounted, so what is inside keeps its state. The global reduced-motion rule switches the transition off.
 */
export default function Collapse({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-[var(--t-glide)] ease-[var(--ease-glide)] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} ${className}`}>
      <div
        inert={!open}
        className={`min-h-0 overflow-hidden transition-opacity duration-[var(--t2)] ease-[var(--ease)] ${open ? 'opacity-100' : 'opacity-0'}`}
      >
        {children}
      </div>
    </div>
  );
}

/** A row that folds its content: the look of ui/Disclosure (hairline, +/- circle), with the fold animated. */
export function AnimatedDisclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="group flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left text-ink"
      >
        <span className="min-w-0">{summary}</span>
        <span aria-hidden className="relative h-7 w-7 shrink-0 rounded-full border border-line transition-colors duration-[var(--t1)] group-hover:border-ink-3">
          <span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-ink-2" />
          <span className={`absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-ink-2 transition-transform duration-[var(--t2)] ease-[var(--ease)] ${open ? 'scale-y-0' : ''}`} />
        </span>
      </button>
      <Collapse open={open}>
        <div className="pb-5 text-ink-2">{children}</div>
      </Collapse>
    </div>
  );
}
