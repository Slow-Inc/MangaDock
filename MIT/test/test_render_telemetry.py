"""#535 Phase-0c wiring: resize_regions_to_font_size stamps per-region render
telemetry (render_branch / render_font_px / render_dst_box) so the /patches
payload can explain every region. Heavy layout internals are stubbed — this pins
the WIRING (attrs set on every branch), not the layout math."""
import numpy as np
import pytest

import manga_translator.rendering as rend


class FakeRegion:
    def __init__(self, **attrs):
        self.sfx_rescued = False
        self.font_size = 24
        for k, v in attrs.items():
            setattr(self, k, v)


@pytest.fixture()
def stubs(monkeypatch):
    monkeypatch.setattr(rend, '_bubble_interior_box',
                        lambda region, bubble_box, shape: (60.0, 40.0, (50.0, 50.0)))
    monkeypatch.setattr(rend, '_bubble_fit_font_size',
                        lambda region, wh, ratio: 42)
    monkeypatch.setattr(rend, '_clean_layout_dst',
                        lambda region, shape, fmin, fmax: (20, 80.0, 30.0))
    return monkeypatch


def test_bubble_fit_branch_stamps_telemetry(stubs):
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(bubble_box=(10, 10, 110, 110), horizontal=True,
                   translation='HELLO', xyxy=(20, 20, 100, 100))
    out = rend.resize_regions_to_font_size(
        img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch == 'bubble_fit_sole'
    assert r.render_font_px == 42
    assert list(map(int, r.render_dst_box)) == [20, 30, 80, 70]   # 60x40 box on (50,50)
    assert len(out) == 1


def test_clean_layout_branch_stamps_telemetry(stubs):
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(horizontal=True, translation='CAPTION', xyxy=(30, 30, 90, 60))
    out = rend.resize_regions_to_font_size(
        img, [r], None, 0, 8, bubble_fit=False, clean_layout=True)
    assert r.render_branch == 'clean_layout'
    assert r.render_font_px == 20
    assert len(r.render_dst_box) == 4
    assert len(out) == 1


def test_narrow_narration_in_big_balloon_falls_through_to_clean_layout(stubs):
    # #535 slice C: tagged + sole occupant, but the text footprint spans only half
    # the balloon width (rw/bw = 0.5 < 0.72) → NOT dialogue-to-fill; must keep the
    # clean-layout narrow column (the target's tall narrow narration block).
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(bubble_box=(0, 0, 160, 160), horizontal=True,
                   translation='THIS BRAT STILL...', xyxy=(40, 20, 120, 140))  # rw 80 / bw 160
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch == 'clean_layout'


def test_wide_dialogue_in_balloon_still_bubble_fits(stubs):
    img = np.full((200, 200, 3), 255, np.uint8)
    r = FakeRegion(bubble_box=(0, 0, 100, 100), horizontal=True,
                   translation='HELLO', xyxy=(5, 20, 95, 80))                  # rw 90 / bw 100
    rend.resize_regions_to_font_size(img, [r], None, 0, 8, bubble_fit=True, clean_layout=True)
    assert r.render_branch == 'bubble_fit_sole'


def test_clean_layout_squeezes_to_fill_tall_original_footprint(monkeypatch):
    # #535 (user vs target): a tall vertical-JP narration bbox must render as a tall
    # NARROW column (like the target), not a few wide lines. clean_layout squeezes
    # the wrap width until the block fills the region's original height.
    def fake_calc(font, text, max_width, max_height, language='en_US', **kw):
        import math
        cpl = max(1, int(max_width) // 10)              # 10px per char
        n = math.ceil(len(text) / cpl)
        return ['x' * cpl] * n, [min(int(max_width), len(text) * 10)] * n
    monkeypatch.setattr(rend.text_render, 'calc_horizontal', fake_calc)
    r = FakeRegion(horizontal=True, translation='A' * 30, xyxy=(0, 0, 150, 300))  # tall 150x300
    laid = rend._clean_layout_dst(r, (400, 400, 3), 8, 20)
    fs, block_w, block_h = laid
    # unsqueezed: 2 wide lines (~150px wide, ~48px tall). Squeezed: a tall narrow
    # column (floored at 2×font so it can't become a sliver).
    assert block_w < 75                  # much narrower than the 150px bbox width
    assert block_h >= 150                # ...and 3×+ taller than the unsqueezed 48px
    assert block_h <= 300                # never exceeds the original footprint height
