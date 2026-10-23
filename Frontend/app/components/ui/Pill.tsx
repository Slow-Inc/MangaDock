import { forwardRef, type ButtonHTMLAttributes } from "react";

/**
 * One pill for chips, filters and tabs — Strata had five near-identical variants (system-design
 * ch. 02 §11.3 asks to merge them). Selected = filled with ink, text in the page colour.
 */
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; size?: "sm" | "md" };

export function pillClass(selected = false, size: "sm" | "md" = "md", extra = "") {
  return (
    "inline-flex items-center gap-2 rounded-full border whitespace-nowrap select-none " +
    "transition-[transform,translate,scale,rotate,background-color,border-color,color] duration-[var(--t1)] ease-[var(--ease)] active:translate-y-px " +
    (size === "sm" ? "min-h-8 px-3 text-xs " : "min-h-10 px-3.5 text-sm ") +
    (selected ? "bg-ink text-bg border-ink " : "bg-transparent text-ink-2 border-line hover:text-ink hover:border-ink-3 ") +
    extra
  );
}

const Pill = forwardRef<HTMLButtonElement, Props>(function Pill(
  { selected = false, size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} aria-pressed={selected} className={pillClass(selected, size, className)} {...rest} />;
});

export default Pill;
