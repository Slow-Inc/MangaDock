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

/**
 * Tab and Shift+Tab over one cycle, wrapping at both ends — used while a toast is up (#956): its controls follow the
 * dialog's in the cycle, so the browser's DOM order (the toast sits elsewhere) can't be used. -1 = focus was lost.
 */
export function cycleTarget({ index, count, backwards }: { index: number; count: number; backwards: boolean }): number {
  if (index === -1) return backwards ? count - 1 : 0;
  return (index + (backwards ? -1 : 1) + count) % count;
}

/** The controls of a toast on screen (ToastContext marks its card while shown) — reachable from any open dialog. */
const toastControls = (dialog: HTMLElement) =>
  [...document.querySelectorAll<HTMLElement>("[data-toast-card] button:not(:disabled)")].filter(
    (el) => !dialog.contains(el) && el.getClientRects().length > 0,
  );

/** A shown overlay: fixed, visible (opacity > 0), holding controls — a login prompt bar, a modal, a lightbox. */
const isOverlayLayer = (n: Element) => {
  if (!(n instanceof HTMLElement)) return false;
  const cs = getComputedStyle(n);
  // The toast is not a layer to stand aside for: dialogs fold its controls into their own cycle instead (#956)
  if (n.hasAttribute("data-toast-layer")) return false;
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

/**
 * The control to give focus back to on close (#1073). Usually what held focus when the dialog appeared; but an
 * `autoFocus` field inside it takes focus during the commit, before the dialog's effect runs — then it is the element
 * focused just before that.
 */
export function pickOpener<T>(root: { contains(n: T): boolean } | null, active: T | null, before: T | null): T | null {
  return active && root?.contains(active) ? before : active;
}

// What held focus before the current element: read by pickOpener when an autoFocus field already took focus
let focusedBefore: HTMLElement | null = null;
if (typeof document !== "undefined") {
  let now: EventTarget | null = document.activeElement;
  document.addEventListener("focusin", (e) => {
    focusedBefore = now instanceof HTMLElement && now !== document.body ? now : focusedBefore;
    now = e.target;
  }, true);
}

/**
 * The controls Tab actually stops on (#1073): the browser treats a radio group as one stop — its checked radio, or its
 * first when none is — so the wrap at either end must too, or Tab off the group leaves the dialog.
 */
export function keepTabStops<T>(items: T[], group: (el: T) => string | null, checked: (el: T) => boolean): T[] {
  const stop = new Map<string, T>();
  for (const el of items) {
    const g = group(el);
    if (g === null) continue;
    const current = stop.get(g);
    if (current === undefined || (checked(el) && !checked(current))) stop.set(g, el);
  }
  return items.filter((el) => {
    const g = group(el);
    return g === null || stop.get(g) === el;
  });
}
const radioGroup = (el: HTMLElement) => (el instanceof HTMLInputElement && el.type === "radio" && el.name ? el.name : null);
const isChecked = (el: HTMLElement) => el instanceof HTMLInputElement && el.checked;

/** The innermost aria-modal dialog holding `el` — the one whose keyboard it is (#1073). */
const innermostModal = (el: Element | null) => el?.closest('[aria-modal="true"]') ?? null;

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
    const root = ref.current;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = pickOpener<HTMLElement>(root, focused, focusedBefore);
    if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !isTop() || !ref.current) return;
      // a dialog opened inside this one (a report form in the reader) runs its own Tab cycle (#1073)
      const inner = innermostModal(document.activeElement);
      if (inner && inner !== ref.current && ref.current.contains(inner)) return;
      // visible (offsetParent is null for fixed elements) and not inside an inert part (a collapsed group, a closed menu):
      // the browser skips those, and the toast cycle below moves focus itself, so it must skip them too
      const own = keepTabStops(
        [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
        ),
        radioGroup,
        isChecked,
      );
      const toast = toastControls(ref.current);
      const items = [...own, ...toast];
      const active = document.activeElement;
      const index = items.indexOf(active as HTMLElement);
      const focusInOtherLayer = !!active && active !== document.body && index === -1 && !ref.current.contains(active);
      if (toast.length > 0) {
        // A toast is up: the dialog stays sealed, and its controls join the cycle right after the dialog's own —
        // only for the dialog nothing else is layered above (a popup under the reader or a lightbox must not act)
        const layer = ref.current.closest("body > *");
        if (focusInOtherLayer || items.length === 0 || (layer && hasLayerAbove(layer))) return;
        e.preventDefault();
        items[cycleTarget({ index, count: items.length, backwards: e.shiftKey })].focus();
        return;
      }
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

/**
 * Whether the keyboard is this dialog's to act on (#1073): focus is lost to <body>, or the innermost aria-modal dialog
 * holding focus is this one. A dialog opened inside it (a report form in the reader) owns Tab and Escape while it holds
 * focus; so does a layer opened over it elsewhere (a login prompt).
 */
export function ownsKeyboard<T>(dialog: T, active: T | null, body: T, innermost: T | null): boolean {
  return active === null || active === body || innermost === dialog;
}

/**
 * An aria-modal dialog's keyboard (#1073): `useDialogFocus` plus Escape calling `onClose` while the dialog owns the
 * keyboard. Listened in the capture phase and stopped, so a dialog or reader underneath (which listens on window)
 * does not close too. `active` = the dialog is open (a dialog that animates out stays mounted after it closes).
 */
export function useModalDialog(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  useDialogFocus(ref, () => true, active);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key !== "Escape" || !ref.current || !ownsKeyboard<Element>(ref.current, el, document.body, innermostModal(el))) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ref, onClose, active]);
}
