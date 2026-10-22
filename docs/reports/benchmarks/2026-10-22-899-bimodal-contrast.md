# #899 corrected: the fill was dark, not grey — the proposed rule never fires (nothing shipped)

- **Date:** 2026-10-22 · **Issue:** #899 · **Outcome:** code reverted; diagnosis corrected; no render change.

## What I claimed

The outlined JP lettering (white fill + black outline) was being *averaged to mid grey* by the colour head,
giving poor contrast on the bimodal (black hair / white paper) background.

## What the implementation showed

I built the proposed rule — `adapt_font_colors_to_background`: when the destination patch is bimodal (>=15 %
pixels near-white and >=15 % near-black) and the predicted fill is achromatic mid grey (luma 50-205), snap to
white fill + black outline. Six unit tests pinned it. Then I traced the real page:

| region | fg predicted (RGB) | bg | patch light/dark | triggers? |
|---|---|---|---|---|
| #0 | 20,14,9 | 255,255,255 | 0.96 / 0.02 | no |
| #1 | 17,12,8 | 255,255,255 | 0.83 / 0.09 | no |
| #2 | 19,17,15 | 255,255,255 | 0.92 / 0.03 | no |
| #3 | 13,10,7 | 255,255,255 | 1.00 / 0.00 | no |
| #4 | 10,8,2 | 255,255,255 | 0.79 / 0.11 | no |
| #5 | 50,42,37 | 255,255,255 | 0.58 / 0.14 | no |
| #6 | 8,8,3 | 255,255,255 | 0.63 / 0.22 | no |

The predicted fill is **dark** everywhere, with a white outline — not mid grey. Rendered that is dark letters
with a white outline: over the black hair the fill disappears but the **white outline** keeps the letters
legible, and the judge scored this page 1.71/2 with no contrast complaint. My "washed-out grey" reading came
from a zoomed crop, not from the pixel values.

So the rule cannot trigger on the case it was written for, and shipping it would be an unproven render change
(the same trap as #895). **Reverted; nothing shipped.**

## What is left worth doing (kept in #899)

The sampled pair *can* invert the source style: the source lettering here is white fill over the dark hair,
while the render picks a dark fill because the colour sample covers the whole textline bbox (mostly white paper)
rather than the pixels under the strokes. A future change would sample the background **under the ink** and
pick the pair that maximises worst-case contrast — but it needs its own measurement and 39-page EN replay
before it can be called an improvement.
