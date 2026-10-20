"use client";

/**
 * The Studio page toolbar (Epic C #788): tabs with one active pill that slides to the chosen tab, and the page's
 * actions beside them. It sticks to the top of the shell's scrolling content. Only the active tab's panel is
 * rendered, so a page mounts only the charts that are on screen. Reduced motion: the pill jumps (globals.css).
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { nextTabIndex } from "../lib/shellMath";

export type StudioTab<K extends string> = { key: K; label: string };

export function StudioToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg px-4 py-3 sm:px-6">
      {children}
    </div>
  );
}

const tabId = (idBase: string, key: string) => `${idBase}-tab-${key}`;
const panelId = (idBase: string, key: string) => `${idBase}-panel-${key}`;

/** Props for the element that shows the active tab's content (no tabIndex: every panel has focusable content). */
export function tabPanelProps(idBase: string, key: string) {
  return { role: "tabpanel", id: panelId(idBase, key), "aria-labelledby": tabId(idBase, key) } as const;
}

export function StudioTabBar<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
}: {
  tabs: StudioTab<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  idBase: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const index = Math.max(0, tabs.findIndex((t) => t.key === value));

  // Measure the active tab whenever any tab changes size (web fonts arriving shift it); ResizeObserver also
  // reports once on observe, so this covers the first paint.
  useEffect(() => {
    const active = buttons.current[index];
    if (!active) return;
    const ro = new ResizeObserver(() => setPill({ x: active.offsetLeft, w: active.offsetWidth }));
    buttons.current.forEach((b) => b && ro.observe(b));
    return () => ro.disconnect();
  }, [index]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabIndex(index, e.key, tabs.length);
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].key);
    buttons.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative flex max-w-full overflow-x-auto rounded-full border border-line p-1">
      <span
        aria-hidden
        className="absolute bottom-1 left-0 top-1 rounded-full bg-fill transition-[transform,width] duration-[var(--t2)] ease-[var(--ease)]"
        style={pill ? { width: pill.w, transform: `translateX(${pill.x}px)` } : { opacity: 0 }}
      />
      {tabs.map((tab, i) => {
        const selected = i === index;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idBase, tab.key)}
            aria-selected={selected}
            aria-controls={panelId(idBase, tab.key)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`relative min-h-8 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors duration-[var(--t1)] ${
              selected ? "text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
