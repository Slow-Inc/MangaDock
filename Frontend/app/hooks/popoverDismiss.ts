"use client";

import { useEffect, useRef } from "react";

type Container = { contains(node: Node | null): boolean; querySelector(selector: string): HTMLElement | null };
type Doc = Pick<Document, "addEventListener" | "removeEventListener"> & { activeElement: Element | null };

/**
 * Closes an open popover on a mousedown outside it or on Escape; Escape returns focus to the trigger (the
 * container's `[aria-expanded]` element) when focus was inside, so a keyboard user is not left in a closed panel.
 * Returns the cleanup.
 */
export function popoverDismiss(doc: Doc, getContainer: () => Container | null, close: () => void): () => void {
  const onMouseDown = (e: MouseEvent) => {
    const c = getContainer();
    if (c && !c.contains(e.target as Node)) close();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const c = getContainer();
    const focusInside = !!c && c.contains(doc.activeElement);
    close();
    if (focusInside) c.querySelector("[aria-expanded]")?.focus();
  };
  doc.addEventListener("mousedown", onMouseDown);
  doc.addEventListener("keydown", onKeyDown);
  return () => {
    doc.removeEventListener("mousedown", onMouseDown);
    doc.removeEventListener("keydown", onKeyDown);
  };
}

/** The Navbar popovers' dismiss behaviour (#870) — categories menu, notifications, user menu. */
export function usePopoverDismiss(
  open: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  close: () => void,
): void {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    if (!open) return;
    return popoverDismiss(document, () => containerRef.current, () => closeRef.current());
  }, [open, containerRef]);
}
