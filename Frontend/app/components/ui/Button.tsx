import { forwardRef, type ButtonHTMLAttributes } from "react";

/** Strata `.btn` (globals.css 423-470): 44 px pill, 1 px line, press moves down 1 px. */
type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border font-medium whitespace-nowrap select-none " +
  "transition-[transform,background-color,border-color,color] duration-[var(--t1)] ease-[var(--ease)] " +
  "active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-y-0";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-bg border-ink hover:bg-[color-mix(in_srgb,var(--ink)_88%,var(--accent))]",
  secondary: "bg-surface text-ink border-line hover:border-ink",
  ghost: "bg-transparent text-ink-2 border-transparent hover:text-ink hover:bg-fill",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-[0.8125rem]",
  md: "min-h-11 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-7 text-base",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />;
});

export default Button;
