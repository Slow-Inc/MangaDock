"""Every laid-out region carries render telemetry, and the /patches payload reports it (#628).

`text_layer.regions_payload()` copies `render_branch` / `render_font_px` / `render_dst_box` onto
the payload *when the attributes exist*, and `test_text_layer.py` covers that copying. Nothing
covers the other half: that `resize_regions_to_font_size` actually stamps them. A layout branch
added or reshuffled without a stamp leaves the payload silently thinner — every consumer is
`getattr`-safe, so nothing raises, the diagnostic just quietly stops being available.

That is not hypothetical for this branch: the ADR 030 render pivot replaced the whole layout
subsystem, and #628 was opened on the belief that the reconciled pass had stopped stamping. It
had not — but nothing would have said so either way.

Torch-free: `rendering` and `text_layer` both import without the ML stack, so this runs in the
`mit_logic` gate.
"""
import os

import numpy as np

from manga_translator.rendering import resize_regions_to_font_size, text_render
from manga_translator.text_layer import regions_payload
from manga_translator.utils import TextBlock

_FONT = os.path.join(os.path.dirname(__file__), '..', 'fonts', 'Arial-Unicode-Regular.ttf')


def _regions():
    """One region per layout branch the dispatcher can take."""
    plain = TextBlock(
        [[[20, 20], [200, 20], [20, 80], [200, 80]]],
        texts=['hello'], translation='Hi there',
        direction='h', target_lang='ENG', font_size=30,
    )
    balloon = TextBlock(
        [[[100, 100], [300, 100], [100, 250], [300, 250]]],
        texts=['x'], translation='A dialogue line inside a speech balloon',
        direction='h', target_lang='ENG', font_size=30,
    )
    balloon.bubble_box = (90, 90, 310, 260)
    vertical = TextBlock(
        [[[400, 20], [460, 20], [400, 300], [460, 300]]],
        texts=['日本'], translation='たてがきのテスト',
        direction='v', target_lang='JPN', font_size=30,
    )
    out = [plain, balloon, vertical]
    for r in out:
        r.set_font_colors([255, 255, 255], [0, 0, 0])
    return out


def _lay_out(regions, **kw):
    text_render.set_font(_FONT)
    img = np.zeros((720, 1000, 3), dtype=np.uint8)
    return resize_regions_to_font_size(
        img, regions, font_size_fixed=None, font_size_offset=0, font_size_minimum=8, **kw
    )


def test_payload_reports_branch_and_font_for_every_laid_out_region():
    """The join, which no single-module test covers.

    Three modules are coupled by the same string literals — `rendering` stamps
    `render_branch` / `render_font_px` / `render_dst_box`, `patch_renderer` copies them onto
    the originals, `text_layer` maps them into the payload — and each is tested in isolation
    with its own copy of those literals. Rename the attribute in one place and every isolated
    test still passes while the payload silently loses the field, because `regions_payload`
    reads with `getattr(..., None)` and skips what is absent. This walks the real chain.
    """
    regions = _regions()
    _lay_out(regions, bubble_fit=True, clean_layout=False)

    for i, entry in enumerate(regions_payload(regions)):
        missing = [k for k in ('branch', 'font_final_px', 'dst_box', 'rendered') if k not in entry]
        assert not missing, (
            f'region {i} was laid out but its /patches payload is missing {missing} — '
            f'the attribute names have drifted apart between rendering, patch_renderer and '
            f'text_layer, and every getattr-based consumer will fail silently (#628)'
        )


def test_every_laid_out_region_is_stamped_with_its_branch():
    regions = _regions()
    _lay_out(regions, bubble_fit=True, clean_layout=False)

    unstamped = [i for i, r in enumerate(regions) if getattr(r, 'render_branch', None) is None]
    assert not unstamped, (
        f'regions {unstamped} came out of the layout pass with no render_branch — the '
        f'/patches payload will silently omit branch/font_final_px for them, and every '
        f'consumer is getattr-safe so nothing will raise (#628)'
    )
