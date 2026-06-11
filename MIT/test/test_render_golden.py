"""Characterization golden for the render dispatch path (#190).

dispatch() drives both functions #190 touches — resize_regions_to_font_size
(font/box sizing) and render() (ratio box-padding + warp). This pins the final
rendered image byte-for-byte over three regions that between them exercise:
horizontal single-axis expansion, vertical single-axis expansion, the legacy
length-ratio path, and render()'s h/v box-padding branches — all with
bubble_fit=False, the path the refactor must keep byte-identical.

Golden array lives in test/golden/render_dispatch_golden.npz (committed). First
run generates + skips; later runs assert. Delete the npz to regenerate when a
pixel change is expected and reviewed.
"""
import asyncio
import os

import numpy as np
import pytest

from manga_translator.rendering import dispatch as dispatch_rendering
from manga_translator.utils import TextBlock

GOLDEN = os.path.join(os.path.dirname(__file__), 'golden', 'render_dispatch_golden.npz')


def _regions():
    h_long = TextBlock(
        [[[20, 20], [600, 20], [20, 240], [600, 240]]],
        texts=['x', 'y'],
        translation='The quick brown fox jumps over the lazy dog repeatedly today and tomorrow',
        direction='h', target_lang='ENG', font_size=40,
    )
    h_short = TextBlock(
        [[[20, 300], [600, 300], [20, 520], [600, 520]]],
        texts=['hello world foo bar'],
        translation='Hi!',
        direction='h', target_lang='ENG', font_size=40,
    )
    v_cjk = TextBlock(
        [[[700, 20], [900, 20], [700, 700], [900, 700]]],
        texts=['日本'],
        translation='これはたてがきのテストですとてもながいぶんしょうになります',
        direction='v', target_lang='JPN', font_size=40,
    )
    regions = [h_long, h_short, v_cjk]
    for r in regions:
        r.set_font_colors([255, 255, 255], [0, 0, 0])
    return regions


def _render():
    img = np.zeros((720, 1000, 3), dtype=np.uint8)
    return asyncio.run(dispatch_rendering(img, _regions(), hyphenate=False))


def test_render_dispatch_byte_identical():
    out = _render()
    if not os.path.exists(GOLDEN):
        os.makedirs(os.path.dirname(GOLDEN), exist_ok=True)
        np.savez_compressed(GOLDEN, img=out)
        pytest.skip(f'generated golden snapshot at {GOLDEN}; re-run to assert')
    golden = np.load(GOLDEN)
    assert np.array_equal(out, golden['img']), 'render dispatch pixel drift'
