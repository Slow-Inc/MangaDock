"use client";

/**
 * Loaders from `loading-dev` 0.3.5 (MIT, Jakub Krehel — https://github.com/jakubkrehel/loading).
 * Replaces the ~48 copied `animate-spin` spinners. Colour follows `currentColor` (so it reads inside a
 * primary button too) — pass `text-ink-2` for a muted standalone loader. Reduced motion is
 * handled by the library and by the global reduced-motion block in globals.css.
 */
import { Arc, Atom, Slide } from "loading-dev";
import { loaderFor, type LoaderContext } from "./loaderFor";

const BY_KIND = { atom: Atom, arc: Arc, slide: Slide } as const;

export default function Loader({
  context = "section",
  label = "กำลังโหลด",
  className = "",
}: {
  context?: LoaderContext;
  /** Read by screen readers; the animation itself is decorative. */
  label?: string;
  className?: string;
}) {
  const { kind, size } = loaderFor(context);
  const Spinner = BY_KIND[kind];
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center justify-center ${className}`}>
      <Spinner size={size} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
