"""SFX second-pass dedup (#168, PRD #169 P1).

Pure geometry, no ML imports. The SFX detector (AnimeText YOLO) is run as a
second pass; its boxes are merged into the DBNet textline flow, but a box that
is already mostly covered by a DBNet textline is a duplicate of dialogue and is
dropped. "Covered" = intersection over the *candidate's* area (IoA) ≥ threshold.
Boxes are (x1, y1, x2, y2).
"""
from typing import List, Sequence, Tuple

Box = Tuple[float, float, float, float]


def _intersection_over_candidate(candidate: Box, existing: Box) -> float:
    ix1, iy1 = max(candidate[0], existing[0]), max(candidate[1], existing[1])
    ix2, iy2 = min(candidate[2], existing[2]), min(candidate[3], existing[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area = max(1.0, (candidate[2] - candidate[0]) * (candidate[3] - candidate[1]))
    return inter / area


def dedup_sfx_boxes(
    existing_boxes: Sequence[Box],
    candidate_boxes: Sequence[Box],
    ioa_threshold: float = 0.2,
    engulf_threshold: float = 0.6,
) -> List[Box]:
    """SFX boxes not already covered by a DBNet textline (kept, in order).

    #19 (Otome p10): also drop a candidate that ENGULFS an existing textline —
    a big FP box over normal dialogue contains the thin DBNet line almost fully
    while its own IoA stays tiny, so the old one-directional check passed it and
    the VLM then hallucinated a phantom overlay. "Engulfs" = intersection over
    the EXISTING line's area >= ``engulf_threshold``."""
    out: List[Box] = []
    for c in candidate_boxes:
        covered = any(_intersection_over_candidate(c, e) >= ioa_threshold
                      for e in existing_boxes)
        engulfs = any(_intersection_over_candidate(e, c) >= engulf_threshold
                      for e in existing_boxes)
        if not covered and not engulfs:
            out.append(tuple(c))
    return out
