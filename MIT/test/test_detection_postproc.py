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

def test_inked_balloon_without_textline_is_selected():
    from manga_translator.detection_postproc import empty_balloon_boxes
    balloons = [(0, 0, 100, 100), (200, 200, 300, 300)]
    textlines = [(10, 10, 90, 40)]                     # 24% of balloon 1 = covered
    ink = lambda box: 500                              # both have ink
    got = empty_balloon_boxes(balloons, textlines, ink, min_ink=100)
    assert got == [(200, 200, 300, 300)]               # balloon 2: ink but no textline


def test_truly_empty_balloon_is_not_rescued():
    from manga_translator.detection_postproc import empty_balloon_boxes
    balloons = [(0, 0, 100, 100)]
    got = empty_balloon_boxes(balloons, [], lambda box: 5, min_ink=100)
    assert got == []                                   # no ink → nothing to read → no VLM bait


def test_textline_center_inside_counts_as_covered():
    from manga_translator.detection_postproc import empty_balloon_boxes
    balloons = [(0, 0, 100, 100)]
    textlines = [(80, 80, 160, 160)]                   # center (120,120) OUTSIDE
    got = empty_balloon_boxes(balloons, textlines, lambda box: 500, min_ink=100)
    assert got == [(0, 0, 100, 100)]                   # not covered → selected


def test_balloon_with_only_a_stray_sliver_is_still_rescued():
    # thr=0.3 can leave one faint sliver inside the box (it dies later at OCR),
    # which defeated the center-containment check — coverage must be AREA-based.
    from manga_translator.detection_postproc import empty_balloon_boxes
    balloons = [(0, 0, 200, 200)]                       # 40000 px²
    textlines = [(10, 10, 60, 20)]                      # 500 px² = 1.25% coverage
    got = empty_balloon_boxes(balloons, textlines, lambda b: 5000, min_ink=100)
    assert got == [(0, 0, 200, 200)]


def test_balloon_substantially_covered_is_not_rescued():
    from manga_translator.detection_postproc import empty_balloon_boxes
    balloons = [(0, 0, 200, 200)]
    textlines = [(10, 10, 190, 120)]                    # ~50% coverage
    got = empty_balloon_boxes(balloons, textlines, lambda b: 5000, min_ink=100)
    assert got == []
