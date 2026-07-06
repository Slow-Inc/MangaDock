"""#430 Phase-3 hotfix (master plan `docs/prd/mit-render-defect-master-plan.md`):
`_clean_layout_dst` must bound a sized-up display caption on BOTH axes.

The display-caption shrink loop currently bounds HEIGHT only, so a caption sized up by
`clean_layout_target_fs` (orig font >> flat) stays far WIDER than its source column and
overflows the art — the 2026-07-02 One-Punch oversize (fill_frac_w up to ~5x). These are
deterministic, font-only characterizations of `_clean_layout_dst` (no worker/ML).
"""
from pathlib import Path
from types import SimpleNamespace

from manga_translator.rendering import _clean_layout_dst, text_render

_FONT = str(Path(__file__).parent.parent / 'fonts' / 'anime_ace_3.ttf')


def _cld(box, txt, orig_fs, font_size_max=20):
    text_render.set_font(_FONT)
    region = SimpleNamespace(xyxy=box, translation=txt, font_size=orig_fs, target_lang='en_US')
    return _clean_layout_dst(region, (1000, 1000), 8, font_size_max, (1000, 1000))


def test_clean_layout_bounds_display_caption_width_not_only_height():
    # orig font 60 (>> flat ~20) sizes the caption up; one word in a 90px source column
    # renders block_w ~444 (fill_frac_w ~4.9) today because only HEIGHT is bounded. The fit
    # must also bound width so the caption can't blow ~5x past its source column into the art.
    clean_fs, block_w, block_h = _cld((0, 0, 90, 400), 'SOMETHING', 60)
    assert block_w <= 90 * 2.0, f'block_w {block_w:.0f} overflows the 90px source column (width unbounded)'


def test_width_bound_keeps_the_word_whole_no_mid_break():
    # Shrinking the FONT (not force-wrapping) keeps the word intact — the width bound must
    # not re-introduce an item-9 mid-word break. The single word must still fit on one line.
    clean_fs, block_w, _ = _cld((0, 0, 90, 400), 'SOMETHING', 60)
    text_render.set_font(_FONT)
    lines, _ = text_render.calc_horizontal(clean_fs, 'SOMETHING', int(block_w), 10 ** 7, language='en_US')
    assert any('SOMETHING' in ln for ln in lines), f'word was split across lines: {lines}'


def test_narration_at_flat_font_is_unaffected_by_the_width_bound():
    # A normal narration (orig font <= flat) never enters the display-caption branch, so the
    # new width bound must not touch it — clean_fs stays the flat page-scaled size.
    clean_fs_narr, _, _ = _cld((0, 0, 120, 300), 'JUST A LINE', 0)
    clean_fs_flat_only, _, _ = _cld((0, 0, 120, 300), 'X', 0)
    assert clean_fs_narr == clean_fs_flat_only, 'narration font drifted (width bound leaked into the flat path)'


def test_big_source_narration_in_tall_column_fits_and_does_not_grow_overflow():
    # #548 / user-2026-07-06 (One-Punch "THIS BRAT" narration): a multi-line narration whose
    # JA source is set in LARGE vertical lettering (orig_fs 39) sits in a tall/narrow column.
    # The grow-to-source path sized it up (block ~1.5x the source column) so the English spilled
    # past the panel. The fit must keep the wrapped block within ~its source footprint.
    box = (571, 22, 699, 310)          # w=128, h=288 — the real One-Punch narration box
    clean_fs, block_w, block_h = _cld(box, "THIS BRAT DOESN'T EVEN REALIZE WHAT HE'S DONE YET", 39)
    col_w = box[2] - box[0]
    assert block_w <= col_w * 1.15, f'narration block_w {block_w:.0f} overflows its {col_w}px source column (grew instead of fitting)'
