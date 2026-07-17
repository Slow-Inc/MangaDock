"""#182 slice 1 — pure auto-orientation + vertical stacking geometry, font-free.

These two helpers decide WHEN to stack a Latin region vertically (manga-style) and
WHERE each glyph goes, from stub advances only (no freetype), so the gate thresholds
and column-wrap math are unit-testable in isolation. Wiring into the render path is
slice 2 (behind render.auto_vertical, gated by render.bubble_area_fit)."""
import pytest

from manga_translator.rendering.vertical_layout import auto_orientation, vertical_layout


# --- auto_orientation: vertical iff aspect>=1.6 AND chars<=12 AND words<=1 ---

def test_tall_narrow_short_single_word_is_vertical():
    # aspect = 100/40 = 2.5 >= 1.6, 4 chars, 1 word
    assert auto_orientation(box_h=100, box_w=40, char_count=4, word_count=1) is True


def test_wide_region_is_horizontal():
    # aspect = 40/100 = 0.4 < 1.6
    assert auto_orientation(box_h=40, box_w=100, char_count=4, word_count=1) is False


def test_long_text_is_horizontal_even_if_tall():
    # 20 chars > 12, even though aspect qualifies
    assert auto_orientation(box_h=100, box_w=40, char_count=20, word_count=1) is False


def test_multi_word_is_horizontal_even_if_tall():
    # 2 words > 1, even though aspect + char-count qualify
    assert auto_orientation(box_h=100, box_w=40, char_count=8, word_count=2) is False


def test_aspect_exactly_at_threshold_is_vertical():
    # aspect = 1.6 exactly -> inclusive
    assert auto_orientation(box_h=160, box_w=100, char_count=3, word_count=1) is True


def test_zero_width_does_not_crash_and_is_vertical():
    # degenerate w=0 -> treat as infinitely tall-narrow, still gated by chars/words
    assert auto_orientation(box_h=100, box_w=0, char_count=3, word_count=1) is True


# --- vertical_layout: stack glyphs top->down by advance*tracking, wrap to next column ---

def test_single_column_stacks_by_tracked_advance():
    # advance 10, tracking 0.90 -> step 9; 2 glyphs fit in box_h=20
    pos = vertical_layout([10, 10], box_h=20, col_width=12, tracking=0.90)
    assert pos[0] == (0, 0)
    assert pos[1] == (0, 9)


def test_overflow_wraps_to_next_column_and_resets_y():
    # 3rd glyph would land at y=18(+9=27) > box_h=20 -> new column, y back to 0
    pos = vertical_layout([10, 10, 10], box_h=20, col_width=12, tracking=0.90)
    assert pos[0] == (0, 0)
    assert pos[1] == (0, 9)
    assert pos[2] == (12, 0)  # column 2 at x=col_width, y reset


def test_empty_advances_returns_empty():
    assert vertical_layout([], box_h=20, col_width=12) == []


def test_first_glyph_always_placed_even_if_taller_than_box():
    # a single glyph taller than the box still gets placed at origin (no infinite wrap)
    pos = vertical_layout([100], box_h=20, col_width=12, tracking=0.90)
    assert pos == [(0, 0)]
