"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useReducedMotion } from "./reducedMotion";

export function useLocalLenis(
  ref: React.RefObject<HTMLElement | null>,
  orientation: "vertical" | "horizontal" = "vertical",
  active: boolean = true,
  instanceRef?: { current: Lenis | null },
  contentRef?: React.RefObject<HTMLElement | null>
) {
  const resolvedInstanceRef = instanceRef ?? null;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const contentEl = contentRef?.current ?? el;
    if (!active || !el || !contentEl) return;

    const lenis = new Lenis({
      wrapper: el,
      content: contentEl,
      eventsTarget: el,
      orientation,
      gestureOrientation: "both",
      lerp: 0.08,
      wheelMultiplier: 1,
      smoothWheel: !reducedMotion, // #849
    });

    if (resolvedInstanceRef) {
      resolvedInstanceRef.current = lenis;
    }

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    const stopBubbling = (e: Event) => {
      e.stopPropagation();
    };

    el.addEventListener("wheel", stopBubbling, { passive: false });
    el.addEventListener("touchstart", stopBubbling, { passive: false });
    el.addEventListener("touchmove", stopBubbling, { passive: false });

    // Clean up lenis when the component unmounts
    return () => {
      el.removeEventListener("wheel", stopBubbling);
      el.removeEventListener("touchstart", stopBubbling);
      el.removeEventListener("touchmove", stopBubbling);
      if (resolvedInstanceRef) {
        resolvedInstanceRef.current = null;
      }
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [ref, orientation, active, resolvedInstanceRef, contentRef, reducedMotion]);
}
