import { forwardRef, type InputHTMLAttributes } from "react";

/** Strata search input (globals.css 1878-1894): 48 px pill on surface; focus ring = accent (globals). */
export const inputClass =
  "w-full min-h-12 rounded-full border border-line bg-surface px-5 text-[0.9375rem] text-ink placeholder:text-ink-3 " +
  "transition-[border-color] duration-[var(--t1)] ease-[var(--ease)] hover:border-ink-3 focus:border-ink-3";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} className={`${inputClass} ${className}`} {...rest} />;
});

export default Input;
