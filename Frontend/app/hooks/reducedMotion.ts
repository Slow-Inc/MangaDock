"use client";

import { useSyncExternalStore } from "react";

type MotionQuery = Pick<MediaQueryList, "matches"> & {
  addEventListener(type: "change", fn: () => void): void;
  removeEventListener(type: "change", fn: () => void): void;
};

/** subscribe/getSnapshot over `(prefers-reduced-motion: reduce)`, injectable for tests. */
export function motionStore(query: MotionQuery) {
  return {
    subscribe(onChange: () => void) {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    getSnapshot: () => query.matches,
  };
}

const QUERY = "(prefers-reduced-motion: reduce)";

// Stable identities, browser-only on first use — same shape as pageVisibility.ts.
let store: ReturnType<typeof motionStore> | null = null;
const motion = () => (store ??= motionStore(matchMedia(QUERY)));
const subscribe = (onChange: () => void) => motion().subscribe(onChange);
const getSnapshot = () => motion().getSnapshot();
const getServerSnapshot = () => false;

/**
 * Whether the user asks for reduced motion (#849). The CSS rule in globals.css stops CSS animations and
 * transitions; this is for motion driven from JS (Lenis inertia, the hero's rotation), which that rule cannot
 * reach. Server render counts as no preference.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The hero rotates on its own unless the user paused it — or, until they choose, unless they ask for reduced motion. */
export function heroAutoplay(userChoice: boolean | null, reducedMotion: boolean): boolean {
  return userChoice ?? !reducedMotion;
}

/** Whether reduced motion is asked for right now — for event handlers and effects, where a hook cannot go. */
export function prefersReducedMotion(query: Pick<MediaQueryList, "matches"> = matchMedia(QUERY)): boolean {
  return query.matches;
}

/**
 * `behavior` for JS-initiated scrolling (#852). globals.css sets `scroll-behavior: auto` under reduced motion, but
 * an explicit `behavior: "smooth"` passed to scrollTo/scrollBy/scrollIntoView overrides it.
 */
export function scrollBehavior(query?: Pick<MediaQueryList, "matches">): ScrollBehavior {
  return prefersReducedMotion(query) ? "auto" : "smooth";
}
