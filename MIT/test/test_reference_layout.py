"""#178/#175 Phase 4 — reference layout engine (master plan `docs/prd/mit-render-defect-master-plan.md`).

Port MangaTranslator's proven fit: binary-search the font DOWN from a cap to the largest that fits
BOTH axes of the balloon SAFE-BOX (not the source column — the 2026-07-02 learning), failing loud at
the minimum rather than overflowing. This file drives the pure fit core; the measure fn is injected so
the search logic is deterministic and font-free.
"""
from manga_translator.reference_layout import fit_to_box


def test_fit_to_box_finds_largest_font_that_fits_both_axes():
    # fake measure: block grows linearly with font (w = font*5, h = font*8).
    measure = lambda f: (f * 5, f * 8)
    # box 100x160 → width allows font ≤ 20, height allows ≤ 20 → 20 (the binding axis wins).
    assert fit_to_box(measure, box_w=100, box_h=160, cap=40, min_fs=8) == 20
    # narrower box 50x160 → width now binds at font ≤ 10.
    assert fit_to_box(measure, box_w=50, box_h=160, cap=40, min_fs=8) == 10
    # nothing fits even at the minimum → return min (fail-loud, never overflow past the floor).
    assert fit_to_box(measure, box_w=10, box_h=10, cap=40, min_fs=8) == 8


# Integration: the dispatcher-side fit that measures real wrapped text against a given box
# (the SAFE-BOX, passed in) and shrinks the font to fit both axes, keeping words whole.
from pathlib import Path
from types import SimpleNamespace
from manga_translator.rendering import _reference_clean_layout, text_render as _tr

_FONT = str(Path(__file__).parent.parent / 'fonts' / 'anime_ace_3.ttf')


def test_reference_clean_layout_shrinks_to_fit_both_axes_of_the_safe_box():
    _tr.set_font(_FONT)
    region = SimpleNamespace(translation='THIS BRAT DOESNT REALIZE WHAT HE DID', target_lang='en_US')
    # a modest safe-box: 160x220. The fit must return a block that fits BOTH axes.
    fs, block_w, block_h = _reference_clean_layout(region, 160.0, 220.0, 8, 40, 1200)
    assert 8 <= fs <= 40
    assert block_w <= 160 + 1, f'block_w {block_w:.0f} exceeds safe-box width 160'
    assert block_h <= 220 + 1, f'block_h {block_h:.0f} exceeds safe-box height 220'


def test_reference_clean_layout_keeps_a_word_whole():
    _tr.set_font(_FONT)
    region = SimpleNamespace(translation='SOMETHING', target_lang='en_US')
    fs, block_w, _ = _reference_clean_layout(region, 90.0, 300.0, 8, 60, 1200)
    lines, _ = _tr.calc_horizontal(fs, 'SOMETHING', int(block_w) + 5, 10 ** 7, language='en_US')
    assert any('SOMETHING' in ln for ln in lines), f'word split: {lines}'


def test_reference_fit_box_uses_detection_box_when_no_bubble():
    # Narration without a speech balloon sizes against its own detection box (w,h) centered.
    from manga_translator.rendering import _reference_fit_box
    region = SimpleNamespace(xyxy=(10, 20, 110, 220), bubble_polygon=None)
    bw, bh, (cx, cy) = _reference_fit_box(region, None, (500, 500, 3))
    assert (bw, bh) == (100.0, 200.0)
    assert (cx, cy) == (60.0, 120.0)
