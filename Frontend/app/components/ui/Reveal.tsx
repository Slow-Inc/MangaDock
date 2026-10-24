"use client";

/**
 * Strata `Reveal` (components/Reveal.tsx + globals.css 2251-2260): content is visible by default; only
 * under `html.js` does it start hidden and rise in once, staggered by `--i`. Reduced motion shows it at once.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export default function Reveal({ index = 0, className = "", children }: { index?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ "--i": index } as CSSProperties}>
      {children}
    </div>
  );
}
