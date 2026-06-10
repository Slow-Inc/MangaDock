"""Characterization golden for put_char_horizontal / put_char_vertical (#189).

Pins the exact rendered canvas (text + border) and advance for a set of
representative glyphs across both directions, border on/off, two sizes. This is
the byte-identical guard while the two ~200-line near-duplicate functions are
deduplicated into shared, direction-parameterized helpers (stroke render,
bitmap paste). If a refactor shifts a single pixel of glyph or stroke
placement, array_equal fails here.

Golden arrays live in test/testdata/render/put_char_golden.npz (committed). The
first run generates the snapshot and skips; every run after asserts against it.
To regenerate intentionally (only when a pixel change is expected and reviewed),
delete the npz and re-run.
"""
import os

import numpy as np
import pytest

from manga_translator.rendering import text_render as tr

GOLDEN = os.path.join(os.path.dirname(__file__), 'golden', 'put_char_golden.npz')

# (char, font_size, border_size) — covers Latin, CJK, Thai base, Thai combining
# mark (np.maximum accumulate path), CJK punctuation (vertical is_punctuation +
# rotation), CJK bracket (vertical CJK_Compatibility rotation), and space
# (invalid-bitmap advance-only early return).
CASES = [
    ('A', 24, 0), ('A', 48, 4),
    ('日', 24, 0), ('日', 48, 4),   # 日
    ('ก', 48, 4), ('ำ', 48, 4),    # ก, ำ (Thai base + sara am)
    ('、', 48, 4), ('（', 48, 4),    # 、, （
    (' ', 48, 4),
]
CANVAS = 160


def _render(direction, cdpt, font_size, border):
    text = np.zeros((CANVAS, CANVAS), dtype=np.uint8)
    border_c = np.zeros((CANVAS, CANVAS), dtype=np.uint8)
    if direction == 0:
        adv = tr.put_char_horizontal(font_size, cdpt, [40, 110], text, border_c, border)
    else:
        adv = tr.put_char_vertical(font_size, cdpt, [40, 30], text, border_c, border)
    return adv, text, border_c


def _all_cases():
    tr.set_font('')
    out = {}
    advances = []
    for i, (cdpt, fs, bs) in enumerate(CASES):
        for d in (0, 1):
            adv, text, border_c = _render(d, cdpt, fs, bs)
            out[f'{i}_{d}_text'] = text
            out[f'{i}_{d}_border'] = border_c
            advances.append(int(adv))
    out['advances'] = np.array(advances, dtype=np.int64)
    return out


def test_put_char_byte_identical():
    rendered = _all_cases()
    if not os.path.exists(GOLDEN):
        os.makedirs(os.path.dirname(GOLDEN), exist_ok=True)
        np.savez_compressed(GOLDEN, **rendered)
        pytest.skip(f'generated golden snapshot at {GOLDEN}; re-run to assert')
    golden = np.load(GOLDEN)
    assert np.array_equal(rendered['advances'], golden['advances']), 'advance drift'
    for key in rendered:
        if key == 'advances':
            continue
        assert np.array_equal(rendered[key], golden[key]), f'pixel drift in {key}'


def test_paste_bitmap_offsets_source_when_clipped_off_top_left():
    """_paste_bitmap (now shared by all four put_char paste sites) offsets the
    SOURCE slice when the placement runs off the top/left edge, instead of
    pasting the source from its own (0,0). This is the corrected vertical-stroke
    clipping (#189 S2): the old put_char_vertical border paste clamped pen_border
    to >=0 and sliced bitmap_border[0:...], misaligning a stroke clipped at the
    edge. Unreachable on padded render canvases (hence golden stays byte-identical),
    pinned here so the four-site unification to correct clipping stays intentional.
    """
    canvas = np.zeros((10, 10), dtype=np.uint8)
    # 4x4 bitmap, a distinct value per row so a misaligned paste is detectable.
    bmp = np.array([[1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3], [4, 4, 4, 4]], dtype=np.uint8)
    # place at (-2, -2): only the bottom-right 2x2 (src rows/cols 2..3) lands at canvas[0:2, 0:2].
    tr._paste_bitmap(canvas, bmp, -2, -2, np.maximum)
    assert canvas[0:2, 0:2].tolist() == [[3, 3], [4, 4]]   # src rows 2,3 — offset, not rows 0,1
    assert int(canvas[2:, :].sum()) == 0 and int(canvas[:, 2:].sum()) == 0
