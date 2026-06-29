"""Overlap-aware render-box clamping (anti-overlap text layout).

When the renderer grows a region's box to fit longer translated text, it can spill
into a neighbouring region's territory → the rendered text visibly overlaps. MIT
already knows every region's detected position, so we clamp each region's render box
against its neighbours (separating along the axis of least penetration) before sizing
the font — the text then fits inside its own space and can't collide. Pure geometry,
no ML imports.
"""
from manga_translator.render_overlap import clamp_box_to_neighbors


def test_no_neighbors_returns_box_unchanged():
    assert clamp_box_to_neighbors((0, 0, 10, 10), []) == (0, 0, 10, 10)


# ---- clean horizontal layout helpers (render-layout rework) ---------------------

def test_centered_box_places_an_axis_aligned_block_on_the_region_center():
    from manga_translator.render_overlap import centered_box
    # 40×20 block centred on (100,100) → axis-aligned, no rotation/distortion
    assert centered_box(100, 100, 40, 20) == [
        (80.0, 90.0), (120.0, 90.0), (120.0, 110.0), (80.0, 110.0)]


def test_clean_wrap_width_clamps_the_reference_width_to_the_page():
    from manga_translator.render_overlap import clean_wrap_width
    # Wrap to the supplied reference width (the original footprint — a narration column's
    # own width, or a dialogue balloon's width) so the English breaks where the original
    # did instead of reflowing into a wide novel-like paragraph.
    assert clean_wrap_width(120, 800) == 120               # narrow narration column → narrow wrap
    assert clean_wrap_width(30, 800) == 88                 # very narrow strip → floored to 11% (88)
    assert clean_wrap_width(500, 800) == 360               # wide caption → capped at 45% (360)


# ---- apply_font_cap: keep narration/dialogue small, exempt SFX ------------------

def test_font_cap_clamps_oversized_text():
    from manga_translator.render_overlap import apply_font_cap
    assert apply_font_cap(40, cap=22, is_sfx=False) == 22      # capped
    assert apply_font_cap(18, cap=22, is_sfx=False) == 18      # already under → unchanged


def test_font_cap_exempts_sfx_so_it_stays_big():
    from manga_translator.render_overlap import apply_font_cap
    assert apply_font_cap(64, cap=22, is_sfx=True) == 64       # SFX never capped


def test_font_cap_disabled_when_zero_or_negative():
    from manga_translator.render_overlap import apply_font_cap
    assert apply_font_cap(40, cap=0, is_sfx=False) == 40       # 0 → no cap (byte-identical)
    assert apply_font_cap(40, cap=-1, is_sfx=False) == 40


def test_disjoint_neighbor_leaves_box_unchanged():
    assert clamp_box_to_neighbors((0, 0, 10, 10), [(20, 20, 30, 30)]) == (0, 0, 10, 10)


def test_neighbor_to_the_right_clamps_the_right_edge():
    # box overlaps a neighbour 2px on x, 10px on y → separate on x (least penetration);
    # neighbour is to the right of centre → pull the right edge to its left edge.
    assert clamp_box_to_neighbors((0, 0, 10, 10), [(8, 0, 20, 10)]) == (0, 0, 8, 10)


def test_neighbor_to_the_left_clamps_the_left_edge():
    assert clamp_box_to_neighbors((10, 0, 20, 10), [(0, 0, 12, 10)]) == (12, 0, 20, 10)


def test_neighbor_below_clamps_the_bottom_edge():
    # 10px x overlap, 2px y overlap → separate on y; neighbour below → pull bottom up.
    assert clamp_box_to_neighbors((0, 0, 10, 10), [(0, 8, 10, 20)]) == (0, 0, 10, 8)


def test_neighbor_above_clamps_the_top_edge():
    assert clamp_box_to_neighbors((0, 10, 10, 20), [(0, 0, 10, 12)]) == (0, 12, 10, 20)


def test_margin_keeps_a_gap_between_boxes():
    assert clamp_box_to_neighbors((0, 0, 10, 10), [(8, 0, 20, 10)], margin=1) == (0, 0, 7, 10)


def test_multiple_neighbors_each_constrain_their_side():
    # neighbour right (8..) and neighbour below (..8) → clamp both edges.
    out = clamp_box_to_neighbors((0, 0, 10, 10), [(8, 0, 20, 10), (0, 8, 10, 20)])
    assert out == (0, 0, 8, 8)


# ---- #175 S1: processing_scale — page-area font scaler (MangaTranslator pipeline) ----

def test_processing_scale_is_sqrt_megapixels():
    from manga_translator.render_overlap import processing_scale
    assert processing_scale(1000, 1000) == 1.0          # 1 MP → 1.0
    assert processing_scale(2000, 2000) == 2.0          # 4 MP → 2.0


def test_processing_scale_clamps_extremes():
    from manga_translator.render_overlap import processing_scale
    assert processing_scale(100, 100) == 0.5            # 0.01 MP → sqrt 0.1 → clamp lo 0.5
    assert processing_scale(5000, 5000) == 4.0          # 25 MP → sqrt 5 → clamp hi 4.0


# ---- #175 S1: font_bounds — two-tier dialogue/display bounds (MangaTranslator config) ----

def test_font_bounds_two_tier_at_scale_1():
    from manga_translator.render_overlap import font_bounds
    assert font_bounds(False, 1.0, 8) == (8, 16)        # dialogue 8–16
    assert font_bounds(True, 1.0, 8) == (10, 64)        # display/SFX 10–64


def test_font_bounds_scales_with_processing_scale():
    from manga_translator.render_overlap import font_bounds
    assert font_bounds(False, 2.0, 8) == (16, 32)       # dialogue ×2
    assert font_bounds(True, 2.0, 8) == (20, 128)       # display ×2


def test_font_bounds_floored_at_minimum():
    from manga_translator.render_overlap import font_bounds
    # ps=0.5 dialogue → round(4),round(8) → floored at fmin=8 → (8,8)
    assert font_bounds(False, 0.5, 8) == (8, 8)


# ---- #175 (corrected): clean-layout font scaled by processing_scale (keeps comic font + wrap) ----

def test_clean_layout_font_size_unchanged_on_benchmark_resolution():
    from manga_translator.render_overlap import clean_layout_font_size
    # benchmark page ~1150×800 (0.92 MP → ps≈0.96) with the prod fixed font_size_max=20 →
    # ~19, i.e. the same look that's already good (no regress).
    assert clean_layout_font_size(20, 1150, 800, -1) == 19


def test_clean_layout_font_size_grows_on_higher_resolution():
    from manga_translator.render_overlap import clean_layout_font_size
    # the fix: a higher-res page (3 MP → ps≈1.73) scales the SAME fixed 20 up → fills bubbles
    # instead of staying tiny (the Gal Yome ENG-source report).
    assert clean_layout_font_size(20, 2000, 1500, -1) == 35      # round(20 * 1.732)


def test_clean_layout_font_size_floored_and_page_default():
    from manga_translator.render_overlap import clean_layout_font_size
    assert clean_layout_font_size(20, 200, 200, 12) == 12        # tiny page → ps clamp 0.5 → 10 → floor 12
    # font_size_max unset → page-scaled base (H+W)/130, then × ps
    assert clean_layout_font_size(0, 1300, 1300, -1) == 26       # base 20 × ps(1.69MP)=1.3
