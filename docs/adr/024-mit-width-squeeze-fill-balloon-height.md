# ADR 024 — Width-squeeze: narrow the wrap column to fill a tall balloon's height

- **Status:** Accepted (2026-06-30)
- **Issues:** #175 (bubble-fit sizing residual), #183 (squeeze — naming overlap, different mechanism), #434/#435 (source-agnostic wrap, the general path this stopgaps).
- **Area:** MIT render — `manga_translator/rendering/__init__.py` (`_bubble_fit_layout`), `manga_translator/render_overlap.py` (`squeeze_width`).
- **Builds on:** ADR 023 (bubble-area-fit on, bounded binary-search sizing).

## Context

After ADR 023 made balloon dialogue fill its balloon, a residual remained on **tall, not-wide** balloons. `_bubble_fit_layout` (renamed from `_bubble_fit_font_size`) picks the largest font whose word-wrapped translation fits the balloon safe-interior **without force-breaking a word**, then renders at the **full balloon width**. For a tall narrow-ish balloon this yields a few wide lines and a large vertical gap below — the font cannot grow further because growing it would force a mid-word break (rejected by the word-overflow guard).

Observed: Gal Yome no Himitsu EN ch1 p4 — "PEOPLE FROM OTHER DEPARTMENTS ARE WELCOME, DON'T YOU WANNA COME?" rendered as 2 wide lines occupying the top third of a tall balloon. User-flagged the same on Thai targets ("ตัวเล็กแค่ 2 บรรทัด ทั้งๆ ที่ประโยคยาว"). The original sets these as many narrow lines filling the whole balloon — MangaTranslator achieves this with a width-squeeze (`layout_engine.py`, ×0.90 per step) that trades column width for line count before reducing font size.

## Decision

Add a **width-squeeze** step to the bubble-fit path, as a pure function:

`squeeze_width(measure_h, full_w, min_w, box_h, factor=0.9)` — starting at the full balloon width, narrow the wrap column by `factor` each step; keep the narrowest width at which the wrapped block height still fits `box_h`; stop before the block would exceed `box_h`, or when the column reaches `min_w`. `min_w` is the longest unbreakable token's width at the chosen font (so squeezing never force-breaks a word).

`_bubble_fit_layout` now returns `(font_size, block_w, block_h)` — font is fit first (unchanged), then the column is squeezed at constant font; both bubble-fit callers (occupancy == 1 and > 1) centre the squeezed block in the balloon.

## Consequences

- **Positive:** a tall balloon's text gains lines and fills the balloon height (narrow tall column, like the original) instead of a few wide lines with empty space. Font is unchanged — the squeeze only redistributes width into height, so dialogue is never shrunk to achieve the fill.
- **Validated:** Gal Yome EN p4 tall balloon 2 wide lines → **6 narrow lines** filling height. One-Punch JA→EN benchmark — dialogue / narration ("THIS BRAT…") / SFX ("NYUU") **unchanged**. `clean_layout` and legacy paths untouched; render golden/guard suites **byte-identical**. `test_render_overlap.py` 36 tests green (+3 for `squeeze_width`: narrows-a-tall-box / noop-when-already-full / stops-at-floor).
- **No-op cases (by design):** text that already fills the height at full width → squeeze returns full width; a balloon whose longest word is nearly as wide as the balloon → `min_w ≈ full_w`, squeeze is a no-op (cannot narrow without breaking the word — correct).
- **Negative / residual:** the squeeze is scoped to dialogue that already fills a balloon (bubble-fit path). It does not address narration/captions or horizontal-source wrap generally — that is the source-agnostic, flag-gated, A/B-decided path in PRD #434 / research #435, which reuses `squeeze_width` as-is.
- **Reversibility:** `squeeze_width` is a pure helper invoked only inside `_bubble_fit_layout`; reverting that call restores ADR-023 full-width rendering. Paths outside bubble-fit are byte-identical.
