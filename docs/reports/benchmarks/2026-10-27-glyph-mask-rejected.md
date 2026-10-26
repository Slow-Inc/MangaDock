# SAM 2.1 glyph-accurate erase mask — implemented, measured, rejected (MIT_GLYPH_MASK, off)

**Idea (PRD Track A4).** MIT's erase mask comes from textline polygons, so inpainting repaints everything inside a
line box. On Haimiya ch. 6 p2 the hand-lettered `HUH ... ?` sits on hair with hand-drawn motion strokes beside it;
SAM 2.1 segments a hand-drawn letter exactly from one click (round 3), so a glyph mask should erase the letters
and leave the art between them.

**What was built.** `manga_translator/glyph_mask.py` (pure parts + a lazy SAM 2.1 loader) and a seam in
`_finish_patches` right before the full-page inpaint: sample one click per connected component of the seed mask,
run SAM 2.1 once with all points, grow each returned mask, clip to a small dilation of the seed, and replace the
seed only when the refined area stays within 0.35–1.5× of it. Opt-in (`MIT_GLYPH_MASK=1`), fails open. Five
torch-free tests cover the points, the clipping and the area band.

**Measured on the failing case** (p2, the HUH region; seed mask 64,159 px):

| grow px | refined mask | result |
|---|---|---|
| 4 | 33,661 px (52 % of seed) | the English letters **stayed visible** under the Thai |
| 8 | 45,262 px (71 % of seed) | still visible — cleaned around the glyphs, not on them |
| — | seed (today) | erased cleanly |

**Why it fails, and why that is a finding.** SAM 2.1 segments the *fill* of a letter stroke; hand-lettered manga
type is a white fill with a thick black outline, and the erase mask has to cover fill + outline + anti-aliasing.
The refined mask is smaller than the seed by construction (it is clipped to it), so every part SAM did not segment
— the outline, the strokes' edges — stays un-erased and the source lettering shows through. The conservative fix
is a union with the seed, which erases at least as much as today and therefore has no art benefit.

**Conclusion:** keep the flag off. Art preservation cannot come from *shrinking* the erase mask for this kind of
lettering; it has to come from compositing the figure back after repair (the PRD's layered compositing), which is
the next A4 step. The module and its tests stay in the tree behind the off-by-default flag so that step can reuse
the SAM loading and mask geometry.

**Limits:** one page, one lettering style (white fill, black outline, large hand-lettering); small printed text
was not tested (SAM may behave differently there).
