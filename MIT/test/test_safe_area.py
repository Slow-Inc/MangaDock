"""Safe-area interior box (#179, PRD #178 render parity).

To wrap English into a narrow column that mirrors the original Japanese
footprint, the renderer must wrap to the balloon's *measured interior* — not its
bounding box. `safe_area_box` ports MangaTranslator's distance-transform +
pole-of-inaccessibility anchor (image_utils.py:173-348): the largest centered
box that fits the mask's safe interior, plus an anchor that avoids conjoined
balloon necks. Pure cv2/numpy, no ML/PIL — tested with synthetic masks.
"""
import re
from pathlib import Path

import numpy as np

from manga_translator.safe_area import safe_area_box


def test_safe_area_is_wired_for_narrow_column_render():
    """Source-inspection (no GPU): the renderer wraps to the safe interior and the
    balloon polygon is carried through tagging + crop-shift."""
    base = Path(__file__).parent.parent / 'manga_translator'
    rnd = (base / 'rendering' / '__init__.py').read_text(encoding='utf-8')
    assert 'safe_area_box' in rnd
    assert '_bubble_interior_box' in rnd
    mt = (base / 'manga_translator.py').read_text(encoding='utf-8')
    assert 'bubble_polygon' in mt   # carried in tagging (_tag_regions_with_bubbles)
    # #187 S24a moved _build_local_region's crop-coord shift into patch_geometry.py
    pg = (base / 'patch_geometry.py').read_text(encoding='utf-8')
    assert len(re.findall(r'bubble_polygon', pg)) >= 2   # getattr + shifted reassignment


def test_render_parity_knobs_are_wired():
    """Source-inspection: #176 comic font, #181 supersampling, #183 dst clamp."""
    base = Path(__file__).parent.parent / 'manga_translator'
    cfg = (base / 'config.py').read_text(encoding='utf-8')
    assert re.search(r'en_comic_font:\s*bool\s*=\s*False', cfg)   # #176 opt-in
    assert re.search(r'supersampling:\s*int\s*=\s*1', cfg)        # #181 default off
    mt = (base / 'manga_translator.py').read_text(encoding='utf-8')
    assert '_render_font_path' in mt and 'comic shanns' in mt     # #176 (font path stays in the driver)
    assert 'config.render.en_font' in mt                          # parity-B EN font override
    assert re.search(r'en_font:\s*Optional\[str\]\s*=\s*None', cfg)  # parity-B opt-in
    # #187 S15 moved the renderer dispatch (carrying the #181 supersampling kwarg) into stages.py
    stg = (base / 'stages.py').read_text(encoding='utf-8')
    assert 'supersampling=config.render.supersampling' in stg     # #181 threaded
    rnd = (base / 'rendering' / '__init__.py').read_text(encoding='utf-8')
    assert 'supersampling' in rnd and 'INTER_AREA' in rnd         # #181 downscale seam
    assert 'np.clip(' in rnd                                      # #183 bounds clamp


def test_en_uppercase_lettering_is_wired():
    """Render-parity A: the Backend MIT_EN_UPPERCASE knob is a no-op unless the
    MIT pipeline still uppercases region.translation when render.uppercase is set
    (manga_translator.py — mirrors MangaTranslator pipeline.py:1375 `text.upper()`)."""
    base = Path(__file__).parent.parent / 'manga_translator'
    # #187 seam S2 moved the casing out of manga_translator.py into region_apply.py
    # (apply_render_casing); manga_translator triggers it via apply_casing=True.
    mt = (base / 'manga_translator.py').read_text(encoding='utf-8')
    assert 'apply_casing=True' in mt                               # single-page path wires it
    ra = (base / 'region_apply.py').read_text(encoding='utf-8')
    assert re.search(r'if\s+config\.render\.uppercase\s*:', ra)
    assert '.upper()' in ra
    cfg = (base / 'config.py').read_text(encoding='utf-8')
    assert re.search(r'uppercase:\s*bool\s*=\s*False', cfg)        # opt-in default


def _canvas(h, w):
    return np.zeros((h, w), dtype=np.uint8)


def test_centered_rectangle_anchor_is_near_center():
    m = _canvas(120, 120)
    m[20:100, 20:100] = 1  # 80x80 centered
    w, h, (ax, ay) = safe_area_box(m, padding=5)
    assert 55 <= ax <= 65 and 55 <= ay <= 65   # anchor ~ center (60,60)
    assert w > 0 and h > 0
    assert w <= 80 and h <= 80                  # never exceeds the shape


def test_tall_narrow_mask_yields_narrow_interior_width():
    m = _canvas(120, 120)
    m[20:100, 50:70] = 1   # 20 wide, 80 tall column
    w, h, _ = safe_area_box(m, padding=2)
    assert w < h           # interior is narrow — the whole point for narrow columns


def test_empty_mask_is_degenerate_safe():
    w, h, anchor = safe_area_box(_canvas(40, 40), padding=5)
    assert (w, h) == (0, 0)


def test_conjoined_neck_anchor_moves_into_a_lobe_not_the_neck():
    # two 40x40 lobes joined by a thin 4px neck. The geometric centroid sits in
    # the neck (low distance) → pole-of-inaccessibility must move the anchor into
    # a lobe, not the middle (x≈70).
    m = _canvas(80, 140)
    m[20:60, 10:50] = 1     # left lobe
    m[20:60, 90:130] = 1    # right lobe
    m[38:42, 50:90] = 1     # thin neck bridging them
    _, _, (ax, _ay) = safe_area_box(m, padding=5)
    assert abs(ax - 70) > 25   # anchor is in a lobe (~30 or ~110), not the neck
