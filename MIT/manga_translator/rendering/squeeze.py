"""#183 slice 1 — pure squeeze + collision + bounds geometry (font-free).

When fitted text still collides with a neighbour or runs off the page, the render
fit loop squeezes width ×0.90 up to N times (4-corner collision test) and never
lets text leave the canvas. These pure helpers give the squeeze schedule, the AABB
collision test, and the pre-warp bounds check/clamp. Wiring into the fit loop
(behind render.bubble_area_fit) is slice 2."""
from typing import List, Sequence, Tuple

Box = Tuple[float, float, float, float]   # (x1, y1, x2, y2)
Point = Tuple[float, float]


def squeeze_factors(max_squeezes: int, factor: float = 0.90) -> List[float]:
    """Width multipliers to try in order: ``[1.0, factor, factor**2, ...]`` with
    ``max_squeezes + 1`` entries (the first is the unsqueezed attempt). The manga
    default is ``factor=0.90``; ``max_squeezes`` is 3 when a bubble mask bounds the
    retry, else 1."""
    return [factor ** n for n in range(max_squeezes + 1)]


def box_overlaps(a: Box, b: Box) -> bool:
    """True if axis-aligned boxes ``a`` and ``b`` overlap. Edge-touching (shared
    border, zero-area intersection) is NOT an overlap."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return ax1 < bx2 and bx1 < ax2 and ay1 < by2 and by1 < ay2


def points_exceed_bounds(points: Sequence[Point], img_w: float, img_h: float) -> bool:
    """True if any corner falls outside the canvas ``[0, img_w] × [0, img_h]`` —
    i.e. the warped text would be silently clipped off the page."""
    return any(x < 0 or x > img_w or y < 0 or y > img_h for x, y in points)


def clamp_points_to_bounds(points: Sequence[Point], img_w: float, img_h: float
                           ) -> Tuple[List[Point], bool]:
    """Clamp each corner into ``[0, img_w] × [0, img_h]``. Returns
    ``(clamped_points, was_clamped)`` so the caller can log a warning instead of
    silently dropping off-canvas text."""
    clamped = [(min(max(x, 0), img_w), min(max(y, 0), img_h)) for x, y in points]
    was_clamped = clamped != list(points)
    return clamped, was_clamped
