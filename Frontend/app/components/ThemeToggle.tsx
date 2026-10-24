"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, nextTheme, readTheme, subscribeTheme, type Theme } from "../lib/theme";

const LABEL: Record<Theme, string> = { dark: "ธีมมืด", light: "ธีมสว่าง", system: "ตามระบบ" };

/* The three icons are all rendered; globals.css shows the one for the theme already painted (data-theme, set by the
   boot script before first paint) — so a light or system visitor never sees the dark icon while the page hydrates. */
function ThemeIcons() {
  return (
    <>
      <svg data-icon="dark" className="md-theme-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
      </svg>
      <svg data-icon="light" className="md-theme-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg data-icon="system" className="md-theme-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    </>
  );
}

const useTheme = () => useSyncExternalStore<Theme>(subscribeTheme, () => readTheme(localStorage), () => "dark");

/** System / Light / Dark cycle (Strata Nav ThemeToggle), in the nav since every user-facing route is token-clean (#778). */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const next = nextTheme(theme);
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`${LABEL[theme]} — เปลี่ยนเป็น${LABEL[next]}`}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-2 transition-colors duration-[var(--t1)] hover:border-ink-3 hover:text-ink ${className}`}
    >
      <ThemeIcons />
    </button>
  );
}

/** The same cycle as a row of the account menu — where the theme lives on a phone, whose top bar has no room (#778). */
export function ThemeMenuRow({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const next = nextTheme(theme);
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`${LABEL[theme]} — เปลี่ยนเป็น${LABEL[next]}`}
      className={`flex w-full items-center gap-2 px-4 py-3 text-sm text-ink-2 transition hover:bg-fill hover:text-ink ${className}`}
    >
      <ThemeIcons />
      <span>ธีม: {LABEL[theme]}</span>
    </button>
  );
}
