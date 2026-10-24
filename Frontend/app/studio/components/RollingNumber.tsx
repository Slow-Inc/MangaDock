/**
 * Digits roll up into place like a slot machine (after the Analytics Dashboard docs the dev supplied).
 * Each digit is a 0–9 strip moved by a CSS animation; non-digits (",", ".", letters) sit still.
 * The real value is in the accessible text; the strips are aria-hidden. Reduced motion: no animation.
 */
export default function RollingNumber({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`relative inline-flex tabular-nums ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden className="inline-flex" key={value}>
        {[...value].map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className="relative inline-block h-[1em] overflow-hidden leading-none">
              <span
                className="flex flex-col [animation:md-roll_var(--t3)_var(--ease)_both]"
                style={{ ["--d" as string]: Number(ch), animationDelay: `calc(${i} * var(--stagger))` }}
              >
                {"0123456789".split("").map((d) => (
                  <span key={d} className="h-[1em] leading-none">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span key={i} className="leading-none">
              {ch}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
