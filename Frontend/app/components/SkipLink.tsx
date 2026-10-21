"use client";

type MainLike = {
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  focus(): void;
};

/** Moves keyboard focus to the page's `<main id="main">` (one per route). `false` when there is none. */
export function focusMain(doc: { querySelector(selector: "main"): MainLike | null }): boolean {
  const main = doc.querySelector("main");
  if (!main) return false;
  // -1: focusable by script, but not an extra Tab stop
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus();
  return true;
}

/**
 * "Skip to main content" (#856, WCAG 2.4.1): the first focusable element on every page, hidden until it has focus,
 * so a keyboard user does not tab through the whole Navbar before reaching the page.
 */
export default function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(e) => {
        if (focusMain(document)) e.preventDefault();
      }}
      // Parked above the viewport until focused; sr-only/not-sr-only would reset the padding (not-sr-only sets padding: 0)
      className="fixed left-4 top-4 z-[10000] -translate-y-[200%] rounded-lg border border-ink bg-ink px-4 py-2.5 text-sm font-semibold text-bg shadow-lg transition-transform focus:translate-y-0"
    >
      ข้ามไปเนื้อหาหลัก
    </a>
  );
}
