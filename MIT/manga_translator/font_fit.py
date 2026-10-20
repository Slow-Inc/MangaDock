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

    The wrapper's fit is NOT monotonic in size — a size can overflow while a larger one
    fits, because the line breaks land differently (2026-10-20: a Thai line fit at 23/24/26
    but not at 20-22, and bisection returned 13). So scan DOWN from ``high`` and return the
    first size that fits; the caller keeps the scan short by passing a tight ``high`` (see
    ``area_font_cap``). If nothing fits, return ``low`` — a too-tight floor beats invisible
    text.
    """
    w_max, h_max = box_wh[0] * margin, box_wh[1] * margin
    for size in range(high, low - 1, -1):
        block_w, block_h = measure(size)
        if block_w <= w_max and block_h <= h_max:
            return size
    return low


def area_font_cap(box_wh: Tuple[float, float], width_per_px: float, line_height: float,
                  margin: float = 1.0, slack: int = 2) -> int:
    """Upper bound on a fitting font size from area alone: text that is ``width_per_px * s``
    wide on one line, wrapped into ``w x h`` at ``line_height``, needs
    ``width_per_px * s * s * line_height <= w * h``. ``slack`` covers wrap-ragged lines. Pure."""
    w, h = box_wh[0] * margin, box_wh[1] * margin
    if width_per_px <= 0:
        return 10 ** 6
    return int((w * h / (line_height * width_per_px)) ** 0.5) + slack
