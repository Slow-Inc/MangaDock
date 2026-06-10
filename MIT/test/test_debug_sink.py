"""Verbose debug-image sink (#187 seam S14).

Characterization of `debug_sink` — the scattered `if self.verbose: cv2.imwrite(...)`
blocks lifted byte-for-byte from the three drivers in `manga_translator.py`. The
verbose guard stays at each call site; these functions are the bodies. The
guarded-vs-unguarded divergence is load-bearing and pinned:

- save_input_png / save_inpainted / save_final — GUARDED (try/except + imwrite
  success check → warning), shared verbatim across drivers.
- save_mask_raw / save_bboxes_unfiltered / save_bboxes — UNGUARDED bare imwrite
  (an exception propagates), shared verbatim across drivers.

The streaming-placeholder branch in `_revert_upscale` (L11 `_is_streaming_mode`,
set nowhere in-repo) is flow control, not a debug save — it stays inline.
"""
import logging
import numpy as np
import pytest
from types import SimpleNamespace

import manga_translator.debug_sink as ds


def _rgb(h=4, w=5):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[..., 0] = 200  # R channel marker — BGR conversion swaps it to index 2
    return img


def _capture_imwrite(monkeypatch, ret=True):
    calls = []
    def fake(path, img):
        calls.append((path, img))
        return ret
    monkeypatch.setattr(ds.cv2, 'imwrite', fake)
    return calls


def _result_path(name):
    return f'RP/{name}'


# ---- save_input_png (guarded; verbatim ×2: single driver + patch driver) ----

def test_save_input_png_converts_rgb_to_bgr_and_writes(monkeypatch):
    calls = _capture_imwrite(monkeypatch)
    ds.save_input_png(_rgb(), _result_path)
    assert len(calls) == 1
    path, img = calls[0]
    assert path == 'RP/input.png'
    assert img[0, 0, 2] == 200 and img[0, 0, 0] == 0  # R moved to BGR index 2


def test_save_input_png_grayscale_skips_conversion(monkeypatch):
    calls = _capture_imwrite(monkeypatch)
    gray = np.full((4, 5), 7, dtype=np.uint8)
    ds.save_input_png(gray, _result_path)
    assert np.array_equal(calls[0][1], gray)


def test_save_input_png_is_guarded(monkeypatch, caplog):
    # imwrite returns False → warning; imwrite raises → error logged, no raise
    calls = _capture_imwrite(monkeypatch, ret=False)
    with caplog.at_level(logging.WARNING, logger='manga_translator'):
        ds.save_input_png(_rgb(), _result_path)
    assert any('Failed to save debug image: RP/input.png' in r.message for r in caplog.records)

    def boom(path, img):
        raise RuntimeError('disk full')
    monkeypatch.setattr(ds.cv2, 'imwrite', boom)
    with caplog.at_level(logging.ERROR, logger='manga_translator'):
        ds.save_input_png(_rgb(), _result_path)  # must not raise
    assert any('Error saving input.png debug image' in r.message for r in caplog.records)


# ---- save_mask_raw (UNGUARDED; verbatim ×2) ----

def test_save_mask_raw_writes_and_propagates_errors(monkeypatch):
    calls = _capture_imwrite(monkeypatch)
    mask = np.full((4, 5), 255, dtype=np.uint8)
    ds.save_mask_raw(mask, _result_path)
    assert calls == [('RP/mask_raw.png', mask)]

    def boom(path, img):
        raise RuntimeError('disk full')
    monkeypatch.setattr(ds.cv2, 'imwrite', boom)
    with pytest.raises(RuntimeError):  # unguarded — divergence pinned
        ds.save_mask_raw(mask, _result_path)


# ---- save_bboxes_unfiltered (UNGUARDED; draws on a copy; verbatim ×2) ----

def test_save_bboxes_unfiltered_draws_polylines_on_copy(monkeypatch):
    calls = _capture_imwrite(monkeypatch)
    img = _rgb(8, 8)
    before = img.copy()
    pts = np.array([[1, 1], [6, 1], [6, 6], [1, 6]], dtype=np.int32)
    ds.save_bboxes_unfiltered(img, [SimpleNamespace(pts=pts)], _result_path)
    assert calls[0][0] == 'RP/bboxes_unfiltered.png'
    assert np.array_equal(img, before)          # original untouched (np.copy)
    assert not np.array_equal(calls[0][1], img)  # polyline drawn on the copy


# ---- save_bboxes (UNGUARDED; show_panels/rtl derived from config) ----

def test_save_bboxes_forwards_config_derived_args(monkeypatch):
    calls = _capture_imwrite(monkeypatch)
    seen = {}
    sentinel = np.ones((2, 2, 3), dtype=np.uint8)
    def fake_viz(img, regions, show_panels, img_rgb, right_to_left):
        seen.update(show_panels=show_panels, right_to_left=right_to_left,
                    img_rgb_is_original=img_rgb is orig, regions=regions)
        return sentinel
    monkeypatch.setattr(ds, 'visualize_textblocks', fake_viz)
    orig = _rgb()
    regions = [object()]
    cfg = SimpleNamespace(force_simple_sort=False, render=SimpleNamespace(rtl=True))
    ds.save_bboxes(orig, regions, cfg, _result_path)
    assert seen == {'show_panels': True, 'right_to_left': True,
                    'img_rgb_is_original': True, 'regions': regions}
    assert calls == [('RP/bboxes.png', sentinel)]


# ---- save_inpainted (guarded; verbatim ×2: single + batch back-half) ----

def test_save_inpainted_guarded_write(monkeypatch, caplog):
    calls = _capture_imwrite(monkeypatch)
    ds.save_inpainted(_rgb(), _result_path)
    assert calls[0][0] == 'RP/inpainted.png'

    def boom(path, img):
        raise RuntimeError('x')
    monkeypatch.setattr(ds.cv2, 'imwrite', boom)
    with caplog.at_level(logging.ERROR, logger='manga_translator'):
        ds.save_inpainted(_rgb(), _result_path)  # guarded — no raise
    assert any('Error saving inpainted.png debug image' in r.message for r in caplog.records)


# ---- save_final (guarded; PIL-or-array in, grayscale skips conversion) ----

def test_save_final_guarded_and_grayscale_path(monkeypatch, caplog):
    calls = _capture_imwrite(monkeypatch)
    ds.save_final(_rgb(), _result_path)
    assert calls[0][0] == 'RP/final.png'
    assert calls[0][1][0, 0, 2] == 200  # BGR-converted

    gray = np.full((3, 3), 9, dtype=np.uint8)
    ds.save_final(gray, _result_path)
    assert np.array_equal(calls[1][1], gray)

    calls2 = _capture_imwrite(monkeypatch, ret=False)
    with caplog.at_level(logging.WARNING, logger='manga_translator'):
        ds.save_final(_rgb(), _result_path)
    assert any('Failed to save debug image: RP/final.png' in r.message for r in caplog.records)


# ============================================================================
# save_inpaint_preview / save_inpaint_preview_guarded — the load-bearing
# divergence: the single driver writes bare (exceptions propagate), the batch
# back-half wraps everything (incl. the preview render) in try/except with
# per-file success checks. Pinned as TWO functions, not a flag.
# `make_preview` is the caller's `dispatch_inpainting(Inpainter.none, ...)`.
# ============================================================================
import asyncio


def test_inpaint_preview_unguarded_writes_both_and_propagates(monkeypatch):
    calls = _capture_imwrite(monkeypatch)
    mask = np.full((4, 5), 255, dtype=np.uint8)

    async def make_preview():
        return _rgb()
    asyncio.run(ds.save_inpaint_preview(mask, _result_path, make_preview))
    assert [c[0] for c in calls] == ['RP/inpaint_input.png', 'RP/mask_final.png']
    assert calls[0][1][0, 0, 2] == 200          # preview BGR-converted
    assert np.array_equal(calls[1][1], mask)    # mask written raw

    async def boom():
        raise RuntimeError('inpaint preview failed')
    with pytest.raises(RuntimeError):           # unguarded — propagates
        asyncio.run(ds.save_inpaint_preview(mask, _result_path, boom))


def test_inpaint_preview_guarded_swallows_and_warns(monkeypatch, caplog):
    mask = np.full((4, 5), 255, dtype=np.uint8)

    # per-file success check → warning for each failed write
    calls = _capture_imwrite(monkeypatch, ret=False)
    async def make_preview():
        return _rgb()
    with caplog.at_level(logging.WARNING, logger='manga_translator'):
        asyncio.run(ds.save_inpaint_preview_guarded(mask, _result_path, make_preview))
    msgs = [r.message for r in caplog.records]
    assert any('Failed to save debug image: RP/inpaint_input.png' in m for m in msgs)
    assert any('Failed to save debug image: RP/mask_final.png' in m for m in msgs)

    # a preview failure is swallowed (the whole block is guarded)
    async def boom():
        raise RuntimeError('x')
    with caplog.at_level(logging.ERROR, logger='manga_translator'):
        asyncio.run(ds.save_inpaint_preview_guarded(mask, _result_path, boom))  # no raise
    assert any('Error saving debug images (inpaint_input.png, mask_final.png)' in r.message
               for r in caplog.records)
