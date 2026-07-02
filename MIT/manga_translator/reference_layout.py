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

    ``measure(font) -> (block_w, block_h)``. Binary search for a fitting size, then a bounded UPWARD
    re-scan to catch the word-wrap **non-monotonicity**: a larger font can wrap to fewer lines that
    each fit the column while a middle font wraps to a line that overflows it (measured: fs=19 fits a
    175px column at 6 lines, yet fs=16/13 overflow it at 4 lines, and fs=10 fits again). Plain binary
    search assumes monotonicity and silently returns the tiny lower branch (the 2026-07-02
    over-shrink); the re-scan above ``best`` recovers the larger fitting size. The window is bounded so
    it stays cheap even when ``cap`` is a large balloon-interior height. Returns ``min_fs`` if nothing
    fits even at the minimum (fail-loud floor)."""
    def _fits(fs):
        block_w, block_h = measure(fs)
        return block_w <= box_w and block_h <= box_h

    lo, hi, best = int(min_fs), int(cap), int(min_fs)
    while lo <= hi:
        mid = (lo + hi) // 2
        if _fits(mid):
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    # non-monotonic correction: a wrap-induced gap where a larger font fits again. The gap spans at
    # most a couple of line-height steps, so a small fixed window above `best` is enough.
    for fs in range(best + 1, min(int(cap), best + 24) + 1):
        if _fits(fs):
            best = fs
    return best
