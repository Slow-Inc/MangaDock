"""SAM 2.1 glyph-mask refinement (#1143 Track A4), torch-free parts.

The SAM call itself runs on a GPU in the worker; what decides whether the result may replace the textline mask is
pure, and that is what these tests pin: click points from the seed's components, clipping to the seed, and the
area band that catches both "SAM missed the letters" and "a click grabbed a character".
"""
import numpy as np

from manga_translator.glyph_mask import accept_refined, glyph_mask_enabled, restrict_masks, sample_points


def _mask(coords, shape=(60, 80)):
    m = np.zeros(shape, np.uint8)
    for x, y in coords:
        m[y, x] = 255
    return m


def test_the_switch_is_opt_in(monkeypatch):
    monkeypatch.delenv('MIT_GLYPH_MASK', raising=False)
    assert glyph_mask_enabled() is False
    for on in ('1', 'true', 'YES', 'on'):
        monkeypatch.setenv('MIT_GLYPH_MASK', on)
        assert glyph_mask_enabled() is True, on
    monkeypatch.setenv('MIT_GLYPH_MASK', '0')
    assert glyph_mask_enabled() is False


def test_one_point_per_letter_cluster():
    m = np.zeros((60, 80), np.uint8)
    m[10:14, 10:14] = 255      # a small block
    m[30:40, 40:60] = 255      # a bigger one
    m[1, 1] = 255              # a speck, below the area floor
    pts = sample_points(m, min_component_area=12)
    assert len(pts) == 2
    assert all(0 <= x < 80 and 0 <= y < 60 for x, y in pts)


def test_an_empty_seed_asks_nothing():
    assert sample_points(np.zeros((10, 10), np.uint8)) == []


def test_sam_masks_are_clipped_to_the_seed():
    seed = np.zeros((40, 40), np.uint8)
    seed[18:22, 18:22] = 255
    runaway = np.zeros((40, 40), bool)
    runaway[:, :] = True                      # a click that grabbed the whole page
    refined = restrict_masks([runaway], seed, dilate_px=2)
    assert refined.dtype == np.uint8 and refined.max() == 255
    assert (refined > 0).sum() < 40 * 40 / 4   # clipped hard, not the whole frame
    assert (refined[seed > 0] > 0).all()       # and it still covers the seed


def test_the_area_band_rejects_both_under_and_over_masking():
    seed = np.zeros((40, 40), np.uint8)
    seed[10:30, 10:30] = 255                    # 400 px
    tiny = np.zeros_like(seed)
    tiny[10:14, 10:14] = 255                    # 16 px: SAM missed most letters
    huge = np.zeros_like(seed)
    huge[:, :] = 255                            # the whole frame
    ok = np.zeros_like(seed)
    ok[12:28, 12:28] = 255                      # 256 px: a glyph-plausible share
    assert accept_refined(ok, seed) is True
    assert accept_refined(tiny, seed) is False
    assert accept_refined(huge, seed) is False
    assert accept_refined(None, seed) is False
