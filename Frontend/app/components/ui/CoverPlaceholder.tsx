/**
 * Stands in for a book cover that has no image or whose every source failed (#921): a quiet tile with a book glyph and
 * the title, instead of the browser's broken-image icon. Decorative — the card names the book next to it.
 */
export default function CoverPlaceholder({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-fill p-3 text-center text-ink-3 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 shrink-0">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      <span className="line-clamp-3 text-[11px] font-medium leading-snug text-ink-2">{title}</span>
    </div>
  );
}
