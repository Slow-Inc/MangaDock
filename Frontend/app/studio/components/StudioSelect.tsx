"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocalLenis } from "../../hooks/useLocalLenis";
import { useModalTransition } from "../../hooks/useModalTransition";
import { usePopoverDismiss } from "../../hooks/popoverDismiss";

export type StudioSelectOption = {
  value: string;
  label: string;
};

export function StudioSelect({
  value,
  onChange,
  options,
  placeholder = "-- เลือก --",
  disabled = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: StudioSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** What the select chooses (#1041): the trigger reads "label: value" — its text alone is only the value */
  label?: string;
}) {
  const [wantOpen, setWantOpen] = useState(false);
  const { mounted: renderPanel, visible: open } = useModalTransition(wantOpen, { duration: 200 });
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelId = useId();

  useLocalLenis(listRef as React.RefObject<HTMLElement | null>, "vertical", open && !disabled);

  const checkFlip = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(320, Math.max(200, options.length * 44));
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < dropdownHeight + 12);
  }, [options.length]);

  // Outside click or Escape closes; Escape returns focus to the trigger (#874)
  usePopoverDismiss(open, containerRef, () => setWantOpen(false));

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => checkFlip();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    updatePosition();

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, checkFlip]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label ? `${label}: ${selected ? selected.label : placeholder}` : undefined}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setWantOpen(false);
            return;
          }
          checkFlip();
          setWantOpen(true);
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
          disabled
            ? "cursor-not-allowed border-line bg-fill text-ink-3"
            : open
              ? "border-ink-3 bg-raised text-ink ring-1 ring-line"
              : "border-line bg-fill text-ink-2 hover:border-ink-3 hover:bg-raised hover:text-ink"
        }`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {renderPanel && (
        <div
          id={panelId}
          inert={!open} // still mounted while it fades out
          className={`absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_40px_-16px_rgb(0_0_0/.3)] transition-all duration-200 ease-in-out ${
            dropUp ? "bottom-full mb-1.5 origin-bottom-left" : "top-full mt-1.5 origin-top-left"
          } ${
            open
              ? "pointer-events-auto scale-100 opacity-100 translate-y-0"
              : dropUp
                ? "pointer-events-none scale-95 opacity-0 translate-y-2"
                : "pointer-events-none scale-95 opacity-0 -translate-y-2"
          }`}
        >
          <ul ref={listRef} className="custom-scrollbar max-h-80 overflow-y-auto py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => {
                      onChange(option.value);
                      setWantOpen(false);
                      triggerRef.current?.focus(); // the chosen button turns inert as the panel closes (#874)
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-sm transition hover:bg-fill ${
                      isSelected ? "text-accent" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
