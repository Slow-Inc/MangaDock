# #883's leftover English is a detection-recall gap, not an inpaint mask bug

- **Date:** 2026-10-22 · **Issue:** #883 · **Page:** Chainsaw Man c3 p0 (the `NOTICE:` credit block).
- **Question:** after the opt-in `fit_below_floor` removed the overlap, the original English credits were still
  visible behind the Thai. Is the inpaint mask missing them?

## Answer: no — the mask is complete; those lines are never detected

Dumped the real mask and the inpainted page from the pipeline (monkeypatched `run_mask_refinement` /
`run_inpainting` in the driver, saved their return values):

| credit line | detected? | mask coverage |
|---|---|---|
| `NOTICE:` | yes | **100 %** |
| `DO NOT REHOST THIS CHAPTER.` | yes | **100 %** |
| `CONSIDER BUYING THE OFFICIAL VOLUMES` | yes | **100 %** |
| `WHEN THEY ARE AVAILABLE IN YOUR REGION.` | yes | **100 %** |
| `You can read this chapter and more at the source / in its original high quality. www.mangastream.com` | **no** | — |
| `PLEASE DON'T SUPPORT WEBSITES THAT DO.` | **no** | — |

Detected lines: textlines 15; the two white lines and one red line are not in the set, so nothing inpaints them.

## The knob that recovers them

| `detector.text_threshold` | textlines | regions | white credit line present |
|---|---|---|---|
| **0.5 (default)** | 15 | 10 | no |
| 0.3 | 18 | 11 | **yes** |
| 0.2 | 18 | 9 | yes (fewer regions survive) |

`detector.box_threshold` (0.7/0.5/0.4) changes nothing on this page.

## Not shipped, and why

A lower `text_threshold` is corpus-wide: it can add false textlines on artwork, change masks and therefore
renders everywhere. It needs a 39-page A/B (false-positive count per page + translation/render diff) before it
can default. Recorded as the next step on #883.

## Method note

Drive the stage functions from the driver module (`manga_translator.manga_translator.run_mask_refinement`), not
`stages.*` — the driver binds them at import. And call `manga_translator.initialize()` (`.env`) **before** importing
the driver: importing it first captures empty translator keys (#614) and every live translation fails with
`APIConnectionError`.
