# JP→TH render quality: vertical sources squeeze Thai to ~50% font (measured), concise does not fix it

- **Date:** 2026-10-23 · **Issue:** #1006 (the follow-up experiment) · **Data:** HEAD live runs + the two real
  uploaded JP pages.

## Font-size audit (216 live regions with font data)

| ratio (rendered / source font) | regions |
|---|---|
| >=1.0 (equal or upscaled) | 176 |
| 0.8-0.99 | 23 |
| <0.8 | 17 |
| **<=0.6** | **3** — all JP vertical-source regions |

Worst: `result/jp/jp_chapter_p1.jpg` region #5 at **20 px from a 40 px source (0.50)**; p0 #5 20-24 px
(0.50-0.60). Render metrics stay clean (overlap / spill / small_font = 0), so the text fits — at half size, at
the font floor.

## Can `concise_bubbles` fix it? No (measured)

Ran the two JP pages with `--set translator.concise_bubbles=true`:

| page | chars | worst region font |
|---|---|---|
| p1 baseline | 185 | 20/40 |
| p1 concise | **162 (-12 %)** | **20/40 (unchanged — floor)** |
| p0 baseline | 177 | 24/40 |
| p0 concise | 176 | **20/40 (smaller)** |

The floor-bound region cannot improve by shortening (it is already at the minimum), and the other page's worst
region got smaller because the shorter line changed the wrap. Verdict: **concise stays opt-in**, and the real
lever is the layout, not the translation length.

## Next (issue #1006)

Opt-in `render.widen_vertical_columns`: for a vertical-source region rendered to a horizontal-only target whose
font is at the floor, allow the wrap width to grow toward the bubble interior (cap 1.5x the source column) —
fewer, longer lines -> larger font. Acceptance: >=15 % font gain on the worst JP regions, overlap/spill stay 0,
EN renders byte-identical, verified with a deterministic replay of the JP pages.