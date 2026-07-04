"""Pure patch-render geometry helpers (#187 seam S24a).

`build_local_region` / `create_text_only_mask` / `crop_mask_for_patch` are the
three `self`-free numpy/cv2 helpers lifted out of `translate_patches`' per-group
patch path. They are deterministic pixel/coordinate math, so these golden cases
pin them exactly — the extraction is byte-identical. No ML stack is imported.
"""
import copy

import numpy as np

import manga_translator.patch_geometry as pg


class FakeRegion:
    """Minimal stand-in for TextBlock — only the attrs the helpers touch."""
    def __init__(self, **attrs):
        for k, v in attrs.items():
            setattr(self, k, v)


# ---- build_local_region: deepcopy + shift into crop coords + clear caches -----

def test_build_local_region_shifts_lines_bubble_and_clears_cache():
    region = FakeRegion(
        lines=[[[100, 200], [150, 200], [150, 240], [100, 240]]],
        bubble_box=(90, 190, 160, 250),
        bubble_polygon=[(90, 190), (160, 190), (160, 250)],
        xyxy=(100, 200, 150, 240),   # a cached prop that must be dropped
        _bounding_rect="STALE",
    )
    out = pg.build_local_region(region, 100, 200)

    assert out.lines.tolist() == [[[0, 0], [50, 0], [50, 40], [0, 40]]]
    assert out.lines.dtype == np.int32
    assert out._bounding_rect is None                       # cache invalidated
    assert out.bubble_box == (-10, -10, 60, 50)             # shifted by (-100,-200)
    assert out.bubble_polygon == [(-10, -10), (60, -10), (60, 50)]
    assert 'xyxy' not in out.__dict__                       # cached prop popped
    # original is untouched — deepcopy, not mutate-in-place
    assert region.lines == [[[100, 200], [150, 200], [150, 240], [100, 240]]]


def test_build_local_region_handles_missing_bubble_fields():
    region = FakeRegion(lines=[[[5, 5], [10, 5], [10, 10]]])
    out = pg.build_local_region(region, 5, 5)
    assert out.lines.tolist() == [[[0, 0], [5, 0], [5, 5]]]
    assert not hasattr(out, 'bubble_box')                   # None branch: nothing added


# ---- create_text_only_mask: fillPoly/rectangle + adaptive dilate -------------

def test_create_text_only_mask_fills_line_polys_and_dilates():
    region = FakeRegion(lines=[[[10, 10], [40, 10], [40, 40], [10, 40]]], font_size=20)
    mask = pg.create_text_only_mask(60, 60, [region])

    assert mask.shape == (60, 60)
    assert mask.dtype == np.uint8
    assert set(np.unique(mask)).issubset({0, 255})          # binary mask
    assert mask[25, 25] == 255                               # interior filled
    assert mask[8, 25] == 255                                # dilation grew past the box top (10)


def test_create_text_only_mask_falls_back_to_xyxy_when_no_lines():
    region = FakeRegion(xyxy=(10, 10, 40, 40))               # no `lines` attr
    mask = pg.create_text_only_mask(60, 60, [region])
    assert mask[25, 25] == 255


# ---- crop_mask_for_patch: same-size vs scaled, 3ch→gray, OOB → zeros ----------

def test_crop_mask_same_size_crops_and_binarizes():
    raw = np.zeros((100, 100), np.uint8)
    raw[20:60, 30:70] = 137                                  # non-255 nonzero
    out = pg.crop_mask_for_patch(raw, 30, 20, 70, 60, 100, 100)
    assert out.shape == (40, 40)
    assert out.dtype == np.uint8
    assert set(np.unique(out)).issubset({0, 255})
    assert out[5, 5] == 255                                  # 137 → binarized to 255


def test_crop_mask_scales_coords_when_mask_differs_from_image():
    raw = np.full((50, 50), 200, np.uint8)                   # half-res mask
    out = pg.crop_mask_for_patch(raw, 0, 0, 100, 100, 100, 100)
    assert out.shape == (100, 100)                           # resized back to crop size
    assert out[50, 50] == 255


def test_crop_mask_upscale_uses_nearest_not_bilinear():
    """#248: a half-res binary mask upscaled to the crop must use INTER_NEAREST.
    Bilinear bleeds an isolated 255 into a gradient that the `> 0` re-binarize
    fattens (a 2x upscale lights 16 px vs nearest's 4) — that extra ring is what
    makes LaMa over-erase. One isolated source pixel → exactly the 2x2 block."""
    raw = np.zeros((50, 50), np.uint8)
    raw[25, 25] = 255
    out = pg.crop_mask_for_patch(raw, 0, 0, 100, 100, 100, 100)
    assert out.shape == (100, 100)
    assert int((out > 0).sum()) == 4                         # nearest = 4; bilinear would = 16


def test_crop_mask_converts_3channel_to_gray():
    raw = np.zeros((20, 20, 3), np.uint8)
    raw[:, :, 2] = 255                                       # nonzero after BGR2GRAY
    out = pg.crop_mask_for_patch(raw, 0, 0, 20, 20, 20, 20)
    assert out.ndim == 2
    assert out[10, 10] == 255


def test_crop_mask_out_of_bounds_returns_zeros():
    raw = np.full((100, 100), 255, np.uint8)
    out = pg.crop_mask_for_patch(raw, 200, 200, 250, 250, 100, 100)
    assert out.shape == (50, 50)
    assert out.max() == 0                                    # nothing in range → all-zero


# ---- union_refined_with_fallback: tame the halo (#248) ------------------------

def test_union_keeps_tight_refined_and_drops_the_text_only_halo():
    """#248: where CRF refinement covered a glyph, keep ONLY the tight mask — do
    NOT OR the dilated text_only halo on top (the old cv2.max), so LaMa stops
    erasing a fat ring of clean background around the glyph."""
    refined = np.zeros((20, 20), np.uint8)
    refined[8:12, 8:12] = 255                                # tight CRF glyph stroke
    text_only = np.zeros((20, 20), np.uint8)
    text_only[5:15, 5:15] = 255                              # fat dilated halo over the same glyph

    out = pg.union_refined_with_fallback(refined, text_only)

    assert out.shape == (20, 20)
    assert out.dtype == np.uint8
    assert set(np.unique(out)).issubset({0, 255})
    assert out[10, 10] == 255                                # refined glyph kept
    assert out[6, 6] == 0                                    # halo NOT painted (cv2.max would = 255)
    assert int((out > 0).sum()) == 16                        # exactly the 4x4 refined blob, no halo


def test_page_scaled_font_min_uses_page_dims_over_crop_floor():
    """#250: the render font floor must come from the full PAGE (h+w)/200, not the
    small patch crop (which yields an unreadable ~3-4px on the fallback path)."""
    assert pg.page_scaled_font_min(2000, 1400, -1) == 17     # round((2000+1400)/200)


def test_page_scaled_font_min_keeps_a_larger_explicit_override():
    """An explicit override already above the page floor is preserved."""
    assert pg.page_scaled_font_min(2000, 1400, 30) == 30


def test_feather_alpha_interior_opaque_edge_fades_to_zero():
    """#173: distance-transform alpha ramp — content stays opaque, the patch fades
    to transparent over `radius` px outside the content so the rectangular seam
    blends into the page instead of showing a hard edge."""
    content = np.zeros((40, 40), np.uint8)
    content[15:25, 15:25] = 255
    a = pg.feather_alpha(content, radius=8)
    assert a.shape == (40, 40)
    assert a.dtype == np.uint8
    assert a[20, 20] == 255                          # interior opaque
    assert a[3, 20] == 0                             # >radius outside content → transparent
    assert 0 < a[10, 20] < 255                       # within the band → partial blend


def test_expand_inpaint_crop_interior_pads_all_sides():
    """#249: a render rect well inside the page expands by `pad` on every side; the
    returned (ox, oy) is where the render rect sits inside the larger inpaint crop."""
    ix1, iy1, ix2, iy2, ox, oy = pg.expand_inpaint_crop(300, 320, 400, 420, 1000, 1000, pad=256)
    assert (ix1, iy1, ix2, iy2) == (44, 64, 656, 676)
    assert (ox, oy) == (256, 256)


def test_expand_inpaint_crop_clamps_at_image_edges():
    """Near an edge the crop clamps to the image and (ox, oy) shrinks to the
    available margin, so the slice-back still lands on the render rect."""
    ix1, iy1, ix2, iy2, ox, oy = pg.expand_inpaint_crop(10, 30, 200, 250, 1000, 1000, pad=256)
    assert (ix1, iy1) == (0, 0)
    assert (ix2, iy2) == (456, 506)
    assert (ox, oy) == (10, 30)


def test_feather_alpha_radius_zero_is_hard_alpha():
    """radius 0 → no ramp: opaque exactly on content, transparent elsewhere (the
    byte-identical hard-alpha fallback)."""
    content = np.zeros((10, 10), np.uint8)
    content[3:7, 3:7] = 200                          # nonzero but not 255
    a = pg.feather_alpha(content, radius=0)
    assert set(np.unique(a)).issubset({0, 255})      # no intermediate values
    assert a[5, 5] == 255                            # content → opaque
    assert a[0, 0] == 0                              # background → transparent


def test_tighten_text_mask_shrinks_to_the_strokes_within_the_box():
    """A coarse box mask over text leaves LaMa to repaint the whole rectangle (a big band).
    Tightening keeps only the actual ink strokes (local-contrast pixels) + a small dilation,
    clipped to the box, so LaMa fills thin strokes and the original art between them survives."""
    crop = np.full((40, 40, 3), 200, np.uint8)      # light background
    crop[10:30, 18:22] = 30                          # a dark vertical ink stroke
    coarse = np.zeros((40, 40), np.uint8)
    coarse[8:32, 8:32] = 255                         # coarse box covering the stroke + bg
    tight = pg.tighten_text_mask(crop, coarse, dilate=2, contrast=40)
    tb, cb = tight > 127, coarse > 127
    assert tb.sum() < 0.5 * cb.sum()                 # much tighter than the box
    assert tb[20, 20]                                # the stroke is covered
    assert not tb[9, 9]                              # the empty corner is freed
    assert int((tb & ~cb).sum()) == 0                # never exceeds the original box


def test_seamless_blend_matches_region_to_surround_and_guards_border():
    """Poisson seamless-clone re-integrates the inpainted region from the original's boundary
    gradients → the DC brightness band vanishes; a border-touching mask is guarded (no
    cv2.seamlessClone assert) and returns the input."""
    bg = np.full((60, 60, 3), 130, np.uint8)
    inp = bg.copy(); inp[20:40, 20:40] = 100         # masked region 30 too dark
    mask = np.zeros((60, 60), np.uint8); mask[20:40, 20:40] = 255
    out = pg.seamless_blend_inpaint(inp, bg, mask)
    assert abs(out[25:35, 25:35].mean() - 130) < 8   # region pulled to the surround
    bm = np.zeros((60, 60), np.uint8); bm[0:20, 0:20] = 255   # touches the border
    out2 = pg.seamless_blend_inpaint(inp, bg, bm)
    assert out2.shape == inp.shape                    # guarded, no crash


def test_tighten_text_mask_falls_back_when_no_strokes_found():
    """If contrast finds (almost) no strokes inside the box, return the coarse mask unchanged
    rather than leaving source text unmasked."""
    crop = np.full((40, 40, 3), 128, np.uint8)       # flat — no strokes to find
    coarse = np.zeros((40, 40), np.uint8); coarse[8:32, 8:32] = 255
    out = pg.tighten_text_mask(crop, coarse, contrast=40)
    assert np.array_equal(out > 127, coarse > 127)   # safe fallback


def test_reground_pulls_masked_luminance_to_local_surround_bidirectional():
    """The make-or-break: a flat LaMa fill that is too LIGHT over dark hair AND too DARK
    over the lighter cheek -- in ONE mask -- must be pulled toward each pixel's OWN local
    surround in a single pass (the bidirectional band the reverted #266 couldn't fix). A
    vertical 'text column' mask straddles a hair (top, L~100) / cheek (bottom, L~220)
    split; after re-ground the masked pixels flanked by hair drop toward 100 and those
    flanked by cheek rise toward 220."""
    h = w = 64
    bg = np.empty((h, w, 3), np.uint8)
    bg[:32] = 100                                   # hair (dark) — top
    bg[32:] = 140                                   # cheek (lighter) — bottom
    inpainted = bg.copy()
    mask = np.zeros((h, w), np.uint8)
    mask[:, 24:40] = 255                            # central vertical column over both
    inpainted[mask > 0] = 120                       # LaMa flat fill: +20 over hair, -20 over cheek
    out = pg.reground_inpaint_luminance(inpainted, bg, mask, radius_frac=0.18, strength=1.0)
    # sample masked blocks well away from the hair/cheek boundary (near it the correction
    # ramps between the two surrounds — the desired smooth behaviour, not a test target)
    hair_block = out[4:20, 24:40].mean()            # masked, flanked by hair
    cheek_block = out[44:60, 24:40].mean()          # masked, flanked by cheek
    assert abs(hair_block - 100) < 5, hair_block    # was 120 (too light) -> ~100
    assert abs(cheek_block - 140) < 5, cheek_block  # was 120 (too dark) -> ~140
    assert np.array_equal(out[mask == 0], bg[mask == 0])   # outside mask untouched


def test_reground_uniform_background_collapses_to_a_scalar_offset():
    """On a single-background crop the per-pixel field degenerates to one offset (≡ a plain
    mean match / histogram-match), so the masked fill is pulled to within 1 L of the surround."""
    bg = np.full((48, 48, 3), 130, np.uint8)
    inpainted = bg.copy()
    mask = np.zeros((48, 48), np.uint8)
    mask[16:32, 16:32] = 255
    inpainted[mask > 0] = 112                        # flat fill, 18 too dark (the measured band)
    out = pg.reground_inpaint_luminance(inpainted, bg, mask, radius_frac=0.25, strength=1.0)
    assert abs(out[20:28, 20:28].mean() - 130) < 1   # masked interior pulled to the surround


def test_reground_coverage_guard_skips_when_too_little_surround():
    """A near-fully-masked crop (huge SFX) has no surround to ground against → return the
    input unchanged rather than grounding to noise."""
    bg = np.full((40, 40, 3), 90, np.uint8)
    inpainted = bg.copy()
    mask = np.full((40, 40), 255, np.uint8)          # ~100% masked → valid ratio < 0.15
    inpainted[:] = 150
    out = pg.reground_inpaint_luminance(inpainted, bg, mask, strength=1.0)
    assert np.array_equal(out, inpainted)            # unchanged


def test_reground_strength_zero_and_grayscale_safety():
    """strength=0 → byte-identical input; a grayscale crop stays grayscale (no chroma tint)."""
    bg = np.full((48, 48, 3), 120, np.uint8)
    inpainted = bg.copy(); inpainted[16:32, 16:32] = 100
    mask = np.zeros((48, 48), np.uint8); mask[16:32, 16:32] = 255
    assert np.array_equal(
        pg.reground_inpaint_luminance(inpainted, bg, mask, strength=0.0), inpainted)
    out = pg.reground_inpaint_luminance(inpainted, bg, mask, radius_frac=0.25, strength=1.0)
    assert np.array_equal(out[..., 0], out[..., 1]) and np.array_equal(out[..., 1], out[..., 2])


def test_union_falls_back_to_text_only_where_refinement_missed_a_region():
    """A text component the CRF dropped entirely (no overlap) is still covered by
    text_only — no leftover-text residue."""
    refined = np.zeros((20, 20), np.uint8)
    refined[8:12, 8:12] = 255                                # covers ONE glyph
    text_only = np.zeros((20, 20), np.uint8)
    text_only[8:12, 8:12] = 255                              # same glyph (overlaps refined)
    text_only[2:4, 2:4] = 255                                # a SECOND glyph CRF missed

    out = pg.union_refined_with_fallback(refined, text_only)

    assert out[10, 10] == 255                                # refined-covered glyph
    assert out[3, 3] == 255                                  # missed glyph rescued via text_only fallback


# ---- restrict_mask_to_render_regions: the #535 empty-bubble erase-mask guard ----
# The refined erase mask may never cover text strokes that this patch will not
# re-render (a dropped region / another group's region inside the crop) — that
# erase-without-render is the "white empty bubble" defect. The guard intersects
# the erase mask with the allowed (to-be-rendered) region mask, plus a small
# dilation margin so legitimate refinement spill around a rendered glyph survives.

def test_restrict_mask_keeps_erase_inside_allowed_regions():
    mask = np.zeros((40, 40), np.uint8)
    mask[5:15, 5:15] = 255      # erase over a rendered region  → must survive
    mask[25:35, 25:35] = 255    # erase over a NON-rendered area → must be dropped
    allowed = np.zeros((40, 40), np.uint8)
    allowed[5:15, 5:15] = 255

    out = pg.restrict_mask_to_render_regions(mask, allowed, margin=0)

    assert out[10, 10] == 255                    # inside allowed: kept
    assert out[30, 30] == 0                      # outside allowed: guarded away
    assert mask[30, 30] == 255                   # input not mutated


def test_restrict_mask_margin_tolerates_refinement_spill():
    mask = np.zeros((40, 40), np.uint8)
    mask[10:20, 10:22] = 255    # refinement spills 2px right of the region
    allowed = np.zeros((40, 40), np.uint8)
    allowed[10:20, 10:20] = 255

    out = pg.restrict_mask_to_render_regions(mask, allowed, margin=3)

    assert out[15, 21] == 255                    # spill within margin: kept
    assert out.sum() == mask.sum()               # nothing legitimate lost


def test_restrict_mask_empty_allowed_erases_nothing():
    mask = np.full((10, 10), 255, np.uint8)
    allowed = np.zeros((10, 10), np.uint8)

    out = pg.restrict_mask_to_render_regions(mask, allowed, margin=2)

    assert out.sum() == 0                        # nothing rendered → nothing erased
