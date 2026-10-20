import type { HTMLAttributes } from "react";

/** Strata `.stat` / `.story__stage` card: 1 px line, 28 px radius, surface fill; hover raises the border. */
export const cardClass =
  "rounded-[var(--r-card)] border border-line bg-surface transition-[border-color] duration-[var(--t2)] ease-[var(--ease)]";

export default function Card({ interactive = false, className = "", ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={`${cardClass} ${interactive ? "hover:border-ink-3" : ""} ${className}`} {...rest} />;
}
