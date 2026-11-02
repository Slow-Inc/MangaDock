'use client';

import { useState, type ReactNode } from 'react';
import { DisclosureGlyph } from '../components/ui/Disclosure';

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

/** A row that folds its content: the look of ui/Disclosure (hairline, its +/- glyph), with the fold animated. */
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
        <DisclosureGlyph open={open} />
      </button>
      <Collapse open={open}>
        <div className="pb-5 text-ink-2">{children}</div>
      </Collapse>
    </div>
  );
}
