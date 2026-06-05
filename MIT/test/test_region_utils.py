"""Unit tests for region utilities (Issue #111).

Covers:
  U-1  textline_merge.dispatch — region prob normalized by the region's own
       lines, not by every textline on the page.
  U-2  TextBlock — optional `texts` must not crash (None / empty).
  U-3  TextBlock — `shadow_offset` must not be a shared mutable default.

These import cv2/numpy/shapely (a few seconds) but no torch / models.
"""
import asyncio

import numpy as np
import pytest

from manga_translator.utils.textblock import TextBlock
from manga_translator.utils.generic import Quadrilateral
from manga_translator.textline_merge import dispatch as merge_dispatch

LINES = [[[0, 0], [10, 0], [10, 10], [0, 10]]]


def _quad(x, y, size, prob):
    pts = np.array([[x, y], [x + size, y], [x + size, y + size], [x, y + size]])
    return Quadrilateral(pts, "t", prob)


# ── U-2: optional texts ──────────────────────────────────────────────
def test_textblock_with_none_texts_has_empty_text():
    tb = TextBlock(LINES, texts=None)
    assert tb.text == ""


def test_textblock_with_empty_texts_has_empty_text():
    tb = TextBlock(LINES, texts=[])
    assert tb.text == ""


def test_textblock_with_texts_unchanged():
    tb = TextBlock(LINES, texts=["hello"])
    assert tb.text == "hello"


# ── U-3: mutable default ─────────────────────────────────────────────
def test_shadow_offset_not_shared_between_instances():
    a = TextBlock(LINES, texts=["a"])
    b = TextBlock(LINES, texts=["b"])
    a.shadow_offset.append(99)          # mutate one instance's offset
    assert b.shadow_offset == [0, 0]    # the other must be unaffected


# ── U-1: region prob normalized by its own lines ─────────────────────
def test_region_prob_uses_own_lines_not_whole_page():
    # Two equal-size boxes far apart so they form two separate regions.
    # Each region has one line, so its prob must equal that line's prob —
    # independent of the other region's area on the page.
    a = _quad(0, 0, 20, 0.81)
    b = _quad(1000, 1000, 20, 0.64)
    regions = asyncio.run(merge_dispatch([a, b], 2000, 2000))
    assert len(regions) == 2, "boxes should not have merged"
    probs = sorted(r.prob for r in regions)
    assert probs[0] == pytest.approx(0.64, abs=0.02)
    assert probs[1] == pytest.approx(0.81, abs=0.02)
