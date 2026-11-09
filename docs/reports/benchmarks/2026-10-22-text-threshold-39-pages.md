# `detector.text_threshold` 0.3 over 39 pages — recovers credits and dialogue, but rewrites line structure everywhere

- **Date:** 2026-10-22 · **Issue:** #883 · **Arms:** replay, `ocr.vlm_rescue=0`, same dumps; A = default 0.5, B = 0.3.
- **Why:** the leftover English credits on Chainsaw p0 are lines the detector never finds; 0.3 recovers them on that
  page. This measures what else 0.3 changes across the corpus before touching a default.

## Result — 39 pages

| | A = 0.5 | B = 0.3 |
|---|---|---|
| pages whose textline count changed | — | **20 / 39** (4 more lines, 16 fewer) |
| region source texts changed | — | **134** (mostly OCR reads shifting with the boxes) |

**Genuinely new text at 0.3:**

| kind | examples |
|---|---|
| credits recovered | Chainsaw p0 whole `NOTICE:` paragraph, Chainsaw p1 line, Otome author/manga credits, Tsuki `原作…` |
| dialogue recovered | Kumo p1 `BUT I AM HERE, RIGHT NOW`; Mieruko p0/p1 lines |
| CJK art glyphs newly detected | `ザ`, `平ク`, `ベ`, `才`, `刀`, `禁` (the #886 glyph guard drops the large ones) |

## Decision: keep 0.5 as the default

Lowering the threshold is not a pure recall win — it changes detected line structure on 20/39 pages and re-reads
every region whose box shifts (134 source texts). Some of the new boxes are art glyphs, some are credits that
arguably should stay in English. That is a real tradeoff, so by the goal's rule it stays **non-default**:
`detector.text_threshold` is already a config knob (`--set detector.text_threshold=0.3`) for anyone who wants
maximum recall, and this benchmark records what it costs.

## What this leaves open on #883

The visible leftover English on Chainsaw p0 is unchanged at the default. Our read: those are watermark/credit
lines and leaving them is acceptable; the overlapping Thai half of #883 is fixed by the opt-in `fit_below_floor`.
