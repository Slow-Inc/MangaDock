"use client";

import { useEffect, type RefObject } from "react";

/**
 * Where Tab should land when it would leave the dialog (#837): the last control wraps to the first, Shift+Tab on
 * the first wraps to the last, focus that is outside the dialog (index -1) is pulled back in. null = let the
 * browser move focus normally.
 */
export function focusWrapTarget({ index, count, backwards }: { index: number; count: number; backwards: boolean }): number | null {
  if (count === 0) return null;
  if (index === -1) return backwards ? count - 1 : 0;
  if (!backwards && index === count - 1) return 0;
  if (backwards && index === 0) return count - 1;
  return null;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard focus for an aria-modal dialog (#837): moves focus in on open, keeps Tab inside while `isTop()` (so a
 * stacked popup owns the keyboard), and gives focus back to where it was on close. `active` = the dialog is in the
 * DOM (a portal that renders after mount passes its mounted flag).
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, isTop: () => boolean, active = true) {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !isTop() || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0); // visible (offsetParent is null for fixed elements)
      const index = items.indexOf(document.activeElement as HTMLElement);
      const target = focusWrapTarget({ index, count: items.length, backwards: e.shiftKey });
      if (target === null) return;
      e.preventDefault();
      items[target].focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // Runs when the dialog appears/disappears: isTop reads live state, ref is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
