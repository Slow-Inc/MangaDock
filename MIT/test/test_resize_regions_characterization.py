"""Characterization golden for resize_regions_to_font_size (#speed-study Phase 1).

Locks the two things this function produces per region — the returned
``dst_points`` quad and the mutated ``region.font_size`` (plus ``translation``,
which the #436 de-dup branch can blank) — byte-identical across the three
dispatch branches: legacy (single-axis expansion / length-ratio scaling),
bubble_fit (#166/#183 balloon fit + width-squeeze), and clean_layout (#175
narration column). This is the seam Phase 2 optimizations (layout_fit fixes)
must not disturb.

Golden arrays live in test/golden/resize_regions_*.npz (committed). First run
generates + skips; later runs assert exact equality. Delete an npz to
regenerate when a change is expected and reviewed.
"""
import os
import sys

import numpy as np
import PIL.features
import pytest

from manga_translator.rendering import resize_regions_to_font_size
from manga_translator.rendering import text_render
from manga_translator.utils import TextBlock

from _golden_compare import golden_verdict

GOLDEN_DIR = os.path.join(os.path.dirname(__file__), 'golden')
_FONT = os.path.join(os.path.dirname(__file__), '..', 'fonts', 'Arial-Unicode-Regular.ttf')


def _set_font():
    text_render.set_font(_FONT)


def _text_metric_env():
    """The two things a byte-identical freetype-metric golden is tied to: the freetype build
    (glyph advances) and the OS. A golden only asserts strictly where both match what it recorded."""
    return PIL.features.version('freetype2') or 'unknown', sys.platform


def _save_or_assert(golden_path, dst_points_list, regions):
    ft, plat = _text_metric_env()
    if not os.path.exists(golden_path):
        os.makedirs(os.path.dirname(golden_path), exist_ok=True)
        payload = {}
        for i, dp in enumerate(dst_points_list):
            payload[f'dst_{i}'] = np.asarray(dp)
        payload['font_sizes'] = np.array([r.font_size for r in regions], dtype=np.int64)
        payload['translations'] = '|'.join(r.translation for r in regions)
        payload['freetype_version'] = ft
        payload['platform'] = plat
        np.savez_compressed(golden_path, **payload)
        pytest.skip(f'generated golden snapshot at {golden_path}; re-run to assert')

    golden = np.load(golden_path)
    equal = (
        all(np.array_equal(np.asarray(dp), golden[f'dst_{i}']) for i, dp in enumerate(dst_points_list))
        and np.array_equal(np.array([r.font_size for r in regions], dtype=np.int64), golden['font_sizes'])
        and '|'.join(r.translation for r in regions) == str(golden['translations'])
    )
    golden_ft = str(golden['freetype_version']) if 'freetype_version' in golden else None
    golden_plat = str(golden['platform']) if 'platform' in golden else None
    same_env = (golden_ft == ft and golden_plat == plat)

    verdict = golden_verdict(equal, same_env)
    if verdict == 'skip':
        pytest.skip(
            f'golden recorded on {golden_plat}/freetype-{golden_ft}; running {plat}/freetype-{ft} — '
            'freetype-metric geometry drift, not a logic change. Regenerate on this platform to assert.'
        )
    # verdict is 'pass' (equal → the asserts below all hold) or 'fail' (mismatch on the SAME env →
    # a real regression); run the strict asserts so a failure names exactly which array drifted.
    for i, dp in enumerate(dst_points_list):
        assert np.array_equal(np.asarray(dp), golden[f'dst_{i}']), f'region {i} dst_points drift'
    assert np.array_equal(
        np.array([r.font_size for r in regions], dtype=np.int64), golden['font_sizes']
    ), 'font_size drift'
    assert '|'.join(r.translation for r in regions) == str(golden['translations']), 'translation drift'


def test_resize_regions_legacy_byte_identical():
    """Legacy path: bubble_fit=False, clean_layout=False — single-axis expansion
    (horizontal calc_horizontal / vertical calc_vertical) or the length-ratio
    general-scaling fallback with the shapely Polygon scale+rotate branch."""
    _set_font()
    img = np.zeros((720, 1000, 3), dtype=np.uint8)
    h_short = TextBlock(
        [[[20, 20], [200, 20], [20, 80], [200, 80]]],
        texts=['hello'], translation='Hi!',
        direction='h', target_lang='ENG', font_size=30,
    )
    h_long = TextBlock(
        [[[20, 120], [200, 120], [20, 180], [200, 180]]],
        texts=['x'], translation='The quick brown fox jumps over the lazy dog repeatedly',
        direction='h', target_lang='ENG', font_size=30,
    )
    v_cjk = TextBlock(
        [[[300, 20], [360, 20], [300, 300], [360, 300]]],
        texts=['日本'], translation='これはたてがきのテストですとてもながいぶんしょう',
        direction='v', target_lang='JPN', font_size=30,
    )
    regions = [h_short, h_long, v_cjk]
    for r in regions:
        r.set_font_colors([255, 255, 255], [0, 0, 0])

    dst_points_list = resize_regions_to_font_size(
        img, regions, font_size_fixed=None, font_size_offset=0, font_size_minimum=8,
        bubble_fit=False, clean_layout=False,
    )
    _save_or_assert(os.path.join(GOLDEN_DIR, 'resize_regions_legacy.npz'), dst_points_list, regions)


def test_resize_regions_bubble_fit_byte_identical():
    """bubble_fit=True path: a sole-occupant balloon region goes through
    _bubble_fit_layout (#166/#183 binary-search font + width-squeeze); a region
    without a bubble_box falls through to legacy."""
    _set_font()
    img = np.zeros((720, 1000, 3), dtype=np.uint8)
    balloon = TextBlock(
        [[[100, 100], [300, 100], [100, 250], [300, 250]]],
        texts=['x'], translation='This is a dialogue line inside a speech balloon',
        direction='h', target_lang='ENG', font_size=30,
    )
    balloon.bubble_box = (90, 90, 310, 260)
    no_balloon = TextBlock(
        [[[400, 400], [560, 400], [400, 460], [560, 460]]],
        texts=['y'], translation='Hi!',
        direction='h', target_lang='ENG', font_size=30,
    )
    regions = [balloon, no_balloon]
    for r in regions:
        r.set_font_colors([255, 255, 255], [0, 0, 0])

    dst_points_list = resize_regions_to_font_size(
        img, regions, font_size_fixed=None, font_size_offset=0, font_size_minimum=8,
        bubble_fit=True, anti_overlap=True, clean_layout=False,
    )
    _save_or_assert(os.path.join(GOLDEN_DIR, 'resize_regions_bubble_fit.npz'), dst_points_list, regions)


def test_resize_regions_clean_layout_byte_identical():
    """clean_layout=True path (#175): a narration/caption region without a
    filled balloon lays out at a small absolute font in an upright box."""
    _set_font()
    img = np.zeros((720, 1000, 3), dtype=np.uint8)
    narration = TextBlock(
        [[[50, 50], [900, 50], [900, 130], [50, 130]]],
        texts=['narration'], translation='Meanwhile, somewhere else in the city, things were happening',
        direction='h', target_lang='ENG', font_size=30,
    )
    regions = [narration]
    for r in regions:
        r.set_font_colors([255, 255, 255], [0, 0, 0])

    dst_points_list = resize_regions_to_font_size(
        img, regions, font_size_fixed=None, font_size_offset=0, font_size_minimum=8,
        bubble_fit=False, clean_layout=True, font_size_max=24, page_shape=img.shape,
    )
    _save_or_assert(os.path.join(GOLDEN_DIR, 'resize_regions_clean_layout.npz'), dst_points_list, regions)


def test_resize_regions_thai_byte_identical():
    """#499: the production hot path is EN->TH, but the cases above only use
    ENG/JPN. target_lang='THA' normalizes to hyphenator tag 'th' — a DIFFERENT
    key than the 'th_TH' -> 'th-TH' case in test_calc_horizontal_characterization,
    so nothing else locks the exact select_hyphenator('THA')->None path the
    @lru_cache fix optimizes. Exercise both a bubble-fit and a legacy Thai region
    (real Thai dialogue long enough to wrap) so a change to HYPHENATOR_LANGUAGES
    or the fallback loop can't silently regress the Thai render geometry."""
    _set_font()
    img = np.zeros((720, 1000, 3), dtype=np.uint8)
    thai_balloon = TextBlock(
        [[[100, 100], [340, 100], [100, 280], [340, 280]]],
        texts=['x'], translation='ไฮมิยะเซนไพน่ากลัวและก็น่ารักในเวลาเดียวกันเลยนะ',
        direction='h', target_lang='THA', font_size=30,
    )
    thai_balloon.bubble_box = (90, 90, 350, 290)
    thai_legacy = TextBlock(
        [[[400, 400], [640, 400], [400, 470], [640, 470]]],
        texts=['y'], translation='เจ้าจะไม่ใส่ชุดเกราะเลยหรือไงกัน',
        direction='h', target_lang='THA', font_size=30,
    )
    regions = [thai_balloon, thai_legacy]
    for r in regions:
        r.set_font_colors([255, 255, 255], [0, 0, 0])

    dst_points_list = resize_regions_to_font_size(
        img, regions, font_size_fixed=None, font_size_offset=0, font_size_minimum=8,
        bubble_fit=True, anti_overlap=True, clean_layout=False,
    )
    _save_or_assert(os.path.join(GOLDEN_DIR, 'resize_regions_thai.npz'), dst_points_list, regions)
