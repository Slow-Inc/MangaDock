"use client";

import { useEffect, type RefObject } from "react";

/**
 * Where Tab should land when it would leave the dialog (#837): the last control wraps to the first, Shift+Tab on
 * the first wraps to the last, focus that was lost (index -1, on <body>) is pulled back in. Focus inside another
 * layer opened from the dialog (the reader, a lightbox — portals outside it) is left alone. null = let the browser
 * move focus normally.
 */
export function focusWrapTarget({ index, count, backwards, focusInOtherLayer = false }: {
  index: number; count: number; backwards: boolean; focusInOtherLayer?: boolean;
}): number | null {
  if (count === 0 || focusInOtherLayer) return null;
  if (index === -1) return backwards ? count - 1 : 0;
  if (!backwards && index === count - 1) return 0;
  if (backwards && index === 0) return count - 1;
  return null;
}

/** A shown overlay: fixed, visible (opacity > 0), holding controls — a login prompt bar, a modal, a lightbox. */
const isOverlayLayer = (n: Element) => {
  if (!(n instanceof HTMLElement)) return false;
  const cs = getComputedStyle(n);
  return cs.position === "fixed" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 &&
    n.getClientRects().length > 0 && !!n.querySelector("input, button, a[href], textarea, select");
};
const zIndexOf = (n: Element) => Number.parseInt(getComputedStyle(n).zIndex, 10) || 0;

/**
 * Whether another layer is shown over `el` (#840), among its siblings (portals are children of <body>): a higher
 * z-index wins wherever it sits in the DOM (the login prompt bar, z 9999, comes *before* the reader); at the same
 * z-index the later one is on top. Lets a full-screen layer that is not on a modal stack (the reader) stand aside —
 * its Tab trap and Escape — while something is open over it.
 */
export function hasLayerAbove(
  el: Element,
  { isLayer = isOverlayLayer, zIndex = zIndexOf }: { isLayer?: (n: Element) => boolean; zIndex?: (n: Element) => number } = {},
): boolean {
  const siblings = [...(el.parentElement?.children ?? [])];
  const mine = zIndex(el);
  const at = siblings.indexOf(el);
  return siblings.some((n, i) => n !== el && isLayer(n) && (zIndex(n) > mine || (zIndex(n) === mine && i > at)));
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
      const active = document.activeElement;
      const index = items.indexOf(active as HTMLElement);
      const focusInOtherLayer = !!active && active !== document.body && !ref.current.contains(active);
      const target = focusWrapTarget({ index, count: items.length, backwards: e.shiftKey, focusInOtherLayer });
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
