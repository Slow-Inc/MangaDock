"use client";

import { useRef, useState } from "react";
import { computeScrollState } from "../lib/horizontalScroll";
import { scrollBehavior } from "./reducedMotion";

export function useHorizontalScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [{ canScrollLeft, canScrollRight }, setState] = useState({
    canScrollLeft: false,
    canScrollRight: true,
  });

  const update = () => {
    const el = ref.current;
    if (el) setState(computeScrollState(el));
  };

  const scrollBy = (dir: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: (dir === "left" ? -1 : 1) * el.clientWidth * 0.75, behavior: scrollBehavior() });
  };

  return { ref, canScrollLeft, canScrollRight, update, scrollBy };
}
