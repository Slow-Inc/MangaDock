"""Binary-search font sizing (#166, PRD #169 P2).

When a text region sits inside a known speech balloon (#170's bubble_box), pick
the *largest* font whose wrapped translation actually fits the balloon box —
measured by the renderer's own wrapper — instead of rendering at the tiny
crop-derived auto floor. The search itself is pure arithmetic over a
measure(size)->(block_w, block_h) callback, so it unit-tests with no PIL/fonts.
"""
import re
from pathlib import Path

from manga_translator.font_fit import fit_font_size, font_high_cap


def test_font_high_cap_scales_with_box_ratio():
    # Render-parity C: the binary-search ceiling = int(box_height * ratio), floored.
    # Our #175 cap of 0.5 keeps a short line in a big balloon from becoming a giant;
    # raising the ratio lets text fill the balloon like MangaTranslator does.
    assert font_high_cap(200, 0.5) == 100          # current default cap (#175)
    assert font_high_cap(200, 0.8) == 160          # parity-C: fuller fill
    assert font_high_cap(10, 0.5, floor=8) == 8    # never below the floor


def test_fit_picks_largest_font_that_fits_the_box():
    # block grows linearly with size: w=2·s, h=3·s. Box (20,30): fits iff s<=10.
    measure = lambda s: (s * 2, s * 3)
    assert fit_font_size((20, 30), measure, low=8, high=64) == 10


def test_fit_returns_high_cap_when_everything_fits():
    measure = lambda s: (1, 1)
    assert fit_font_size((1000, 1000), measure, low=8, high=16) == 16


def test_fit_returns_floor_when_even_the_smallest_overflows():
    # Nothing in [8,64] fits a 10x10 box → fall back to the floor, never invisible.
    measure = lambda s: (s * 100, s * 100)
    assert fit_font_size((10, 10), measure, low=8, high=64) == 8


def test_fit_includes_the_exact_boundary_size():
    # square block w=h=s, box 16x16 → 16 fits exactly and is the largest.
    measure = lambda s: (s, s)
    assert fit_font_size((16, 16), measure, low=8, high=64) == 16


def test_margin_leaves_a_safety_gap_so_text_does_not_touch_the_edge():
    # #175: fit to a fraction of the box so rounding/glyph slack can't clip.
    # block w=2s,h=3s, box (20,30): margin 1.0 → s<=10; margin 0.5 → s<=5.
    measure = lambda s: (s * 2, s * 3)
    assert fit_font_size((20, 30), measure, low=1, high=64, margin=1.0) == 10
    assert fit_font_size((20, 30), measure, low=1, high=64, margin=0.5) == 5


def test_margin_defaults_to_one_so_existing_callers_are_unchanged():
    measure = lambda s: (s, s)
    assert fit_font_size((16, 16), measure, low=8, high=64) == 16


def test_fit_is_a_no_op_path_when_box_height_caps_the_search():
    # tall narrow block: h=4·s dominates. Box (200, 40) → s<=10.
    measure = lambda s: (s, s * 4)
    assert fit_font_size((200, 40), measure, low=8, high=64) == 10


def test_binary_search_fit_is_wired_into_the_renderer():
    """Wiring check via source inspection (no GPU/models): the opt-in flag is
    unchanged, the renderer measures with calc_horizontal + fit_font_size against
    each region's bubble_box, and the patch path threads the flag through."""
    base = Path(__file__).parent.parent / 'manga_translator'

    cfg = (base / 'config.py').read_text(encoding='utf-8')
    assert re.search(r'bubble_area_fit:\s*bool\s*=\s*False', cfg)  # opt-in, off by default

    rnd = (base / 'rendering' / '__init__.py').read_text(encoding='utf-8')
    assert 'fit_font_size' in rnd              # uses the pure search
    assert 'bubble_fit' in rnd                 # threaded param
    assert 'bubble_box' in rnd                 # fits to the balloon box
    assert 'balloon_occupancy' in rnd          # sole-occupant gate (no stacking)
    assert 'occupancy[i] == 1' in rnd
    # #175: anti-overflow sizing — line-height estimate, fit margin, relative cap
    assert '_LINE_HEIGHT' in rnd
    assert '_FIT_MARGIN' in rnd
    assert '_MAX_FONT_BOX_RATIO' in rnd
    assert 'margin=' in rnd
    # Render-parity C: the fit ceiling is the pure helper, threaded from config.
    assert 'font_high_cap' in rnd
    assert 'font_max_box_ratio' in rnd
    assert re.search(r'font_max_box_ratio:\s*float\s*=\s*0\.5', cfg)  # opt-in default

    # #187 S24b moved the patch-path balloon-grow (the bubble_area_fit gate +
    # union_box crop expansion) out of translate_patches into patch_renderer.py.
    pr = (base / 'patch_renderer.py').read_text(encoding='utf-8')
    assert 'config.render.bubble_area_fit' in pr  # render flag drives the patch crop-grow
    assert 'union_box' in pr                       # crop grows to cover the balloon
