"""SFX detection second-pass merge (#187 seam S13 / #168).

`merge_sfx_detections` + `textline_aabb` moved off the god object. The #168 SFX-merge
logic itself (IoA dedup) is already covered by `test_sfx_merge`; this pins the moved
helpers — the pure AABB and the `det_sfx`-off-style identity short-circuit (when the SFX
detector returns no boxes, `result` is returned unchanged).
"""
from types import SimpleNamespace

import numpy as np

import manga_translator.detection_postproc as dp
from manga_translator.detection_postproc import merge_sfx_detections, textline_aabb


def _quad(x1, y1, x2, y2):
    return SimpleNamespace(pts=np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32))


def test_textline_aabb_returns_min_max_floats():
    q = _quad(3, 5, 11, 20)
    assert textline_aabb(q) == (3.0, 5.0, 11.0, 20.0)


def test_merge_identity_when_no_sfx_boxes(monkeypatch):
    # detector finds nothing -> result returned unchanged (same object)
    import manga_translator.sfx_detector as sfx_detector
    monkeypatch.setattr(sfx_detector, 'detect_sfx_boxes', lambda img, device: [])
    ctx = SimpleNamespace(img_rgb=np.zeros((4, 4, 3), dtype=np.uint8))
    result = (['textline'], 'mask_raw', 'mask')
    out = merge_sfx_detections(ctx, result, device='cpu')
    assert out is result  # identity short-circuit


# ---- #535 empty-balloon rescue: a balloon with INK but no textline = missed text ----

def _ink_map(values):
    """ink_of_box stub: exact-match boxes get their value; clipped sub-boxes get a
    proportional share of the containing balloon's ink (uniform-ink approximation)."""
    def ink(box):
        box = tuple(float(v) for v in box)
        if box in values:
            return values[box]
        # proportional share of the smallest registered box containing it
        for b, v in values.items():
            if box[0] >= b[0] and box[1] >= b[1] and box[2] <= b[2] and box[3] <= b[3]:
                area_b = max(1.0, (b[2]-b[0])*(b[3]-b[1]))
                area = max(0.0, (box[2]-box[0])*(box[3]-box[1]))
                return v * area / area_b
        return 0
    return ink


def test_normal_bubble_with_textline_over_its_ink_is_covered():
    # a speech bubble's text covers only ~15% of the balloon AREA but ~all of its INK
    # — must NOT be rescued (v6 live: duplicated every dialogue bubble).
    from manga_translator.detection_postproc import empty_balloon_boxes
    balloon = (0.0, 0.0, 200.0, 200.0)
    text = (60.0, 80.0, 140.0, 120.0)          # 3200 px² of 40000 (8% area)
    ink = lambda box: 900 if (abs(box[0]-60) < 1 and abs(box[1]-80) < 1) else (1000 if box == balloon else 0)
    got = empty_balloon_boxes([balloon], [text], ink, min_ink=100)
    assert got == []                            # 90% of the ink is inside the textline


def test_caption_with_stray_sliver_over_little_ink_is_rescued():
    from manga_translator.detection_postproc import empty_balloon_boxes
    balloon = (0.0, 0.0, 200.0, 200.0)
    sliver = (10.0, 10.0, 60.0, 20.0)
    ink = lambda box: 40 if (abs(box[0]-10) < 1 and abs(box[1]-10) < 1) else (2000 if box == balloon else 0)
    got = empty_balloon_boxes([balloon], [sliver], ink, min_ink=100)
    assert got == [balloon]                     # sliver covers 2% of the ink → missed text


def test_truly_empty_balloon_is_not_rescued():
    from manga_translator.detection_postproc import empty_balloon_boxes
    got = empty_balloon_boxes([(0.0, 0.0, 100.0, 100.0)], [], lambda box: 5, min_ink=100)
    assert got == []


# ---- #535 ink-cluster completeness: text ink on a LIGHT bg with no region = missed ----

def _page_with(draw):
    import numpy as np, cv2
    img = np.full((400, 400), 240, np.uint8)
    draw(img, cv2)
    return img

def test_uncovered_typeset_block_is_found():
    from manga_translator.detection_postproc import uncovered_text_clusters
    def draw(img, cv2):
        for i, line in enumerate(['STARTING WITH', 'THE HEROINE', 'WHO IS CLEAN']):
            cv2.putText(img, line, (60, 80 + i * 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, 0, 2)
    img = _page_with(draw)
    got = uncovered_text_clusters(img, covered_boxes=[])
    assert len(got) == 1
    x1, y1, x2, y2 = got[0]
    assert x1 < 70 and y1 < 70 and x2 > 200 and y2 > 150     # covers the block


def test_covered_block_is_skipped():
    from manga_translator.detection_postproc import uncovered_text_clusters
    def draw(img, cv2):
        cv2.putText(img, 'HELLO WORLD', (60, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, 0, 2)
    img = _page_with(draw)
    got = uncovered_text_clusters(img, covered_boxes=[(40, 60, 320, 130)])
    assert got == []


def test_dense_dark_art_is_rejected():
    from manga_translator.detection_postproc import uncovered_text_clusters
    def draw(img, cv2):
        img[50:250, 50:250] = 40                              # solid dark art block
    img = _page_with(draw)
    got = uncovered_text_clusters(img, covered_boxes=[])
    assert got == []                                          # too dense = art, not text


# ---- #535 white caption boxes: bright rectangles are balloons the YOLO can't see ----

def test_white_caption_box_detected():
    import numpy as np, cv2
    from manga_translator.detection_postproc import white_box_candidates
    img = np.full((600, 600), 120, np.uint8)          # mid-gray art page
    img[60:260, 50:300] = 245                          # big white caption box (~14% of page)
    cv2.putText(img, 'STARTING WITH', (70, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 30, 2)
    got = white_box_candidates(img)
    assert len(got) == 1
    x1, y1, x2, y2 = got[0]
    assert x1 >= 45 and y1 >= 55 and x2 <= 305 and y2 <= 265


def test_small_or_irregular_bright_areas_ignored():
    import numpy as np, cv2
    from manga_translator.detection_postproc import white_box_candidates
    img = np.full((400, 400), 120, np.uint8)
    img[10:40, 10:40] = 245                            # too small
    tri = np.array([[80, 300], [300, 300], [80, 80]])  # bright triangle = low fill
    cv2.fillPoly(img, [tri], 245)
    got = white_box_candidates(img)
    assert got == []
