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
