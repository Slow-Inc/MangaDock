"""#278 — SFX rescue gated on det_sfx provenance, not a length heuristic.

The target-independent SFX rescue used to fire for ANY <=4-char region in a large
box, sending short dialogue (`は？`, `おい`, `HUH?`) to the vision gateway and adding a
~1-2s round-trip to every translate. This pins the replacement: a provenance flag
(`is_sfx`) set ONLY on the textlines `merge_sfx_detections` appends (the det_sfx
second pass), threaded through textline_merge to the TextBlock region, so the rescue
fires on provenance — never on a length heuristic over normal dialogue.
"""
import numpy as np

from manga_translator.utils.generic import Quadrilateral
from manga_translator.utils.textblock import TextBlock


def _quad(text='', is_sfx=False):
    pts = np.array([[0, 0], [10, 0], [10, 10], [0, 10]], dtype=np.float32)
    return Quadrilateral(pts, text, 1.0, is_sfx=is_sfx)


# --- A1: Quadrilateral carries det_sfx provenance ---

def test_quadrilateral_is_sfx_defaults_false():
    pts = np.array([[0, 0], [10, 0], [10, 10], [0, 10]], dtype=np.float32)
    assert Quadrilateral(pts, '', 1.0).is_sfx is False


def test_quadrilateral_is_sfx_settable_true():
    assert _quad(is_sfx=True).is_sfx is True


# --- A2: TextBlock carries det_sfx provenance ---

def test_textblock_is_sfx_defaults_false():
    lines = [[[0, 0], [10, 0], [10, 10], [0, 10]]]
    assert TextBlock(lines, ['hi']).is_sfx is False


def test_textblock_is_sfx_settable_true():
    lines = [[[0, 0], [10, 0], [10, 10], [0, 10]]]
    assert TextBlock(lines, [''], is_sfx=True).is_sfx is True


# --- A3: textline_merge propagates provenance from textline to region ---

def _box_quad(x, y, w, h, text='', is_sfx=False):
    pts = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], dtype=np.float32)
    return Quadrilateral(pts, text, 1.0, is_sfx=is_sfx)


def test_textline_merge_flags_region_with_sfx_textline():
    import asyncio
    from manga_translator.textline_merge import dispatch
    # one SFX textline (top-left) + one normal dialogue line (far bottom-right) →
    # two distinct regions; only the SFX one carries provenance.
    sfx = _box_quad(0, 0, 40, 40, text='', is_sfx=True)
    dialogue = _box_quad(900, 900, 60, 24, text='hello', is_sfx=False)
    regions = asyncio.run(dispatch([sfx, dialogue], width=1000, height=1000))
    sfx_regions = [r for r in regions if r.is_sfx]
    plain_regions = [r for r in regions if not r.is_sfx]
    assert len(sfx_regions) == 1
    assert len(plain_regions) == 1
    assert plain_regions[0].text == 'hello'


def test_textline_merge_no_sfx_means_region_not_flagged():
    import asyncio
    from manga_translator.textline_merge import dispatch
    dialogue = _box_quad(900, 900, 60, 24, text='hello', is_sfx=False)
    regions = asyncio.run(dispatch([dialogue], width=1000, height=1000))
    assert all(r.is_sfx is False for r in regions)


# --- A4: merge_sfx_detections stamps provenance on the boxes it appends ---

def test_merge_sfx_detections_flags_appended_textlines(monkeypatch):
    from types import SimpleNamespace
    import manga_translator.sfx_detector as sfx_detector
    import manga_translator.sfx_merge as sfx_merge
    from manga_translator.detection_postproc import merge_sfx_detections
    monkeypatch.setattr(sfx_detector, 'detect_sfx_boxes', lambda img, device: [(0, 0, 30, 30)])
    monkeypatch.setattr(sfx_merge, 'dedup_sfx_boxes', lambda existing, boxes: boxes)
    ctx = SimpleNamespace(img_rgb=np.zeros((100, 100, 3), dtype=np.uint8))
    textlines, _, _ = merge_sfx_detections(ctx, ([], 'mask_raw', 'mask'), device='cpu')
    assert len(textlines) == 1
    assert textlines[0].is_sfx is True


# --- A5: the rescue gate — provenance AND geometry, never a length heuristic ---

def test_should_rescue_sfx_true_for_sfx_region_in_large_box():
    from manga_translator.ocr_vlm import should_rescue_sfx
    assert should_rescue_sfx(True, 0, 0, 80, 80) is True


def test_should_rescue_sfx_false_for_short_dialogue_in_large_box():
    # THE core fix: a non-SFX region (short dialogue like `は？`/`HUH?` the primary
    # detector found) is NEVER rescued, however large its bubble.
    from manga_translator.ocr_vlm import should_rescue_sfx
    assert should_rescue_sfx(False, 0, 0, 200, 200) is False


def test_should_rescue_sfx_false_for_tiny_sfx_box():
    from manga_translator.ocr_vlm import should_rescue_sfx
    assert should_rescue_sfx(True, 0, 0, 20, 20) is False        # area 400 < 3600


def test_should_rescue_sfx_false_for_thin_sfx_box():
    from manga_translator.ocr_vlm import should_rescue_sfx
    assert should_rescue_sfx(True, 0, 0, 400, 20) is False       # min side 20 < 24
