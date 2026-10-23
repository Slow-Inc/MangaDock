"""Tests for the OCR second pass (manga_translator.ocr_reread)."""
import asyncio
import types

import numpy as np

from manga_translator.ocr_reread import (better_read, expand_box, has_suspicious_single, needs_reread,
                                         reread_enabled, reread_textlines)


def test_reread_enabled_flag():
    assert reread_enabled({'MIT_OCR_REREAD': '1'}) is True
    assert reread_enabled({'MIT_OCR_REREAD': 'true'}) is True
    assert reread_enabled({'MIT_OCR_REREAD': '0'}) is False
    assert reread_enabled({'MIT_OCR_REREAD': 'false'}) is False
    assert reread_enabled({}) is True  # default ON since 2026-10-23


def test_needs_reread_only_for_low_confidence_latin_lines():
    assert needs_reread('TO DEEEND', 0.51) is True
    assert needs_reread('TO DEEEND', 0.93) is False
    assert needs_reread('TO DEEEND', None) is False
    assert needs_reread('ภาษาอังกฤษดี', 0.3) is False
    assert needs_reread('東京', 0.3) is False
    assert needs_reread('AH', 0.3) is False


def test_expand_box_pads_and_clips():
    pts = np.array([[10, 10], [40, 10], [40, 20], [10, 20]], dtype=np.float32)
    assert expand_box(pts, 100, 100, 0.3) == (1, 7, 49, 23)
    assert expand_box(pts, 45, 100, 0.3)[2] == 45


def test_better_read_requires_a_confident_new_latin_text():
    assert better_read('TO DEEEND', 0.51, 'TO DEFEND', 0.90) is True
    assert better_read('TO DEEEND', 0.51, 'TO DEFEND', 0.55) is False
    assert better_read('TO DEEEND', 0.51, 'TO DEEEND', 0.99) is False
    assert better_read('TO DEEEND', 0.51, '東京', 0.99) is False
    assert better_read('TO DEEEND', 0.51, '', 0.99) is False


def test_reread_replaces_only_improved_lines_and_respects_the_cap():
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    good = types.SimpleNamespace(text='TO DEEEND', prob=0.51,
                                 pts=np.array([[10, 10], [60, 10], [60, 30], [10, 30]], dtype=np.float32))
    high = types.SimpleNamespace(text='HELLO THERE', prob=0.95,
                                 pts=np.array([[10, 40], [60, 40], [60, 60], [10, 60]], dtype=np.float32))
    calls = []

    async def fake_dispatch(ocr_key, canvas, quads, cfg, device, verbose):
        calls.append((ocr_key, canvas.shape, len(quads)))
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


def test_reread_maps_multiple_candidates_by_slot_even_when_the_model_returns_them_out_of_order():
    image = np.zeros((120, 200, 3), dtype=np.uint8)
    first = types.SimpleNamespace(text='TO DEEEND', prob=0.40,
                                  pts=np.array([[10, 10], [180, 10], [180, 30], [10, 30]], dtype=np.float32))
    second = types.SimpleNamespace(text='SLAND AND', prob=0.47,
                                   pts=np.array([[10, 50], [180, 50], [180, 70], [10, 70]], dtype=np.float32))

    async def fake_dispatch(ocr_key, canvas, quads, cfg, device, verbose):
        assert len(quads) == 2
        out = []
        # deliberately reversed order: map back by the y span of each pasted crop
        for q, text in ((quads[1], 'ISLAND AND'), (quads[0], 'TO DEFEND')):
            ys = q.pts[:, 1]
            out.append(types.SimpleNamespace(text=text, prob=0.90,
                                             pts=np.array([[0, ys.min()], [50, ys.min()], [50, ys.max()], [0, ys.max()]],
                                                          dtype=np.float32)))
        return out

    changed = asyncio.run(reread_textlines(image, [first, second], '48px', None, 'cpu', fake_dispatch))
    assert changed == 2
    assert first.text == 'TO DEFEND'
    assert second.text == 'ISLAND AND'


def test_a_dispatch_failure_never_breaks_the_ocr_stage():
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    line = types.SimpleNamespace(text='TO DEEEND', prob=0.40,
                                 pts=np.array([[10, 10], [60, 10], [60, 30], [10, 30]], dtype=np.float32))

    async def exploding_dispatch(*args, **kwargs):
        raise RuntimeError('model exploded')

    assert asyncio.run(reread_textlines(image, [line], '48px', None, 'cpu', exploding_dispatch)) == 0
    assert line.text == 'TO DEEEND'  # first read kept, OCR stage continues


def test_single_letter_ocr_garbles_are_reread_even_at_high_confidence():
    # measured: `AH-DO YOU N LIKE THESE SNACKS?` lost the NOT; re-read restored it 3/3 runs
    assert has_suspicious_single("AH-DO YOU N LIKE THESE SNACKS?")
    assert not has_suspicious_single("I AM HERE")
    assert not has_suspicious_single("A GOOD IDEA")
    assert needs_reread("AH-DO YOU N LIKE THESE SNACKS?", 0.95)
    assert better_read("AH-DO YOU N LIKE THESE SNACKS?", 0.78, "AH- DO YOU NOT LIKE THESE SNACKS?", 0.68)
    assert not better_read("AH-DO YOU N LIKE THESE SNACKS?", 0.78, "AH-DO YOU N LIKE THESE SNACKS?", 0.99)


def test_a_suspicious_line_never_swaps_one_garble_for_another():
    # measured: `DOWN HERE S` re-read as `DOWN HERE F`; both are garbles, so no change may be applied
    assert not better_read("TREASURE DOWN HERE S", 0.29, "TREASURE DOWN HERE F", 0.54)
    assert better_read("TREASURE DOWN HERE S", 0.29, "TREASURE DOWN HERE.", 0.54)


def test_suspicious_lines_get_a_wider_re_read_crop():
    image = np.zeros((200, 400, 3), dtype=np.uint8)
    normal = types.SimpleNamespace(text='TO DEEEND', prob=0.40,
                                   pts=np.array([[100, 40], [260, 40], [260, 70], [100, 70]], dtype=np.float32))
    suspicious = types.SimpleNamespace(text='YOU N', prob=0.40,
                                       pts=np.array([[100, 120], [260, 120], [260, 150], [100, 150]], dtype=np.float32))
    shapes = []

    async def fake_dispatch(ocr_key, canvas, quads, cfg, device, verbose):
        shapes.append((canvas.shape[1], canvas.shape[0]))
        return [types.SimpleNamespace(text='TO DEFEND', prob=0.9, pts=np.array(quads[0].pts))] * len(quads)

    asyncio.run(reread_textlines(image, [normal, suspicious], '48px', None, 'cpu', fake_dispatch))
    assert len(shapes) == 1
    # both crops are pasted on one canvas; its width must fit the wider (suspicious) crop
    assert shapes[0][0] >= int((260 - 100) * (1 + 2 * 0.3 * 1.7))
