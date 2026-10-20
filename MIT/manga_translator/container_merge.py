"""#757: coalesce textline components that share one balloon/caption container. Pure.

`textline_merge` joins two lines only when their gap is < 1.0x the font size, but caption boxes
are typically spaced 1.0-1.7x (measured with Pipeline Doctor, #756), so a caption arrives as one
component per line and is translated as fragments. The balloon/caption polygon says which lines
belong together: components inside one container are coalesced when at least one is a single
line — a fragment proves the split, while a box of multi-line components is most likely separate
paragraphs and is left alone.
"""
from typing import Dict, List, Optional, Sequence, Set


def coalesce_container_fragments(groups: List[Set[int]], containers: Sequence[Optional[int]],
                                 directions: Sequence[str]) -> List[Set[int]]:
    """Merge components (sets of textline indices) that share one container.

    A component belongs to a container only when all its lines do. Components in one container
    are merged when there are several, at least one is a single line, and all lines share one
    direction. Output order follows each result's first component in `groups`.
    """
    def container_of(group: Set[int]) -> Optional[int]:
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
        if len({directions[i] for i in lines}) != 1:
            continue
        for gi in members[1:]:
            absorbed[gi] = members[0]

    out: Dict[int, Set[int]] = {}
    for gi, g in enumerate(groups):
        out.setdefault(absorbed.get(gi, gi), set()).update(g)
    return list(out.values())
