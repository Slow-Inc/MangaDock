"""Binary-search font sizing (#166, PRD #169 P2).

Pure arithmetic, no ML imports. Given the balloon box a region sits in (#170's
bubble_box) and a measure callback that wraps text at a candidate size, find the
largest font whose wrapped block fits the box. The measure is supplied by the
caller (the renderer's own wrapper in production, a stub in tests) so the search
stays dependency-light and the fit prediction matches the actual render.
"""
from typing import Callable, Tuple


def font_high_cap(h_box: float, max_box_ratio: float, floor: int = 8) -> int:
    """Binary-search ceiling for #166 fitting: ``int(h_box * max_box_ratio)``,
    never below ``floor``.

    Render-parity C: ``max_box_ratio`` (#175 default 0.5) caps the font so a short
    line in a tall balloon isn't a giant. Raising it lets text grow to fill the
    balloon — closer to MangaTranslator, which has no such cap. Pure arithmetic.
    """
    return max(floor, int(h_box * max_box_ratio))


def fit_font_size(
    box_wh: Tuple[float, float],
    measure: Callable[[int], Tuple[float, float]],
    low: int = 8,
    high: int = 64,
    margin: float = 1.0,
) -> int:
    """Largest integer font size in ``[low, high]`` whose rendered text fits ``box_wh``.

    ``measure(size)`` returns the ``(block_width, block_height)`` of the text
    wrapped at that size — supplied by the caller (the real renderer's wrapper in
    production, a stub in tests) so this search stays pure. A size *fits* when both
    ``block_width <= W*margin`` and ``block_height <= H*margin``.

    ``margin`` (#175) fits to a *fraction* of the box (e.g. 0.92) so rounding and
    glyph ascent/descent slack can't push text past the balloon edge — the cause
    of the clipped benchmark renders. ``margin=1.0`` is edge-to-edge (default,
    backward-compatible).

    Standard binary search: ``mid=(low+high)//2``; fits → search higher, else
    lower. If even ``low`` overflows, returns ``low`` — a too-tight floor beats
    invisible text; squeezing below the floor is a later refinement.
    """
    w_max, h_max = box_wh[0] * margin, box_wh[1] * margin
    best = low
    lo, hi = low, high
    while lo <= hi:
        mid = (lo + hi) // 2
        block_w, block_h = measure(mid)
        if block_w <= w_max and block_h <= h_max:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best
