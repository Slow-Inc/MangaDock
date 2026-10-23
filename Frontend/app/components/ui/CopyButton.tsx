"use client";

/**
 * Copies a value and says so (Studio, #789 — after the spell-ui CopyButton the dev supplied):
 * the copy icon turns into a check for 1.6 s, and a polite live region announces the result.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "./Button";

type State = "idle" | "copied" | "failed";

export default function CopyButton({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  };

  return (
    <button type="button" onClick={copy} className={buttonClass("secondary", "sm", className)}>
      <span className="relative inline-flex h-4 w-4" aria-hidden>
        <Copy className={`absolute inset-0 h-4 w-4 transition-[opacity,transform,translate,scale,rotate] duration-[var(--t1)] ${state === "copied" ? "scale-50 opacity-0" : "opacity-100"}`} />
        <Check className={`absolute inset-0 h-4 w-4 text-ok transition-[opacity,transform,translate,scale,rotate] duration-[var(--t1)] ${state === "copied" ? "opacity-100" : "scale-50 opacity-0"}`} />
      </span>
      {label}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "คัดลอกแล้ว" : state === "failed" ? "คัดลอกไม่สำเร็จ" : ""}
      </span>
    </button>
  );
}
