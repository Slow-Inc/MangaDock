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
