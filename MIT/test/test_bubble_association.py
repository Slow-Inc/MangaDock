"""Bubble association (#170, PRD #169 enabler).

Each DBNet text-line region is tagged with the speech balloon that contains
it, so the renderer can later size text to the balloon's area instead of the
source text-line column. Pure geometry, no ML imports: bubbles are polygons
(list of (x, y) points), regions are (x1, y1, x2, y2) boxes.
"""
from pathlib import Path
import re

from manga_translator.bubble_association import (
    associate_regions_to_bubbles,
    balloon_occupancy,
    group_regions,
    union_box,
)


SQUARE = [(0, 0), (100, 0), (100, 100), (0, 100)]


# ── balloon_occupancy (#166 Blocker 2): how many regions share each balloon ──
# Binary-search fit renders a region into its *whole* balloon box. Two regions in
# the same balloon would then stack on top of each other — so the renderer must
# only fit a region that is the sole occupant of its balloon.

def test_balloon_occupancy_counts_regions_sharing_a_box():
    boxes = [(0, 0, 10, 10), (0, 0, 10, 10), (5, 5, 9, 9)]
    assert balloon_occupancy(boxes) == [2, 2, 1]


def test_balloon_occupancy_treats_none_as_its_own_balloon():
    # regions outside any balloon never collide — each counts as a sole occupant
    assert balloon_occupancy([None, None, (0, 0, 4, 4)]) == [1, 1, 1]


# ── union_box (#166 Blocker 1): expand the patch crop to cover the balloon ────
# The crop is sized to text-lines (+120px); a loose balloon overflows it, so the
# fitted (balloon-sized) text gets clipped at the patch edge. Expanding the crop
# to the union of the text-line box and the balloons it contains fixes that.

def test_union_box_covers_every_box():
    assert union_box([(10, 10, 20, 20), (0, 5, 15, 30)], 100, 100) == (0, 5, 20, 30)


def test_union_box_clamps_to_image_bounds():
    assert union_box([(-5, -5, 200, 200)], 100, 80) == (0, 0, 100, 80)


def test_union_box_ignores_none_and_is_none_when_empty():
    assert union_box([None, None], 100, 100) is None


def test_union_box_does_not_shrink_on_float_coords():
    # floor the mins, ceil the maxes — a float max must never truncate inward and
    # clip the balloon edge (#bug-hunt).
    assert union_box([(10.9, 10.9, 20.1, 30.1)], 100, 100) == (10, 10, 21, 31)


def test_region_inside_single_bubble_is_tagged():
    region = (40, 40, 60, 60)  # centroid (50, 50) inside SQUARE
    assert associate_regions_to_bubbles([region], [SQUARE]) == [0]


def test_region_outside_every_bubble_is_untagged():
    region = (200, 200, 220, 220)  # centroid (210, 210) outside SQUARE
    assert associate_regions_to_bubbles([region], [SQUARE]) == [None]


def test_nested_bubbles_pick_the_smallest_containing():
    big = [(0, 0), (200, 0), (200, 200), (0, 200)]
    small = [(40, 40), (120, 40), (120, 120), (40, 120)]
    region = (60, 60, 100, 100)  # centroid (80, 80) inside both
    # big listed first to prove the choice is by area, not list order
    assert associate_regions_to_bubbles([region], [big, small]) == [1]


def test_centroid_just_outside_jagged_mask_falls_back_to_overlap():
    # diamond: centroid-in-polygon misses a region tucked near a clipped corner,
    # but the region sits well within the balloon's footprint → IoA rescues it.
    diamond = [(50, 0), (100, 50), (50, 100), (0, 50)]
    region = (5, 5, 35, 35)  # centroid (20, 20): outside diamond, inside its bbox
    assert associate_regions_to_bubbles([region], [diamond]) == [0]


def test_barely_overlapping_region_stays_untagged():
    # region mostly outside the bubble bbox → below the IoA floor → None
    region = (90, 90, 130, 130)  # only a 10x10 corner overlaps SQUARE (IoA 1/16)
    assert associate_regions_to_bubbles([region], [SQUARE]) == [None]


def _groups_as_sets(groups):
    return sorted([sorted(g) for g in groups])


def test_grouping_without_bubbles_is_pure_proximity():
    # boxes 0 and 1 overlap; box 2 is far away. No bubble info → identical to
    # the legacy proximity union-find (byte-identical when the stage is off).
    boxes = [(0, 0, 10, 10), (5, 5, 15, 15), (100, 100, 110, 110)]
    groups = group_regions(boxes, [None, None, None], pad=0, img_w=200, img_h=200)
    assert _groups_as_sets(groups) == [[0, 1], [2]]


def test_overlapping_boxes_in_different_bubbles_stay_separate():
    # The scattered-clump bug: two caption boxes whose padded boxes touch were
    # merged into one strip. Different balloons → must NOT merge.
    boxes = [(0, 0, 10, 10), (8, 0, 18, 10)]  # padded boxes overlap
    groups = group_regions(boxes, [0, 1], pad=5, img_w=200, img_h=200)
    assert _groups_as_sets(groups) == [[0], [1]]


def test_distant_boxes_in_same_bubble_merge():
    # A multi-line balloon: lines far enough apart that proximity wouldn't merge
    # them, but they share a balloon → one group (one crop, one utterance).
    boxes = [(0, 0, 10, 10), (0, 80, 10, 90)]
    groups = group_regions(boxes, [3, 3], pad=0, img_w=200, img_h=200)
    assert _groups_as_sets(groups) == [[0, 1]]


def test_detector_config_exposes_bubble_seg_flag():
    """Wiring check via source inspection (no heavy import): the Backend sends
    detector.det_bubble_seg when MIT_BUBBLE_SEG=1, so DetectorConfig must accept
    it and default off (byte-identical when absent)."""
    src = (Path(__file__).parent.parent / 'manga_translator' / 'config.py').read_text(encoding='utf-8')
    block = re.search(r'class DetectorConfig\(BaseModel\):.*?(?=\nclass )', src, re.S)
    assert block, 'DetectorConfig not found'
    assert re.search(r'det_bubble_seg:\s*bool\s*=\s*False', block.group(0))


def test_translate_patches_tags_regions_when_bubble_seg_enabled():
    """Wiring check via source inspection (no GPU/models): translate_patches
    must gate bubble tagging on the config flag, and grouping must consume the
    tag (delegated to group_regions)."""
    mt = (Path(__file__).parent.parent / 'manga_translator' / 'manga_translator.py').read_text(encoding='utf-8')
    fn = re.search(r'async def translate_patches\(self.*?(?=\n    async def )', mt, re.S)
    assert fn, 'translate_patches not found'
    assert 'config.detector.det_bubble_seg' in fn.group(0)
    assert '_tag_regions_with_bubbles' in fn.group(0)
    assert 'group_regions(' in mt  # _group_nearby_regions delegates to the pure helper
