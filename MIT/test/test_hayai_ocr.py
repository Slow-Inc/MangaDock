"""Hayai OCR adapter (#1143 Track C): the pure colour/text helpers, and the adapter's per-textline contract.

The 150M-parameter model itself is exercised by the stage benchmark on real pages, not here; these tests pin
what the adapter owes the pipeline for every textline — the model's text, a foreground/background colour pair
(the recogniser predicts colours per glyph, Hayai returns text only), and a crop at native resolution.
"""
import asyncio

import numpy as np
import pytest

from manga_translator.ocr_hayai_post import HAYAI_MIN_CONF, accept_read, clean_text, colors_from_crop


def test_black_on_white_lettering_gives_black_fg_and_white_bg():
    crop = np.full((20, 20, 3), 255, np.uint8)
    crop[8:12, :, :] = 0
    assert colors_from_crop(crop) == ((0, 0, 0), (255, 255, 255))


def test_a_white_on_black_balloon_is_read_the_other_way_round():
    crop = np.zeros((20, 20, 3), np.uint8)
    crop[8:12, :, :] = 255
    fg, bg = colors_from_crop(crop)
    assert bg == (0, 0, 0) and fg[0] > 200


def test_an_empty_or_flat_crop_falls_back_to_black_on_white():
    assert colors_from_crop(None) == ((0, 0, 0), (255, 255, 255))
    assert colors_from_crop(np.full((10, 10, 3), 128, np.uint8)) == ((0, 0, 0), (255, 255, 255))


def test_a_read_is_trusted_only_above_the_measured_confidence_floor():
    # ch. 6 measurements: real lettering -0.01 to -0.09, invented text on artwork -0.55 to -2.58
    assert accept_read(-0.02) and accept_read(-0.30) and not accept_read(HAYAI_MIN_CONF - 0.01)
    assert not accept_read(float('nan'))   # an empty answer has no confidence at all


def test_clean_text_collapses_lines_and_drops_empties():
    assert clean_text("  I'm\n glad. ") == "I'm glad."
    assert clean_text(None) == ''


def test_an_axis_aligned_box_is_cropped_unwarped_and_a_rotated_one_is_warped():
    pytest.importorskip('torch')
    from manga_translator.ocr.model_hayai import ModelHayaiOCR
    from manga_translator.utils import Quadrilateral

    image = np.arange(100 * 200 * 3, dtype=np.uint8).reshape(100, 200, 3)
    straight = Quadrilateral(np.array([[10, 20], [90, 20], [90, 60], [10, 60]]), '', 1.0)
    crop = ModelHayaiOCR._crop(image, straight, 'h')
    assert crop.shape == (40, 80, 3)          # the picture in the box, at native resolution
    assert crop[0, 0, 0] == image[20, 10, 0]

    rotated = Quadrilateral(np.array([[10, 20], [90, 40], [80, 80], [0, 60]]), '', 1.0)
    warped = ModelHayaiOCR._crop(image, rotated, 'h')
    assert warped.shape[0] == 60 and warped.shape[1] > 0   # warped path keeps the target height


def test_the_adapter_reads_native_crops_and_sets_text_prob_and_colours(monkeypatch):
    pytest.importorskip('torch')
    from manga_translator.config import OcrConfig
    from manga_translator.ocr.model_hayai import ModelHayaiOCR
    from manga_translator.utils import Quadrilateral

    ocr = ModelHayaiOCR()
    ocr.device = 'cpu'
    seen = {}

    def fake_read(crop):
        seen['shape'] = crop.shape
        return "I'm glad.", -0.02

    monkeypatch.setattr(ocr, '_read', fake_read)
    image = np.full((200, 200, 3), 255, np.uint8)
    image[45:50, 30:110] = 0          # black lettering inside the line box, so the crop has ink to separate
    line = Quadrilateral(np.array([[20, 30], [120, 30], [120, 80], [20, 80]]), '', 0.0)
    out = asyncio.run(ocr._infer(image, [line], OcrConfig()))

    assert len(out) == 1 and out[0].text == "I'm glad."
    assert out[0].prob > 0.95          # likelihood mapped onto the pipeline's prob
    # native resolution: the 50 px line is not warped down to a 48 px strip
    assert seen['shape'][0] == 50
    # near-black ink on white (the extreme-quantile mean blends a little anti-aliasing, as it does on real crops)
    assert out[0].fg_colors.tolist()[0] < 60 and out[0].bg_colors.tolist()[0] > 200


def test_the_local_rescue_is_on_by_default_and_can_be_switched_off(monkeypatch):
    from manga_translator.local_ocr_rescue import local_rescue_enabled
    monkeypatch.delenv('MIT_RESCUE_LOCAL_OCR', raising=False)
    assert local_rescue_enabled() is True
    for off in ('0', 'false', 'no', 'off', 'FALSE'):
        monkeypatch.setenv('MIT_RESCUE_LOCAL_OCR', off)
        assert local_rescue_enabled() is False, off
    monkeypatch.setenv('MIT_RESCUE_LOCAL_OCR', '1')
    assert local_rescue_enabled() is True


def test_read_crop_returns_nothing_below_the_confidence_floor(monkeypatch):
    pytest.importorskip('torch')
    from manga_translator.ocr.model_hayai import ModelHayaiOCR

    ocr = ModelHayaiOCR()
    ocr.device = 'cpu'
    monkeypatch.setattr(ocr, '_read', lambda crop: ("I'm glad.", -0.02))
    assert ocr.read_crop(np.full((10, 10, 3), 255, np.uint8)) == "I'm glad."
    monkeypatch.setattr(ocr, '_read', lambda crop: ('JUMP VALKI-GITNELY CLOSER...', -1.22))
    assert ocr.read_crop(np.full((10, 10, 3), 255, np.uint8)) == ''


def test_a_low_confidence_read_is_dropped_before_it_can_be_translated(monkeypatch):
    """The model invents English on artwork; its token likelihood is what tells the two apart, so a read below
    the floor leaves the region empty (0 prob) for the normal empty-box handling instead of renderable text."""
    pytest.importorskip('torch')
    from manga_translator.config import OcrConfig
    from manga_translator.ocr.model_hayai import ModelHayaiOCR
    from manga_translator.utils import Quadrilateral

    ocr = ModelHayaiOCR()
    ocr.device = 'cpu'
    monkeypatch.setattr(ocr, '_read', lambda crop: ('JUMP VALKI-GITNELY CLOSER...', -1.22))
    image = np.full((200, 200, 3), 255, np.uint8)
    line = Quadrilateral(np.array([[20, 30], [120, 30], [120, 80], [20, 80]]), '', 0.0)
    out = asyncio.run(ocr._infer(image, [line], OcrConfig()))
    assert out[0].text == '' and out[0].prob == 0.0
