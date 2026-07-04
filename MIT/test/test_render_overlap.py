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


# ---- #535 Phase-1 slice A/C: fills_bubble_width — the narration discriminator ----
# A region the segmenter placed in a balloon is dialogue-to-FILL only when its own
# text footprint spans most of the balloon width. A narration column loosely sitting
# in a big detected box (One-Punch "THIS BRAT…", rw/bw ~0.40-0.59) must fall through
# to clean-layout's narrow source-referenced column — matching the target's tall
# narrow block — instead of ballooning up wide.

def test_dialogue_footprint_fills_balloon():
    from manga_translator.render_overlap import fills_bubble_width
    assert fills_bubble_width(90, 100) is True            # rw/bw 0.90 = dialogue


def test_narration_narrow_footprint_falls_through():
    from manga_translator.render_overlap import fills_bubble_width
    assert fills_bubble_width(50, 100) is False           # rw/bw 0.50 = narration


def test_no_balloon_info_does_not_block():
    from manga_translator.render_overlap import fills_bubble_width
    assert fills_bubble_width(50, 0) is True              # bw<=0 → don't block


# ---- #535/#183: squeeze_width — narrow the column until the block fills the HEIGHT ----

def test_squeeze_narrows_while_height_fits():
    from manga_translator.render_overlap import squeeze_width
    # block height at width w: total glyph area 3000 / w (narrower → taller)
    measure = lambda w: 3000.0 / w
    got = squeeze_width(measure, full_w=200.0, min_w=20.0, box_h=300.0)
    assert got < 30                      # squeezed far below the full width
    assert 3000.0 / got <= 300.0         # ...but the block still fits the height


def test_squeeze_stops_at_min_width_floor():
    from manga_translator.render_overlap import squeeze_width
    got = squeeze_width(lambda w: 10.0, full_w=100.0, min_w=80.0, box_h=1000.0)
    assert got >= 80.0                   # never below the longest-word floor


def test_squeeze_noop_when_narrowing_would_overflow():
    from manga_translator.render_overlap import squeeze_width
    got = squeeze_width(lambda w: 500.0, full_w=100.0, min_w=10.0, box_h=300.0)
    assert got == 100.0                  # first step already too tall → keep full
