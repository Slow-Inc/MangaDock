# ADR 027 — Content-shaped patch alpha so overlapping balloons don't erase each other (#436)

- **Status:** Accepted (2026-07-01)
- **Issues:** #436 (overlapping speech-balloon text dropped).
- **Area:** MIT render/patch — `patch_geometry.py` (`content_alpha_inner`), `patch_renderer.py` (alpha build), `config.py` (`render.patch_content_alpha`).

## Context

Each translated region is composited onto the page as a **rectangular** PNG patch whose alpha is opaque over the whole crop (feathered only at the outer edge, #173). When two speech balloons overlap (a common art style — one balloon drawn partly over another), they are correctly kept as **separate** regions (different sentences; merging would concatenate them), and `anti_overlap` already places their text apart. But with `full_page_inpaint` every patch's crop carries the whole clean, text-erased page, so the balloon composited **last** repaints its opaque rectangle of clean background over the other balloon's text — the back balloon renders **empty** even though its text was translated and drawn. Decoding the patches confirmed both held their glyphs and overlapped 70%. The bug is an inconsistency: anti-overlap reasons at the text level, compositing at the rectangle level.

## Decision

Add `render.patch_content_alpha` (env `MIT_PATCH_CONTENT_ALPHA`, **default off → byte-identical**). When on, build each patch's alpha from its **own content footprint** instead of a full rectangle, via pure `content_alpha_inner(rendered, inpaint_before_text, own_mask)`:
- **new glyphs** = `|rendered − inpaint|` (the inpaint has no text, so this isolates the glyphs this patch drew) — must diff against the **inpaint**, not the original, or it would re-mark the neighbour's erased text and re-occlude it;
- **∪ own_mask** = this group's text-only mask (its own original ink to hide);
- dilated, then fed to the existing `feather_alpha`.

The patch is then opaque only over what it changed and transparent everywhere else, so an overlapping neighbour's text survives. A clean `inpaint_before_text` copy is snapshotted before rendering (rendering mutates `img_rgb`, which aliases `img_inpainted`).

## Consequences

- **Positive:** overlapping balloons render all their text (#436); incidentally, a balloon clipped behind a neighbour (page 4 bubble-2) also recovered. Complements `anti_overlap` rather than replacing it.
- **Validated (visual, per verify-before-claiming):** `docs/reports/benchmarks/2026-07-01-overlap-content-alpha.md` — page 11 both balloons render; pages 4/9 no regression. `test_patch_geometry`+`test_patch_renderer` 37/0 (5 new `content_alpha_inner` cases incl. the "does not mark neighbour-erased text" regression guard). Two bugs were caught **only** by viewing the render (neighbour-erase re-occlusion; in-place-mutation → all-English transparent patches), not by tests — pinned as tests afterward.
- **Limit:** true glyph-on-glyph overlap (two texts on the exact same pixels) still needs anti-overlap text re-placement — separate lever. The common distinct-lobe overlap is fixed.
- **Reversibility:** knob off → full-rectangle feathered patch, byte-identical. Pure helper; no model/threshold tuning beyond `threshold=12`/`dilate=8`.
- **Activation:** Backend must pass `render.patch_content_alpha=true` (buildMitConfig / `MIT_PATCH_CONTENT_ALPHA`) for the reader to use it.

## Addendum (2026-07-01) — anti-overlap territory = the text's real footprint, not the whole balloon

Characterization (RouteProbe on Gal Yome p11) showed the overlapping **back** balloon was already
bubble-fit (rw/bw 0.78, fills) but rendered small: `anti_overlap` clamped its fit box against the
**front** balloon's territory, and `_region_territory` returned the front's whole *balloon* box —
even though the front was a clean-layout narration column filling only ~40% of it (rw/bw 0.40). So
the back balloon could only fit the small leftover crescent.

**Refinement:** pure `region_territory_box(rx, ..., bubble_box)` — a region reserves its **balloon**
only when its text FILLS it (`fills_bubble_width`); otherwise just its own narrow **text box**.
`_region_territory` delegates. A narration column no longer reserves the whole balloon, so an
overlapping neighbour's bubble-fit grows into the balloon's empty area (safe now that patches are
content-shaped, this ADR). +3 `test_render_overlap` cases (narrow→text box / filling→balloon /
no-balloon→text box); render_overlap 44/0. Verified on p11 (back balloon sizes to its real space,
no collision) + p4/p9 (no regression). Reversible: revert `region_territory_box` to "balloon if
present else text box".
