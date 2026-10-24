---
name: feedback-frontend-css-layer-and-blur
type: feedback
description: Global CSS outside @layer beats Tailwind utilities (2 real bugs, 2026-10-20); backdrop-blur on repeated items or full-screen scrims halves the frame rate — measure, don't guess
---

Two frontend rules learned the hard way on the Strata redesign (PR #799, 2026-10-20):

1. **Element/global rules in `Frontend/app/globals.css` go inside `@layer base`.** Tailwind v4 puts
   utilities in a layer; any *unlayered* rule wins over every utility regardless of specificity.
   Two bugs came from this in one day: the global `:focus-visible` ring (with `border-radius: 4px`)
   beat `outline-none` and drew square, clipped rings inside rounded boxes (the navbar search); and
   `img, svg { max-width: 100% }` beat `max-w-none`, squeezing the mascot editor's still image.
   - **Why:** the dev saw both as "broken" polish; the cause was invisible in the component code.
   - **How to apply:** before adding a global selector, put it in `@layer base`; when a utility
     "does nothing", look for an unlayered rule first.

2. **No `backdrop-blur` on anything that repeats or on a full-screen scrim** (now in DESIGN.md
   "Don't"). 80 blurred book cards held home at 30 fps; the book popup's full-viewport blur over the
   animating hero held it near 10 fps. JS was ~99 % idle — it is raster/compositor cost.
   - **How to apply:** measure in a clean headless Chromium on a production build (`next start`):
     the Playwright MCP window throttles rAF to ~1 fps and produces fake 1 s "long tasks". A/B by
     injecting CSS (`*{backdrop-filter:none}` etc.) to find the culprit before changing code.

Related: [[feedback-verify-before-claiming]], [[feedback-root-cause-before-fix]].
