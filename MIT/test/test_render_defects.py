"""Render-defect metric harness (#535 Phase-0c) — the missing regression gate.

Given (original page, rendered page, enriched regions payload) the harness counts
the four user-visible defect classes: empty-bubble, tiny/bloat size-ratio, rendered
dst-box overlap, sibling font asymmetry. Pure numpy — no ML stack; synthetic
fixtures keep every case deterministic and <1s.
"""
import numpy as np
import cv2

from eval.render_defects import (
    count_empty_bubbles,
    size_ratio_defects,
    overlap_defects,
    sibling_size_delta,
    page_scorecard,
)


def _page_with_text(boxes_with_text):
    img = np.full((200, 200), 240, np.uint8)
    for (x1, y1, x2, y2), txt in boxes_with_text:
        cv2.putText(img, txt, (x1 + 2, (y1 + y2) // 2), cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, 0, 2, cv2.LINE_AA)
    return img


# ---- empty-bubble: source had ink, render has (almost) none ----

def test_injected_empty_bubble_counts_exactly_one():
    original = _page_with_text([((10, 10, 90, 50), 'HELLO'), ((110, 110, 190, 150), 'WORLD')])
    rendered = _page_with_text([((10, 10, 90, 50), 'SAWASDEE')])   # WORLD erased, nothing drawn
    payload = [
        {'src': 'HELLO', 'dst': 'SAWASDEE', 'xyxy': [10, 10, 90, 50], 'rendered': True},
        {'src': 'WORLD', 'dst': 'LOK', 'xyxy': [110, 110, 190, 150], 'rendered': True},
    ]
    empties = count_empty_bubbles(original, rendered, payload)
    assert len(empties) == 1
    assert empties[0]['src'] == 'WORLD'


def test_no_empty_when_both_have_ink():
    original = _page_with_text([((10, 10, 90, 50), 'HELLO')])
    rendered = _page_with_text([((10, 10, 90, 50), 'HI')])
    payload = [{'src': 'HELLO', 'dst': 'HI', 'xyxy': [10, 10, 90, 50], 'rendered': True}]
    assert count_empty_bubbles(original, rendered, payload) == []


# ---- size-ratio: final font far from source lettering = tiny or bloat ----

def test_tiny_and_bloat_flagged_normal_passes():
    payload = [
        {'src': 'a', 'dst': 'b', 'font_src_px': 30, 'font_final_px': 10},   # 0.33x tiny
        {'src': 'c', 'dst': 'd', 'font_src_px': 20, 'font_final_px': 44},   # 2.2x bloat
        {'src': 'e', 'dst': 'f', 'font_src_px': 24, 'font_final_px': 22},   # ~0.9x fine
    ]
    flagged = size_ratio_defects(payload)
    kinds = sorted(d['kind'] for d in flagged)
    assert kinds == ['bloat', 'tiny'] and len(flagged) == 2


# ---- overlap: two rendered dst boxes intersecting ----

def test_overlapping_dst_boxes_flagged_once_per_pair():
    payload = [
        {'src': 'a', 'dst': 'x', 'dst_box': [10, 10, 60, 60]},
        {'src': 'b', 'dst': 'y', 'dst_box': [50, 50, 100, 100]},   # overlaps a
        {'src': 'c', 'dst': 'z', 'dst_box': [150, 150, 190, 190]}, # clear
    ]
    ov = overlap_defects(payload)
    assert len(ov) == 1 and {ov[0]['a_src'], ov[0]['b_src']} == {'a', 'b'}


# ---- sibling asymmetry: same-branch narrations rendered at very different sizes ----

def test_sibling_narration_size_delta_flagged():
    payload = [
        {'src': 'left cap', 'dst': 'l', 'branch': 'clean_layout', 'font_final_px': 18, 'font_src_px': 30},
        {'src': 'right cap', 'dst': 'r', 'branch': 'clean_layout', 'font_final_px': 34, 'font_src_px': 30},
    ]
    deltas = sibling_size_delta(payload)
    assert len(deltas) == 1
    assert deltas[0]['ratio'] > 1.5


# ---- scorecard: one dict the gate can diff run-over-run ----

def test_scorecard_totals_all_classes():
    original = _page_with_text([((10, 10, 90, 50), 'HELLO'), ((110, 110, 190, 150), 'WORLD')])
    rendered = _page_with_text([((10, 10, 90, 50), 'HI')])
    payload = [
        {'src': 'HELLO', 'dst': 'HI', 'xyxy': [10, 10, 90, 50], 'rendered': True,
         'font_src_px': 30, 'font_final_px': 10, 'dst_box': [10, 10, 90, 50], 'branch': 'clean_layout'},
        {'src': 'WORLD', 'dst': 'LOK', 'xyxy': [110, 110, 190, 150], 'rendered': True,
         'font_src_px': 30, 'font_final_px': 30, 'dst_box': [80, 40, 120, 80], 'branch': 'clean_layout'},
    ]
    card = page_scorecard(original, rendered, payload)
    assert card['empty_bubbles'] == 1        # WORLD erased
    assert card['size_defects'] == 1         # the 0.33x tiny
    assert card['overlaps'] == 1             # dst boxes intersect
    assert card['sibling_asymmetry'] == 1    # 10 vs 30 same-branch
    assert card['regions'] == 2
