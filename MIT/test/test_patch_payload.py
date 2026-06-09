"""Patch-result normalization (#158) — one seam for the single-page response
and the per-page webhook payload (previously duplicated in main.py and
batch_runner.py). Import-light: json/base64 only.
"""
import base64

from server.patch_payload import normalize_patch_result


def test_carries_the_text_layer_alongside_patches():
    raw = {
        "img_width": 100,
        "img_height": 200,
        "patches": [{"x": 1, "y": 2, "w": 3, "h": 4, "img_png": b"PNG"}],
        "regions": [{"src": "Huh?", "dst": "หา?"}],
    }
    out = normalize_patch_result(raw)
    assert out["img_width"] == 100
    assert out["img_height"] == 200
    assert out["patches"] == [
        {"x": 1, "y": 2, "w": 3, "h": 4, "img_b64": base64.b64encode(b"PNG").decode("utf-8")},
    ]
    assert out["regions"] == [{"src": "Huh?", "dst": "หา?"}]


def test_old_worker_result_without_regions_still_normalizes():
    out = normalize_patch_result({"img_width": 10, "img_height": 20, "patches": []})
    assert out == {"img_width": 10, "img_height": 20, "patches": [], "regions": []}
