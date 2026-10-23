# Opt-in OCR second pass (`MIT_OCR_REREAD=1`): fixes low-confidence misreads, costs ~+1.4 s/page

- **Date:** 2026-10-23 · module `manga_translator/ocr_reread.py`, wired in `_run_ocr` (flag-gated).

## Why

The stress run shipped an opposite-meaning translation because the 48px OCR read `DEEEND` where the artwork says DEFEND
(the detector's 2560 textline box clipped the F edge). Re-detecting or globally enlarging boxes churns the whole chapter
(round 174/175), but re-reading the **same pixels with a padded box** fixes the read: `TO DEEEND` (prob 0.51) ->
`TO DEFEND` (prob 0.90), and the translation goes back to `ปกป้อง` (protect).

## How it works

After the normal OCR pass, lines that are (a) Latin-letter dominant, (b) at least 4 letters and (c) below OCR
confidence 0.78 are re-read with the textline box padded 30 % on each side (clipped to the page). The new text replaces
the old one only when its confidence beats the old by >= 0.12 and the text actually changed. Max 8 re-reads per page.
Unset = byte-identical (no code path runs).

## Full 39-page sweep with the flag

| metric | value |
|---|---|
| re-reads accepted | **67** (~1.7/page) |
| source strings changed | 55/369 (14.9 %) |
| page layout (region-count) changes | **2/39** (the pass never moves a box) |
| OCR stage avg | 1,259 ms -> **2,705 ms** (+1.45 s/page) |
| judge mean | **1.446** (368 segs) vs 1.436 baseline (+0.01, noise) |
| pages better / worse | 17 / 13 / 8 same (noise) |

The pass visibly repairs garbage that used to be translated as-is:

- `DONOT RFHOST THIS CHAPT` (0.39) -> `DO NOT REHOST THIS CHAPTER.` (0.99)
- `CONSIDFR RITYING THF OFFICIAI VOI IIM` (0.20) -> `CONSIDER BUYING THE OFFICIAL VOLUMES` (0.99)
- `WHFN THFY ARF AVAII ARI F IN YOUR RFGION` (0.09) -> `WHEN THEY ARE AVAILABLE IN YOUR REGION.` (0.99)
- `TO DEEEND` (0.51) -> `TO DEFEND` (0.90), `TOKYQ` -> `TOKYO`, `THOUSAND DEVILL` -> `THOUSAND DEVIL`

Some re-reads are punctuation-only churn (`IF?YOU` -> `IF-YOU`, `MANY YOUNG.` -> `MANY YOUNG,`), which is why the pass
also needs the confidence margin.

## Decision

**Opt-in for now (`MIT_OCR_REREAD=1`).** The quality wins are real and deterministic, but the current cost (+1.45 s/page,
~19 % of wall time) is a real tradeoff and the judge is parity (+0.01, inside the noise band). Next tuning steps:
raise the confidence bar to ~0.65 and lower the cap to 4 (most churn attempts happen between 0.65-0.78), re-measure the
stage cost, then re-run the sweep + judge before considering a default. The flag also lets operators use it on
credit/title-heavy chapters where the OCR wins are largest.