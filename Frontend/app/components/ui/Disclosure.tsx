import type { ReactNode } from "react";

/**
 * Strata `.reg` / `.row` disclosure list (globals.css 1903-1994): native <details> (works without JS),
 * hairline rows, a "+" in a 28 px circle that turns into "−" when open.
 */
export default function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-ink [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{summary}</span>
        <span aria-hidden className="relative h-7 w-7 shrink-0 rounded-full border border-line transition-colors duration-[var(--t1)] group-hover:border-ink-3">
          <span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-ink-2" />
          <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-ink-2 transition-transform duration-[var(--t2)] ease-[var(--ease)] group-open:scale-y-0" />
        </span>
      </summary>
      <div className="pb-5 text-ink-2">{children}</div>
    </details>
  );
}
