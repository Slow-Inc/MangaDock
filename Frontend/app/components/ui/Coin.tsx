/** The coin glyph used wherever a price or balance is shown. Takes the text colour (usually `text-coin`), so it is the same on every OS — unlike the 🪙 emoji it replaces. */
export default function Coin({ size = "1em", className = "" }: { size?: number | string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden className={`inline-block shrink-0 ${className}`}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="4.25" fill="none" stroke="var(--bg)" strokeOpacity="0.35" strokeWidth="1.25" />
    </svg>
  );
}
