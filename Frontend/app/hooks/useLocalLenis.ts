"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export function useLocalLenis(
  ref: React.RefObject<HTMLElement | null>,
  orientation: "vertical" | "horizontal" = "vertical",
  active: boolean = true,
  instanceRef?: { current: Lenis | null }
) {
  const resolvedInstanceRef = instanceRef ?? null;

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;

    const lenis = new Lenis({
      wrapper: el,
      content: el,
      eventsTarget: el,
      orientation,
      gestureOrientation: "both",
      lerp: 0.08,
      wheelMultiplier: 1,
      smoothWheel: true,
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
  }, [ref, orientation, active, resolvedInstanceRef]);
}
