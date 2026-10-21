---
name: reference-frontend-a11y-gotchas
type: reference
description: Non-obvious Next 16 / React 19 / Tailwind v4 traps hit while fixing a11y (2026-10-21) — page titles, skip link, popovers, reduced motion, SSR fetch timeouts; read before touching any of these
---

Found while closing the a11y/robustness issues #846–#874 (2026-10-21). Each cost a build-and-measure cycle to discover;
the code that encodes the answer is named so you can read it instead of rediscovering it.

1. **Page titles — `document.title` alone is overwritten.** Next re-commits its root metadata `<title>` text *after
   hydration* (traced: our write at ~115 ms reverted, no element added). React 19's hoisted `<title>` does not help:
   on a direct load Next adds a second root `<title>` ahead of ours, and client navigation piles up title elements.
   → `Frontend/app/hooks/pageTitle.ts`: a stack (React unmounts a parent's effects before its child's, so
   "restore what I replaced" leaves stale titles) rooted at the constant `SITE_TITLE`, plus a `<head>` MutationObserver
   that re-asserts the claimed title. Every route but home claims one (#855).

2. **Tailwind v4 `not-sr-only` resets `padding: 0`** — a `sr-only focus:not-sr-only px-4` skip link renders with no
   padding. Use the translate-off-screen pattern (`components/SkipLink.tsx`, #856).

3. **Focusing a non-control by script after Enter matches `:focus-visible`** (Chrome heuristic) — the global ring then
   outlines the whole `<main>`. `main[tabindex="-1"]:focus-visible { outline: none }` in `@layer base` (#856).

4. **axe only treats `<a href="#x">` as a skip link if `#x` exists** — otherwise `region` flags it on every page. Every
   `<main>` carries `id="main"` (one per route; keep it that way).

5. **Swapping an element under the pointer kills React's `onMouseLeave`** on its ancestors — a hover hold stuck after a
   Play/Pause icon swap. Icons inside toggles get `pointer-events-none` (`HeroCarousel.tsx`, #849). Proved by reading hook
   values off the React fiber in Playwright (`__reactFiber$` → `memoizedState` chain) — useful when refs hide state.

6. **Popovers here are disclosures, not ARIA menus** — `aria-expanded` + `aria-controls`, no `aria-haspopup` (it promises
   arrow-key menus). Closed panels are only faded, so make them `inert` or Tab walks into invisible items. Shared dismiss:
   `hooks/popoverDismiss.ts` (Escape returns focus to the trigger; Escape inside a dialog belongs to the dialog) (#870, #874).

7. **Reduced motion: the CSS kill-switch cannot reach JS motion.** Lenis `smoothWheel` (root, community sidebar
   `<ReactLenis>`, `useLocalLenis`), the hero autoplay, and every explicit `behavior: "smooth"` need
   `hooks/reducedMotion.ts` (`useReducedMotion`, `scrollBehavior()`) (#849, #852).

8. **Server-side `fetch` needs a deadline.** A hung backend held `/book/[id]/reviews` blank for 120 s+. Next 16.1.6 keeps
   the data cache with a `signal` (`patch-fetch.js` decides from cache/revalidate/method), so
   `AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS)` is free (`lib/serverFetch.ts`, #858); MangaDex calls 6 s (#861).

Related: [[feedback-frontend-css-layer-and-blur]], [[feedback-verify-before-claiming]].
