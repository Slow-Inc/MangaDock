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


def fills_bubble_width(region_w: float, bubble_w: float, threshold: float = 0.72) -> bool:
    """#175 residual #2 / #535 slice C: a region the segmenter placed in a balloon is
    dialogue-to-FILL only when its own text footprint spans most of the balloon width
    (``region_w/bubble_w >= threshold``). A caption/narration loosely sitting in a
    large detected box (One-Punch "THIS BRAT…": rw/bw ≈0.40–0.59 vs dialogue
    ≈0.88–0.90) must keep clean-layout's narrow source-referenced column — matching
    the target's tall narrow block — not balloon up wide. ``bubble_w <= 0`` (no
    info) → don't block bubble-fit. Pure."""
    if bubble_w <= 0:
        return True
    return (region_w / bubble_w) >= threshold


def squeeze_width(measure_h, full_w: float, min_w: float, box_h: float, factor: float = 0.9):
    """#183 width-squeeze (MangaTranslator ``layout_engine.py``): narrow the wrap column by
    ``factor`` each step so the text uses MORE lines and fills a tall box's *height*,
    instead of a few wide lines with empty space below. ``measure_h(w)`` returns the wrapped
    block height at column width ``w`` (narrower → taller). Stops at ``min_w`` (the longest
    unbreakable token's width, so no word force-breaks) or just before the block would exceed
    ``box_h``. Returns the chosen column width — ``full_w`` if no narrowing helps. Pure."""
    w = float(full_w)
    floor = float(min_w)
    while w * factor >= floor:
        nw = w * factor
        if measure_h(nw) <= box_h:
            w = nw
        else:
            break
    return w


def box_containment(a, b) -> float:
    """#436: fraction of box ``a``'s area that lies inside box ``b`` (0..1). The SFX
    detector and the line detector can both fire on the same stylized word, yielding a
    small duplicate region almost fully inside the full-sentence region — high
    containment + substring text ⇒ redundant. Pure geometry."""
    ax1, ay1, ax2, ay2 = (float(v) for v in a)
    bx1, by1, bx2, by2 = (float(v) for v in b)
    aw, ah = max(0.0, ax2 - ax1), max(0.0, ay2 - ay1)
    if aw <= 0 or ah <= 0:
        return 0.0
    ix = max(0.0, min(ax2, bx2) - max(ax1, bx1))
    iy = max(0.0, min(ay2, by2) - max(ay1, by1))
    return (ix * iy) / (aw * ah)
