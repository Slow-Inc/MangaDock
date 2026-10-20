"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, nextTheme, readTheme, subscribeTheme, type Theme } from "../lib/theme";

const LABEL: Record<Theme, string> = { dark: "ธีมมืด", light: "ธีมสว่าง", system: "ตามระบบ" };

/** System / Light / Dark cycle (Strata Nav ThemeToggle). Not placed in the nav until every
 *  user-facing route is token-clean (redesign spec §4, Epic B). */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, () => readTheme(localStorage), () => "dark");

  const next = nextTheme(theme);
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`${LABEL[theme]} — เปลี่ยนเป็น${LABEL[next]}`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-2 transition-colors duration-[var(--t1)] hover:border-ink-3 hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        {theme === "dark" ? (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        ) : theme === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  );
}
