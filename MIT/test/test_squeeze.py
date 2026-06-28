"""#183 slice 1 — pure squeeze + collision + bounds geometry (font-free).

When fitted text still collides or runs off the page, MangaTranslator squeezes
width ×0.90 up to N times (4-corner collision test) and never lets text leave the
canvas. These pure helpers give the squeeze schedule, the AABB collision test, and
the pre-warp bounds check/clamp — unit-testable without any render. Wiring into the
fit loop (behind render.bubble_area_fit) is slice 2."""
import pytest

from manga_translator.rendering.squeeze import (
    squeeze_factors, box_overlaps, points_exceed_bounds, clamp_points_to_bounds,
)


# --- squeeze_factors: 1.0 then ×0.90 per retry, max_squeezes+1 entries ---

def test_three_retries_gives_four_factors():
    assert squeeze_factors(3) == pytest.approx([1.0, 0.9, 0.81, 0.729])


def test_one_retry_gives_two_factors():
    assert squeeze_factors(1) == pytest.approx([1.0, 0.9])


def test_zero_retries_is_just_full_width():
    assert squeeze_factors(0) == [1.0]


def test_custom_factor():
    assert squeeze_factors(2, factor=0.8) == pytest.approx([1.0, 0.8, 0.64])


# --- box_overlaps: AABB (x1,y1,x2,y2), edge-touch is NOT overlap ---

def test_overlaps_when_intersecting():
    assert box_overlaps((0, 0, 10, 10), (5, 5, 15, 15)) is True


def test_no_overlap_when_disjoint():
    assert box_overlaps((0, 0, 10, 10), (20, 20, 30, 30)) is False


def test_edge_touch_is_not_overlap():
    assert box_overlaps((0, 0, 10, 10), (10, 0, 20, 10)) is False


# --- points_exceed_bounds: any corner outside [0,w]x[0,h] ---

def test_corner_past_right_edge_exceeds():
    pts = [(0, 0), (120, 0), (120, 50), (0, 50)]  # x=120 > w=100
    assert points_exceed_bounds(pts, 100, 100) is True


def test_negative_corner_exceeds():
    pts = [(-5, 0), (80, 0), (80, 50), (-5, 50)]
    assert points_exceed_bounds(pts, 100, 100) is True


def test_within_bounds_does_not_exceed():
    pts = [(0, 0), (80, 0), (80, 50), (0, 50)]
    assert points_exceed_bounds(pts, 100, 100) is False


# --- clamp_points_to_bounds: clamp to canvas + report whether it had to ---

def test_clamp_clamps_and_flags():
    pts = [(-5, 0), (120, 0), (120, 50), (-5, 50)]
    clamped, was_clamped = clamp_points_to_bounds(pts, 100, 100)
    assert was_clamped is True
    assert clamped == [(0, 0), (100, 0), (100, 50), (0, 50)]


def test_clamp_noop_within_bounds():
    pts = [(0, 0), (80, 0), (80, 50), (0, 50)]
    clamped, was_clamped = clamp_points_to_bounds(pts, 100, 100)
    assert was_clamped is False
    assert clamped == pts
