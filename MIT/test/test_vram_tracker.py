"""Unit tests for manga_translator.vram_tracker — the worker-side per-model VRAM leak
detector. It learns each model's normal footprint from its clean unloads (the most it
ever freed) and flags an unload that returns far less — the exact leak the dev hunts by
hand. Pure / stdlib (no torch), runs in <1s."""

from manga_translator.vram_tracker import VramTracker


def test_first_clean_unload_sets_the_footprint_and_is_not_a_leak():
    t = VramTracker()
    t.on_unload("ocr", 2400)
    assert t.models() == [{"model": "ocr", "footprint_mb": 2400, "freed_mb": 2400, "leaked": False}]


def test_a_later_unload_that_frees_far_less_than_the_footprint_is_a_leak():
    t = VramTracker()
    t.on_unload("detect", 1100)  # clean — learns footprint 1100
    t.on_unload("detect", 20)    # later cycle frees almost nothing → leak
    m = t.models()[0]
    assert m["footprint_mb"] == 1100 and m["freed_mb"] == 20 and m["leaked"] is True


def test_a_later_clean_unload_clears_the_flag():
    t = VramTracker()
    t.on_unload("detect", 1100)
    t.on_unload("detect", 30)     # leak
    assert t.models()[0]["leaked"] is True
    t.on_unload("detect", 1090)   # freed ≈ footprint again → fine
    assert t.models()[0]["leaked"] is False


def test_footprint_tracks_the_largest_clean_release():
    t = VramTracker()
    t.on_unload("inpaint", 800)
    t.on_unload("inpaint", 1200)  # a bigger model variant freed more → footprint grows
    assert t.models()[0]["footprint_mb"] == 1200


def test_models_below_the_floor_never_flag_as_a_leak():
    # A tool whose footprint is below min_footprint_mb is allocator noise, not a leak.
    t = VramTracker(min_footprint_mb=50)
    t.on_unload("textline_merge", 8)
    t.on_unload("textline_merge", 0)
    assert t.models()[0]["leaked"] is False
