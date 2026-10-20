"""#757: coalesce textline components that share one balloon/caption container. Pure.

`textline_merge` joins two lines only when their gap is < 1.0x the font size, but caption boxes
are typically spaced 1.0-1.7x (measured with Pipeline Doctor, #756), so a caption arrives as one
component per line and is translated as fragments. The balloon/caption polygon says which lines
belong together: components inside one container are coalesced when at least one is a single
line — a fragment proves the split, while a box of multi-line components is most likely separate
paragraphs and is left alone.

Sharing a container is necessary, not sufficient: one YOLO polygon can cover two speech boxes
drawn as one white shape, or a region nested inside another (2026-10-20 corpus). So the
components must also chain as consecutive lines of one block — along the reading axis, each next
component starts within `MAX_GAP` font sizes of the previous one and overlaps it across the axis.
"""
from typing import Dict, List, Optional, Sequence, Set, Tuple

Box = Tuple[float, float, float, float]

#: Largest gap between consecutive lines, in font sizes, that still reads as one block. Captions
#: measured 1.00-1.74; separate boxes under one polygon measured 6.1.
MAX_GAP = 2.0
#: Allowed overlap along the reading axis (negative gap), in font sizes — line boxes touch.
MAX_OVERLAP = 0.5
#: Minimum cross-axis overlap, as a fraction of the narrower component.
MIN_CROSS_OVERLAP = 0.3


def _bbox(group: Set[int], boxes: Sequence[Box]) -> Box:
    bs = [boxes[i] for i in group]
    return (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))


def components_chain(comps: List[Set[int]], direction: str, boxes: Sequence[Box],
            font_sizes: Sequence[float]) -> bool:
    """True when the components read as consecutive lines of one block."""
    bbs = [_bbox(c, boxes) for c in comps]
    fonts = [min(font_sizes[i] for i in c) for c in comps]
    if direction == 'v':  # columns read right to left
        order = sorted(range(len(comps)), key=lambda k: -bbs[k][2])
    else:
        order = sorted(range(len(comps)), key=lambda k: bbs[k][1])
    for a, b in zip(order, order[1:]):
        A, B = bbs[a], bbs[b]
        font = max(1.0, min(fonts[a], fonts[b]))
        if direction == 'v':
            gap, cross = A[0] - B[2], min(A[3], B[3]) - max(A[1], B[1])
            narrow = min(A[3] - A[1], B[3] - B[1])
        else:
            gap, cross = B[1] - A[3], min(A[2], B[2]) - max(A[0], B[0])
            narrow = min(A[2] - A[0], B[2] - B[0])
        if not -MAX_OVERLAP * font <= gap <= MAX_GAP * font or cross < MIN_CROSS_OVERLAP * narrow:
            return False
    return True


def coalesce_container_fragments(groups: List[Set[int]], containers: Sequence[Optional[int]],
                                 directions: Sequence[str], boxes: Sequence[Box],
                                 font_sizes: Sequence[float], sfx: Sequence[bool]) -> List[Set[int]]:
    """Merge components (sets of textline indices) that share one container.

    A component belongs to a container only when all its lines do and none is a det_sfx line
    (merging one would stamp `from_sfx_detection` on the whole dialogue). Components in one container
    are merged when there are several, at least one is a single line, all lines share one
    direction, and they chain as consecutive lines (see module docstring). Output order follows
    each result's first component in `groups`.
    """
    def container_of(group: Set[int]) -> Optional[int]:
        if any(sfx[i] for i in group):
            return None
        owners = {containers[i] for i in group}
        return owners.pop() if len(owners) == 1 else None

    by_container: Dict[int, List[int]] = {}
    for gi, g in enumerate(groups):
        c = container_of(g)
        if c is not None:
            by_container.setdefault(c, []).append(gi)

    absorbed: Dict[int, int] = {}  # group index -> index of the group it merges into
    for members in by_container.values():
        if len(members) < 2 or all(len(groups[gi]) > 1 for gi in members):
            continue
        lines = set().union(*(groups[gi] for gi in members))
        dirs = {directions[i] for i in lines}
        if len(dirs) != 1 or not components_chain([groups[gi] for gi in members], dirs.pop(), boxes, font_sizes):
            continue
        for gi in members[1:]:
            absorbed[gi] = members[0]

    out: Dict[int, Set[int]] = {}
    for gi, g in enumerate(groups):
        out.setdefault(absorbed.get(gi, gi), set()).update(g)
    return list(out.values())
