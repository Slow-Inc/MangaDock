"""Readable text colour for a patch (#1143 follow-up), torch-free.

The rule exists because a region colour pair can come from the lettering crop while the repaired patch behind the
rendered text is the character hair - the inpainting comparison showed Thai text drawn dark on dark.
"""
import numpy as np

from manga_translator.text_contrast import background_luma, contrast_enabled, luma, readable_colors


def test_dark_ink_on_a_dark_patch_becomes_white_with_a_black_stroke():
    dark = np.full((20, 20, 3), 25, np.uint8)
    fg, stroke = readable_colors((0, 0, 0), (255, 255, 255), dark)
    assert fg == (255, 255, 255) and stroke == (0, 0, 0)


def test_white_ink_on_a_light_patch_becomes_black():
    light = np.full((20, 20, 3), 240, np.uint8)
    fg, stroke = readable_colors((255, 255, 255), (0, 0, 0), light)
    assert fg == (0, 0, 0) and stroke == (255, 255, 255)


def test_readable_ink_is_left_alone():
    white = np.full((20, 20, 3), 250, np.uint8)
    assert readable_colors((0, 0, 0), (255, 255, 255), white) == ((0, 0, 0), (255, 255, 255))


def test_a_few_ink_pixels_do_not_decide_the_background():
    crop = np.full((20, 20, 3), 250, np.uint8)
    crop[:2, :2] = 0            # 1 % ink: the median still says white
    assert background_luma(crop) > 200
    assert luma((255, 255, 255)) > luma((0, 0, 0))


def test_an_empty_crop_is_treated_as_white_paper():
    assert background_luma(None) == 255.0
    assert background_luma(np.zeros((0, 0, 3), np.uint8)) == 255.0


def test_the_knob_can_turn_the_rule_off(monkeypatch):
    monkeypatch.delenv("MIT_TEXT_CONTRAST", raising=False)
    assert contrast_enabled() is True
    for off in ("0", "false", "no", "off"):
        monkeypatch.setenv("MIT_TEXT_CONTRAST", off)
        assert contrast_enabled() is False, off
