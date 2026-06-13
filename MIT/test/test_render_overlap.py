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
