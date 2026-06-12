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
