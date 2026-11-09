# SAM 2.1 as a foreground/glyph mask source — sweep round 3

**Question (PRD Track C, "Foreground masks: protect_figures heuristics → SAM 2.1 proposals, tuned for line
art"):** can SAM 2.1 give MIT masks good enough to replace the rectangular erase/patch geometry?

**Setup:** `ultralytics` 8.4.61 (already in the MIT venv) + `sam2.1_b.pt` (154 MB, downloaded from the
ultralytics asset release), GPU, page 2 of Haimiya ch. 6 (a hand-lettered `HUH ... ?` over hair and screentone,
plus two characters).

**It segments line art precisely.** Point prompts (one click each) returned:

| prompt | mask area | what it captured |
|---|---|---|
| middle of the "H" of HUH | 4,336 px | **exactly that hand-drawn letter**, including its slanted outline |
| the "U" | 4,264 px | exactly the letter |
| the second "H" | 4,987 px | exactly the letter |
| the hooded girl | 122,516 px (7.7 % of page) | her hood + jacket, following the drawn silhouette |
| the boy's hair | 188,161 px | the hair region including its screentone |

Speed after warm-up: **0.09–0.10 s per prompt** (1.1–1.5 s for the first), model 154 MB of VRAM.

**Why this matters more than a "better figure box":** the letters of `HUH` occupy ~13.6k px inside a
195×571 px region box (111k px). A rectangular patch has to repaint ~8× the lettering area, which is exactly why
the motion strokes and hair beside the text got erased in the inpainting comparison. A SAM2 glyph mask — or the
union of a few, one per connected component of the current text mask — erases only the ink that is actually
lettering, and a figure mask lets the source pixels be composited back on top (the PRD's "layered compositing").

**What is missing before it can be adopted**
1. **A proposal step.** This ultralytics build has no automatic mask generator (`SAM2AutomaticMaskGenerator` is
   gone; `ultralytics.models.sam.amg` exposes only the internal `Generator`). Proposals must come from prompts:
   either a grid of points (~140 prompts ≈ 13 s/page) or one point per connected component of the existing text
   mask (one prompt per glyph — the more useful direction).
2. **An integration point.** Today the erase mask is built from textline polygons + dilation
   (`patch_geometry.assemble_fullpage_erase_mask` / `protect_figure_ink`). Swapping in SAM2 masks is a Track A4
   change (erase only visible glyphs + composite foreground back), not a model swap.
3. **An evaluation.** The metric is art preservation under erased text: compare rendered patches with the current
   mask vs the glyph mask on pages where text sits over hair/screentone/motion lines.

**Verdict:** technically the strongest candidate tested so far for the *art* side of quality, and the masks are
good enough to build the Track A4 seam on. Not adopted this round — it needs a proposal step and an integration
seam, not a config flag.

**Gotchas**
- `sam2.1_b.pt` downloads on first use; keep it beside the other MIT weights if adopted.
- A prompt on background returned 47.8 % of the page (the white wall) — the model follows what you click, so
  proposals must be anchored to text/figure evidence, not sprayed blindly.
