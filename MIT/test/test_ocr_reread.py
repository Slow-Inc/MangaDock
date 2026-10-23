"""Tests for the opt-in OCR second pass (manga_translator.ocr_reread)."""
import asyncio
import types

import numpy as np

from manga_translator.ocr_reread import (better_read, expand_box, needs_reread, reread_enabled,
                                         reread_textlines)


def test_reread_enabled_flag():
    assert reread_enabled({'MIT_OCR_REREAD': '1'}) is True
    assert reread_enabled({'MIT_OCR_REREAD': 'true'}) is True
    assert reread_enabled({'MIT_OCR_REREAD': '0'}) is False
    assert reread_enabled({'MIT_OCR_REREAD': 'false'}) is False
    assert reread_enabled({}) is True  # default ON since 2026-10-23


def test_needs_reread_only_for_low_confidence_latin_lines():
    assert needs_reread("TO DEEEND", 0.51) is True
    assert needs_reread("TO DEEEND", 0.93) is False
    assert needs_reread("TO DEEEND", None) is False
    assert needs_reread("ภาษาอังกฤษดี", 0.3) is False
    assert needs_reread("東京", 0.3) is False
    assert needs_reread("AH", 0.3) is False


def test_expand_box_pads_and_clips():
    pts = np.array([[10, 10], [40, 10], [40, 20], [10, 20]], dtype=np.float32)
    assert expand_box(pts, 100, 100, 0.3) == (1, 7, 49, 23)
    assert expand_box(pts, 45, 100, 0.3)[2] == 45


def test_better_read_requires_a_confident_new_latin_text():
    assert better_read("TO DEEEND", 0.51, "TO DEFEND", 0.90) is True
    assert better_read("TO DEEEND", 0.51, "TO DEFEND", 0.55) is False
    assert better_read("TO DEEEND", 0.51, "TO DEEEND", 0.99) is False
    assert better_read("TO DEEEND", 0.51, "東京", 0.99) is False
    assert better_read("TO DEEEND", 0.51, "", 0.99) is False


def test_reread_replaces_only_improved_lines_and_respects_the_cap():
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    good = types.SimpleNamespace(text='TO DEEEND', prob=0.51, pts=np.array([[10, 10], [60, 10], [60, 30], [10, 30]], dtype=np.float32))
    high = types.SimpleNamespace(text='HELLO THERE', prob=0.95, pts=np.array([[10, 40], [60, 40], [60, 60], [10, 60]], dtype=np.float32))
    calls = []

    async def fake_dispatch(ocr_key, canvas, quads, cfg, device, verbose):
        calls.append((ocr_key, canvas.shape, len(quads)))
        # echo one read back for the first slot (canvas coordinates of the pasted crop)
        assert len(quads) == 1
        h = int(quads[0].pts[:, 1].max())
        return [types.SimpleNamespace(text='TO DEFEND', prob=0.90,
                                      pts=np.array([[0, 0], [50, 0], [50, h], [0, h]], dtype=np.float32))]

    changed = asyncio.run(reread_textlines(image, [good, high], '48px', None, 'cpu', fake_dispatch))
    assert changed == 1
    assert good.text == 'TO DEFEND'
    assert high.text == 'HELLO THERE'
    assert len(calls) == 1
    assert calls[0][2] == 1

