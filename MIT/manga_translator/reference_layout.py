"""Reference layout engine (#178/#175 Phase 4) — MangaTranslator-parity text fit.

The proven reference renderer sizes text by binary-searching the font DOWN from a cap to the
largest that fits BOTH axes of the balloon's distance-transform SAFE-BOX (never the source-text
column), and fails loud at the minimum rather than overflowing the art. This module is the pure,
dependency-light core of that model — the measure fn is injected so the search is unit-testable
without PIL/torch. Wiring it into the render dispatch (behind a flag, with the safe-box as the box)
lives in ``rendering/__init__.py``.
"""


def fit_to_box(measure, box_w, box_h, cap, min_fs):
    """Largest font in ``[min_fs, cap]`` whose measured block fits ``box_w`` AND ``box_h``.

    ``measure(font) -> (block_w, block_h)``. Binary search assuming the block grows monotonically
    with the font (true for a fixed wrap column). Returns the largest fitting font; if nothing fits
    even at ``min_fs``, returns ``min_fs`` (fail-loud floor — the caller decides what to do rather
    than the text silently overflowing past the minimum).
    """
    lo, hi = min_fs, cap
    best = min_fs
    while lo <= hi:
        mid = (lo + hi) // 2
        block_w, block_h = measure(mid)
        if block_w <= box_w and block_h <= box_h:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best
