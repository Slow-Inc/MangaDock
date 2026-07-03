"""Characterization golden for merge_bboxes_text_region (#speed-study Phase 1).

Locks the region membership merge_bboxes_text_region produces for a dense
synthetic page (many clustered + isolated + rotated quads) — the seam Phase 2a's
M1 (AABB pre-reject) and M2 (scalar-gate reorder) optimizations must keep
byte-identical. Calls the sync generator directly (not the async dispatch()
wrapper) so this test has no pytest-asyncio dependency.

merge_bboxes_text_region is deterministic given fixed input (itertools.combinations
+ networkx kruskal/connected_components are order-stable), so — unlike the
OCR/LLM stages upstream of it — a snapshot here is a valid characterization.

Golden lives in test/golden/textline_merge_dense.npz (committed). First run
generates + skips; later runs assert exact region-membership equality.
"""
import os

import numpy as np
import pytest

from manga_translator.textline_merge import merge_bboxes_text_region
from manga_translator.utils import Quadrilateral

GOLDEN = os.path.join(os.path.dirname(__file__), 'golden', 'textline_merge_dense.npz')

WIDTH, HEIGHT = 2000, 3000


def _quad(x1, y1, x2, y2):
    return np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float64)


def _dense_lines():
    """~40 quads: several tight clusters (should merge), isolated singles
    (should not), a 4-quad cluster with one outlier (exercises split_text_region's
    MST-deviation split), and a couple of vertical/rotated quads."""
    lines = []

    # Cluster A: 4 small quads in a horizontal row, tight gaps -> one region.
    for i in range(4):
        x = 100 + i * 44
        lines.append(_quad(x, 100, x + 40, 140))

    # Cluster B: 3 quads stacked vertically, tight gaps -> one region.
    for i in range(3):
        y = 300 + i * 44
        lines.append(_quad(100, y, 140, y + 40))

    # Cluster C: 4 quads where the 4th is a deviating outlier (exercises the
    # MST split_text_region case-3 branch — 3 close + 1 far in the same component).
    for i in range(3):
        x = 400 + i * 44
        lines.append(_quad(x, 100, x + 40, 140))
    lines.append(_quad(700, 100, 740, 140))  # outlier, same row but far gap

    # Isolated singles scattered around the page — should never merge with anything.
    isolated_positions = [
        (1200, 100), (1500, 400), (300, 800), (1700, 1200),
        (900, 1800), (150, 2200), (1800, 2600), (600, 2900),
    ]
    for (x, y) in isolated_positions:
        lines.append(_quad(x, y, x + 40, y + 40))

    # A larger scattered grid (5x4) with modest gaps -> mostly isolated/small
    # clusters, adds volume to exercise the O(n^2) all-pairs step at a
    # non-trivial n without needing hand-picked coordinates for every quad.
    for row in range(4):
        for col in range(5):
            x = 200 + col * 90
            y = 1500 + row * 90
            lines.append(_quad(x, y, x + 36, y + 36))

    return lines


def test_textline_merge_dense_byte_identical():
    lines = _dense_lines()
    bboxes = [Quadrilateral(pts, '', 1.0) for pts in lines]

    regions = list(merge_bboxes_text_region(bboxes, WIDTH, HEIGHT))

    # Membership per region = sorted set of input-line indices it absorbed,
    # matched back by exact point-array equality (mirrors test_textline_merge.py's
    # own find_region_containing_line pattern).
    membership = []
    for (txtlns, fg_color, bg_color) in regions:
        combo = []
        for txtln in txtlns:
            for i, pts in enumerate(lines):
                if np.array_equal(txtln.pts, pts):
                    combo.append(i)
                    break
        membership.append(sorted(combo))
    membership.sort()

    if not os.path.exists(GOLDEN):
        os.makedirs(os.path.dirname(GOLDEN), exist_ok=True)
        flat = np.array([len(m) for m in membership], dtype=np.int64)
        concat = np.array([i for m in membership for i in m], dtype=np.int64)
        np.savez_compressed(GOLDEN, region_sizes=flat, region_members=concat, n_regions=np.array([len(membership)]))
        pytest.skip(f'generated golden snapshot at {GOLDEN}; re-run to assert')

    golden = np.load(GOLDEN)
    sizes = golden['region_sizes']
    concat = golden['region_members']
    expected = []
    pos = 0
    for sz in sizes:
        expected.append(sorted(concat[pos:pos + sz].tolist()))
        pos += sz
    expected.sort()

    assert len(membership) == int(golden['n_regions'][0]), 'region count drift'
    assert membership == expected, 'region membership drift'
