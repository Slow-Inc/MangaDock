import type { ElementType, ReactNode } from "react";

/**
 * Neutral gradient headline. Idea from cult-ui `GradientHeading` (MIT, https://www.cult-ui.com/docs/components/gradient-heading),
 * rewritten on our tokens: only its default grey-to-grey variant — no hue, no purple.
 * For each page's main title, not for every heading (redesign spec §3).
 */
export default function GradientHeading({
  as: Tag = "h1",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={`font-semibold tracking-[-0.035em] [text-wrap:balance] ${className}`}>
      <span className="bg-[linear-gradient(to_top,var(--ink-2),var(--ink))] bg-clip-text pb-[0.08em] text-transparent">{children}</span>
    </Tag>
  );
}
