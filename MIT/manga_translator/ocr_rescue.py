"""#172 OCR rescue ladder — pure, ML-free policy + geometry (PRD #169 P3).

The 48px line-OCR is underconfident on long-thin lines (returns mangled reads like
"STNCE"). This module decides, per region, which ordered rescue steps fire from
``(prob, aspect_ratio)`` and provides the geometric pre-split. No model imports — the
vision re-read itself is wiring at the call site; here we only decide and split.
"""
import math
from typing import List, Tuple

Box = Tuple[float, float, float, float]


def ocr_rescue_steps(prob: float, aspect_ratio: float,
                     quality_bar: float = 0.7, aspect_thresh: float = 6.0) -> List[str]:
    """Ordered rescue steps for a region. A confident read (``prob >= quality_bar``) needs
    none. Otherwise: pre-split first ONLY if the line is long-thin enough that shorter crops
    would read more reliably (``aspect_ratio >= aspect_thresh``), then always fall through to
    a vision re-read. Pure."""
    if prob >= quality_bar:
        return []
    steps = []
    if aspect_ratio >= aspect_thresh:
        steps.append('presplit')
    steps.append('vision')
    return steps


def split_overlong_box(box: Box, max_aspect: float = 4.0) -> List[Box]:
    """Split a long-thin textline box into contiguous horizontal segments each no wider
    than ``max_aspect``×height, so the 48px OCR reads shorter (more reliable) crops that are
    rejoined at the call site. A box within ``max_aspect`` is returned unchanged. Pure."""
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    if h <= 0 or w / h <= max_aspect:
        return [box]
    n = math.ceil((w / h) / max_aspect)
    edges = [x1 + round(w * i / n) for i in range(n + 1)]
    return [(edges[i], y1, edges[i + 1], y2) for i in range(n)]


def rejoin_segment_reads(reads) -> str:
    """Concatenate the per-segment OCR reads of one pre-split line back into a single string,
    in segment order (the crops were contiguous). Empty/None reads are dropped. Pure."""
    return ''.join(r for r in reads if r)
