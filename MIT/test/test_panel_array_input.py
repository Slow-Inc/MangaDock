"""Panel detection runs on the page array directly (#822 follow-up, 2026-10-21): it used to write the
page to a temp PNG and read it back — a pure encode/decode round trip on every page (a PNG round
trip is lossless, so the panels must be identical)."""
import os
import tempfile

import cv2
import numpy as np

from manga_translator.utils.panel import get_panels_from_array
from manga_translator.utils.panel.kumikolib import Kumiko


def _page():
    img = np.full((900, 640, 3), 255, np.uint8)
    for x1, y1, x2, y2 in [(20, 20, 620, 300), (20, 320, 300, 880), (320, 320, 620, 880)]:
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 0), 4)
        cv2.putText(img, 'HI', (x1 + 40, y1 + 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 0), 3)
    img[:, :, 0] = np.clip(img[:, :, 0].astype(int) - 10, 0, 255)   # an RGB/BGR channel difference
    return img


def _panels_via_disk(img, rtl):
    fd, path = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    try:
        cv2.imwrite(path, img)
        k = Kumiko({'rtl': rtl})
        k.parse_image(path)
        return k.get_infos()[0]['panels']
    finally:
        os.unlink(path)


def test_panels_from_the_array_match_the_disk_round_trip():
    img = _page()
    before = img.copy()
    for rtl in (True, False):
        assert get_panels_from_array(img, rtl=rtl) == _panels_via_disk(img, rtl)
    assert np.array_equal(img, before)          # the page array is not modified (it was a copy before)


def test_no_temp_file_is_written(monkeypatch):
    monkeypatch.setattr(cv2, 'imwrite', lambda *a, **k: (_ for _ in ()).throw(AssertionError('no disk round trip')))
    assert len(get_panels_from_array(_page(), rtl=True)) >= 3


def test_non_uint8_or_grayscale_input_still_matches_the_disk_round_trip():
    """Review of 45c9c2c0: the old imwrite/imread round trip turned any input into 3-channel uint8;
    passing the array straight through broke grayscale/float input (silent fallback to simple sort).
    Such input is normalised in memory with the same codec semantics."""
    img = _page()
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    for variant in (gray, gray[:, :, None], img.astype(np.float32), img.astype(np.uint16) * 200):
        assert get_panels_from_array(variant, rtl=True) == _panels_via_disk(variant, True)
