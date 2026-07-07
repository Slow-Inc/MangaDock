"""Bubble association (#170, PRD #169 enabler).

Tag each text-line region with the speech balloon that contains it, so the
renderer can size text to the balloon area instead of the source text-line
column. Pure geometry, no ML imports — bubbles are polygons (list of (x, y)),
regions are (x1, y1, x2, y2) boxes. Unit-tests in <1s.
"""
import math
from collections import defaultdict
from typing import List, Optional, Sequence, Tuple

Box = Tuple[float, float, float, float]
Polygon = Sequence[Tuple[float, float]]


def balloon_occupancy(boxes: Sequence[Optional[Box]]) -> List[int]:
    """For each balloon box in order, how many regions share that exact box.

    #166 renders a fitted region into its *whole* balloon, so two regions in one
    balloon must not both be fitted (they'd stack). A region whose box is ``None``
    has no balloon and never collides — it counts as a sole occupant (1).
    """
    counts = defaultdict(int)
    for b in boxes:
        if b is not None:
            counts[tuple(b)] += 1
    return [counts[tuple(b)] if b is not None else 1 for b in boxes]


def union_box(boxes: Sequence[Optional[Box]], img_w: int, img_h: int) -> Optional[Box]:
    """Axis-aligned union of the given boxes, clamped to the image. ``None``
    entries are ignored; returns ``None`` if nothing remains.

    #166 uses this to grow a patch crop so it covers the balloons inside it —
    otherwise a balloon larger than its text-lines is clipped at the crop edge
    and the balloon-sized text renders cut off.
    """
    present = [b for b in boxes if b is not None]
    if not present:
        return None
    # floor the mins / ceil the maxes so float balloon coords never shrink the
    # union (truncating a max downward would clip the balloon edge) (#bug-hunt).
    x1 = max(0, min(math.floor(b[0]) for b in present))
    y1 = max(0, min(math.floor(b[1]) for b in present))
    x2 = min(img_w, max(math.ceil(b[2]) for b in present))
    y2 = min(img_h, max(math.ceil(b[3]) for b in present))
    return (x1, y1, x2, y2)


def _polygon_area(poly: Polygon) -> float:
    """Shoelace area (absolute)."""
    n = len(poly)
    area = 0.0
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        area += (xj + xi) * (yj - yi)
        j = i
    return abs(area) / 2.0


def _bbox_of(poly: Polygon) -> Box:
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return min(xs), min(ys), max(xs), max(ys)


def _intersection_over_box(box: Box, bbox: Box) -> float:
    """Area(box ∩ bbox) / Area(box) — how much of the region sits in the
    balloon's footprint."""
    ix1, iy1 = max(box[0], bbox[0]), max(box[1], bbox[1])
    ix2, iy2 = min(box[2], bbox[2]), min(box[3], bbox[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area = (box[2] - box[0]) * (box[3] - box[1])
    return inter / area if area > 0 else 0.0


def _point_in_polygon(x: float, y: float, poly: Polygon) -> bool:
    """Ray-casting point-in-polygon test."""
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def group_regions(
    boxes: Sequence[Box],
    bubble_idxs: Optional[Sequence[Optional[int]]],
    pad: int,
    img_w: int,
    img_h: int,
) -> List[List[int]]:
    """Group region indices that should share one render crop.

    Union-find over padded boxes, made balloon-aware:
      * two regions still merge when their padded boxes overlap, EXCEPT when
        they sit in two different known balloons (keeps adjacent caption boxes
        from collapsing into one strip — the scattered-clump bug);
      * two regions in the SAME balloon always merge, however far apart (a
        multi-line balloon stays one utterance / one crop).

    With ``bubble_idxs`` all None (stage off) this is the legacy pure-proximity
    union-find — byte-identical grouping.
    """
    n = len(boxes)
    if n == 0:
        return []
    if bubble_idxs is None:
        bubble_idxs = [None] * n

    padded = [(max(0, x1 - pad), max(0, y1 - pad),
               min(img_w, x2 + pad), min(img_h, y2 + pad))
              for (x1, y1, x2, y2) in boxes]

    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for i in range(n):
        ax1, ay1, ax2, ay2 = padded[i]
        bi = bubble_idxs[i]
        for j in range(i + 1, n):
            bx1, by1, bx2, by2 = padded[j]
            bj = bubble_idxs[j]
            different_balloons = bi is not None and bj is not None and bi != bj
            if (ax2 > bx1 and bx2 > ax1 and ay2 > by1 and by2 > ay1
                    and not different_balloons):
                union(i, j)
            if bi is not None and bj is not None and bi == bj:
                union(i, j)

    group_map: dict = defaultdict(list)
    for i in range(n):
        group_map[find(i)].append(i)
    return list(group_map.values())


MIN_IOA = 0.5


def associate_regions_to_bubbles(
    region_boxes: Sequence[Box],
    bubble_polygons: Sequence[Polygon],
    min_ioa: float = MIN_IOA,
) -> List[Optional[int]]:
    """For each region box, the index of its speech balloon, else None.

    1. Containment: balloons whose mask contains the region centroid; if several
       (nested), the smallest-area one wins (tightest fit).
    2. Fallback: if none contain, the balloon whose footprint overlaps the most
       of the region — provided that overlap clears ``min_ioa`` — else None.
    """
    bboxes = [_bbox_of(poly) for poly in bubble_polygons]
    out: List[Optional[int]] = []
    for box in region_boxes:
        cx = (box[0] + box[2]) / 2
        cy = (box[1] + box[3]) / 2
        containing = [i for i, poly in enumerate(bubble_polygons)
                      if _point_in_polygon(cx, cy, poly)]
        if containing:
            match: Optional[int] = min(
                containing, key=lambda i: _polygon_area(bubble_polygons[i]))
        else:
            match = None
            best = min_ioa
            for i, bbox in enumerate(bboxes):
                ioa = _intersection_over_box(box, bbox)
                if ioa >= best:
                    best = ioa
                    match = i
        out.append(match)
    return out


def acceptable_synth_bubble(box, region_box, page_w, page_h, max_page_frac=0.6, min_grow=1.05):
    """Gate a flood-fill-synthesized bubble before it is used (#170/#178 recall fallback).

    Accept only when the box (1) fully ENCLOSES the text region, (2) is meaningfully BIGGER than it
    (room to fill — not a degenerate/equal box), and (3) is NOT a page/panel leak (area below
    ``max_page_frac`` of the page). Rejects the classic flood-fill failure modes (escaped to the
    whole panel, or clung to the text) so the fallback never manufactures a bogus balloon.
    """
    bx1, by1, bx2, by2 = box
    rx1, ry1, rx2, ry2 = region_box
    if not (bx1 <= rx1 and by1 <= ry1 and bx2 >= rx2 and by2 >= ry2):
        return False
    bw, bh = bx2 - bx1, by2 - by1
    rw, rh = rx2 - rx1, ry2 - ry1
    if bw <= 0 or bh <= 0:
        return False
    if bw * bh <= (rw * rh) * min_grow:
        return False
    if (bw * bh) > (page_w * page_h) * max_page_frac:
        return False
    return True
