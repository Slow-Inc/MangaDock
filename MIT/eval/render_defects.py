"""Render-defect metric harness (#535 Phase-0c) — the regression gate that was missing.

Counts the four user-visible defect classes on a translated page, given the original
page, the rendered page, and the enriched /patches regions payload (text_layer):

- empty-bubble: the source region had ink but the render has (almost) none — the
  erase-without-render "white empty bubble" (root-cause report §2.4).
- size-ratio: the final font is far smaller (tiny) or larger (bloat) than the
  source lettering — checklist items 2 and the One-Punch narration bloat.
- overlap: two rendered dst boxes intersect — text-over-text (item 7).
- sibling asymmetry: same-branch regions with similar source lettering rendered at
  very different final sizes — the "left ≠ right caption" defect.

Dependency-light on purpose (numpy/cv2 only — no ML), modeled on
eval/translation_eval.py, so a full-chapter sweep runs in seconds and unit tests
in <1s. Every render change must not worsen any count (the standing gate).
"""
from typing import Dict, List

import numpy as np

INK_THRESH = 128          # gray < INK_THRESH counts as ink
MIN_SRC_INK = 30          # px of source ink for a region to qualify as "had text"
EMPTY_RATIO = 0.10        # rendered ink below this fraction of source ink = empty
TINY_RATIO = 0.5          # final/src font below this = tiny
BLOAT_RATIO = 2.0         # final/src font above this = bloat
SIBLING_RATIO = 1.5       # same-branch font ratio above this = asymmetry
SIBLING_SRC_TOL = 1.3     # ...but only when source lettering was similar (<= this ratio)


def _ink(gray: np.ndarray, box) -> int:
    x1, y1, x2, y2 = (max(0, int(v)) for v in box)
    crop = gray[y1:y2, x1:x2]
    return int((crop < INK_THRESH).sum()) if crop.size else 0


def _gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 3:
        import cv2
        return cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return img


def count_empty_bubbles(original, rendered, payload: List[Dict]) -> List[Dict]:
    """Regions whose source box had ink but whose rendered box is (nearly) blank."""
    og, rg = _gray(original), _gray(rendered)
    out = []
    for p in payload:
        box = p.get('xyxy')
        if box is None or p.get('rendered') is False:
            continue
        src_ink = _ink(og, box)
        if src_ink < MIN_SRC_INK:
            continue
        if _ink(rg, box) < EMPTY_RATIO * src_ink:
            out.append({'src': p.get('src', ''), 'xyxy': box, 'src_ink': src_ink})
    return out


def size_ratio_defects(payload: List[Dict]) -> List[Dict]:
    """Final font far from the source lettering: tiny (<TINY_RATIO) or bloat (>BLOAT_RATIO)."""
    out = []
    for p in payload:
        src, final = p.get('font_src_px'), p.get('font_final_px')
        if not src or not final:
            continue
        ratio = final / src
        if ratio < TINY_RATIO:
            out.append({'src': p.get('src', ''), 'kind': 'tiny', 'ratio': round(ratio, 2)})
        elif ratio > BLOAT_RATIO:
            out.append({'src': p.get('src', ''), 'kind': 'bloat', 'ratio': round(ratio, 2)})
    return out


def overlap_defects(payload: List[Dict]) -> List[Dict]:
    """Pairs of rendered dst boxes that intersect (text-over-text)."""
    boxes = [(p.get('src', ''), p['dst_box']) for p in payload if p.get('dst_box')]
    out = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            (sa, a), (sb, b) = boxes[i], boxes[j]
            ix = min(a[2], b[2]) - max(a[0], b[0])
            iy = min(a[3], b[3]) - max(a[1], b[1])
            if ix > 0 and iy > 0:
                out.append({'a_src': sa, 'b_src': sb, 'intersection_px': int(ix * iy)})
    return out


def sibling_size_delta(payload: List[Dict]) -> List[Dict]:
    """Same-branch regions with similar source lettering rendered at very different
    final sizes — the left-vs-right caption asymmetry."""
    out = []
    entries = [p for p in payload if p.get('branch') and p.get('font_final_px') and p.get('font_src_px')]
    for i in range(len(entries)):
        for j in range(i + 1, len(entries)):
            a, b = entries[i], entries[j]
            if a['branch'] != b['branch']:
                continue
            src_ratio = max(a['font_src_px'], b['font_src_px']) / max(1, min(a['font_src_px'], b['font_src_px']))
            if src_ratio > SIBLING_SRC_TOL:
                continue                      # sources genuinely differed — not asymmetry
            ratio = max(a['font_final_px'], b['font_final_px']) / max(1, min(a['font_final_px'], b['font_final_px']))
            if ratio > SIBLING_RATIO:
                out.append({'a_src': a.get('src', ''), 'b_src': b.get('src', ''),
                            'ratio': round(ratio, 2), 'branch': a['branch']})
    return out


def page_scorecard(original, rendered, payload: List[Dict]) -> Dict:
    """One dict per page the gate can diff run-over-run — a render change that
    worsens any count does not ship."""
    return {
        'regions': len(payload),
        'empty_bubbles': len(count_empty_bubbles(original, rendered, payload)),
        'size_defects': len(size_ratio_defects(payload)),
        'overlaps': len(overlap_defects(payload)),
        'sibling_asymmetry': len(sibling_size_delta(payload)),
    }
