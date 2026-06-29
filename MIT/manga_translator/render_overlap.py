"""Overlap-aware render-box clamping (anti-overlap text layout).

When the renderer grows a region's box to fit longer translated text, it can spill
into a neighbouring region's territory, so the rendered English visibly overlaps the
adjacent bubble/caption. MIT already knows every region's detected position, so before
sizing a region's font we clamp its render box against the other regions: for each
overlapping neighbour, separate along the axis of **least penetration** (lose the least
space) and pull only the edge facing that neighbour. The font is then fit to the clamped
box, so the text stays inside its own space and cannot collide.

Pure stdlib geometry — no ML / numpy / `self`; unit-tested in isolation.
"""
from typing import Iterable, Sequence, Tuple

Box = Tuple[float, float, float, float]


def apply_font_cap(size: int, cap: int, is_sfx: bool) -> int:
    """Cap a region's render font to `cap` px so narration/dialogue can't be scaled up
    (by the length-ratio heuristic) into an oversized block that overflows its panel —
    matching MangaTranslator's small absolute fonts. SFX is exempt (it must stay big),
    and `cap <= 0` disables the cap (byte-identical)."""
    if cap and cap > 0 and not is_sfx:
        return min(size, cap)
    return size


def centered_box(cx: float, cy: float, w: float, h: float):
    """Return an axis-aligned 4-point box (TL, TR, BR, BL) of size `w`×`h` centred on
    `(cx, cy)`. Used by the clean horizontal-layout path: the translated text block is
    laid out at a small absolute font, then placed in this upright box — so the renderer's
    homography is a plain scale (no shear/stretch), unlike warping EN onto the original
    vertical-JP detection quad which stretches it tall and oversized."""
    hw, hh = w / 2.0, h / 2.0
    return [(cx - hw, cy - hh), (cx + hw, cy - hh), (cx + hw, cy + hh), (cx - hw, cy + hh)]


def clean_wrap_width(ref_w: float, img_w: float) -> int:
    """Wrap width (px) for the clean horizontal-layout path. Wrap the translated English to
    the original's footprint width (`ref_w`) so it breaks where the source did — a vertical-JP
    narration column stays a narrow, tall block; a dialogue balloon fills the balloon — instead
    of reflowing into a wide novel-like paragraph (the user-flagged "doesn't reference the
    original line-breaks"). The caller picks `ref_w`: the balloon width for dialogue, else the
    region's own bbox width. Clamped to [11%, 45%] of the page width so a narrow dialogue
    column still fits ~2 words a line and a wide caption doesn't span the whole page."""
    return int(min(max(ref_w, img_w * 0.11), img_w * 0.45))


def clamp_box_to_neighbors(box: Box, others: Iterable[Sequence[float]], margin: float = 0) -> Box:
    """Return `box` (x1, y1, x2, y2) shrunk so it does not overlap any box in `others`.

    Each overlapping neighbour pushes in exactly one edge of `box` — the one facing it,
    chosen on the axis where the boxes penetrate least, leaving `margin` px of gap. The
    penetration test uses the ORIGINAL box, so several neighbours on different sides each
    constrain their own edge independently. A box squeezed past itself collapses to its
    centre line on that axis (degenerate but non-inverted).
    """
    ox1, oy1, ox2, oy2 = (float(v) for v in box)
    x1, y1, x2, y2 = ox1, oy1, ox2, oy2
    cx, cy = (ox1 + ox2) / 2.0, (oy1 + oy2) / 2.0

    for nb in others:
        nx1, ny1, nx2, ny2 = (float(v) for v in nb)
        pen_x = min(ox2, nx2) - max(ox1, nx1)   # x penetration vs the original box
        pen_y = min(oy2, ny2) - max(oy1, ny1)   # y penetration
        if pen_x <= 0 or pen_y <= 0:
            continue                             # not overlapping
        ncx, ncy = (nx1 + nx2) / 2.0, (ny1 + ny2) / 2.0
        if pen_x <= pen_y:                       # separate horizontally
            if ncx >= cx:
                x2 = min(x2, nx1 - margin)       # neighbour to the right
            else:
                x1 = max(x1, nx2 + margin)       # neighbour to the left
        else:                                    # separate vertically
            if ncy >= cy:
                y2 = min(y2, ny1 - margin)       # neighbour below
            else:
                y1 = max(y1, ny2 + margin)       # neighbour above

    if x2 < x1:
        x1 = x2 = cx
    if y2 < y1:
        y1 = y2 = cy
    return (x1, y1, x2, y2)


def processing_scale(img_h: int, img_w: int, lo: float = 0.5, hi: float = 4.0) -> float:
    """Page-area font scaler (#175 S1, MangaTranslator ``pipeline.py:694``): ``sqrt(megapixels)``
    so the two-tier font bounds (:func:`font_bounds`) auto-scale with page resolution instead of
    a single fixed px tuned for one benchmark page. Clamped to ``[lo, hi]`` so a degenerate tiny
    or huge page stays sane. Pure arithmetic."""
    mp = (img_h * img_w) / 1_000_000.0
    return max(lo, min(hi, mp ** 0.5))


def font_bounds(is_display: bool, scale: float, font_size_minimum: int) -> Tuple[int, int]:
    """Two-tier font-size search bounds for #175, scaled by ``scale`` (:func:`processing_scale`)
    and floored at ``font_size_minimum``. Mirrors MangaTranslator ``config.py``: dialogue
    ``[8,16]`` (``:102-103``), display/SFX ``[10,64]`` (``:147-148``). The binary-search fit
    (S2/S3) searches the largest font in ``[lo,hi]`` that fits the region's safe area. Pure."""
    base_lo, base_hi = (10, 64) if is_display else (8, 16)
    lo = max(font_size_minimum, round(base_lo * scale))
    hi = max(font_size_minimum, round(base_hi * scale))
    return (lo, hi)
