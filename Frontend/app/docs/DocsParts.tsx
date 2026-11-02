'use client';

import { createContext, useContext, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import GradientHeading from '../components/ui/GradientHeading';
import { DOT_FIELD, shimmerDelay } from '../components/skeletonDots';
import { viewToPath, type ViewState } from './routes';

// Small shared pieces of the docs area: real links, the page header and the loading skeleton.

/** A real `<a href>` for a view: middle/ctrl/cmd-click opens the page in a new tab, a plain click stays in the app. */
export function DocLink({ view, navigate, onClick, ...rest }: {
  view: ViewState;
  navigate: (v: ViewState) => void;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(view);
  };
  return <a href={viewToPath(view)} onClick={handle} {...rest} />;
}

/**
 * The area's signature visual (DESIGN.md §1, "a dot field"): a faint grid of dots that fades out from the
 * corner of a page header. Decorative only — hidden from assistive tech and never intercepts a tap.
 */
export function DotCorner() {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -right-2 -top-4 h-36 w-56 opacity-70 sm:h-44 sm:w-80 ${DOT_FIELD} [mask-image:radial-gradient(circle_at_100%_0%,#000,transparent_72%)]`}
    />
  );
}

/** True while the phone's navigation sheet is open, so floating status cards can step out of its way. */
export const SheetOpenContext = createContext(false);
export const useSheetOpen = () => useContext(SheetOpenContext);

export interface Crumb { label: string; view?: ViewState }

/** Mono breadcrumb + gradient title + optional trailing controls. One header for every non-document page. */
export function PageHeader({ crumbs, title, children, navigate }: {
  crumbs: Crumb[];
  title: ReactNode;
  children?: ReactNode;
  navigate: (v: ViewState) => void;
}) {
  return (
    <header className="relative mb-8 border-b border-line pb-6">
      <DotCorner />
      <nav aria-label="breadcrumb" className="relative mb-4 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-ink-3">
        {crumbs.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden size={11} />}
            {c.view ? (
              <DocLink view={c.view} navigate={navigate} className="py-1.5 transition-colors duration-[var(--t1)] hover:text-ink">{c.label}</DocLink>
            ) : (
              <span aria-current={i === crumbs.length - 1 ? 'page' : undefined} className={i === crumbs.length - 1 ? 'text-ink-2' : ''}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <GradientHeading as="h1" className="relative text-[clamp(1.6rem,5vw,2.25rem)] leading-[1.25]">{title}</GradientHeading>
      {children && <div className="relative mt-5">{children}</div>}
    </header>
  );
}

/** Skeleton rows on the dot field + a quiet pulse (the Strata skeleton), staggered so the shimmer travels. */
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">กำลังโหลด</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={shimmerDelay(i)} className={`h-[4.25rem] animate-pulse rounded-2xl bg-fill ${DOT_FIELD}`} />
      ))}
    </div>
  );
}
