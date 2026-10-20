"""#757: coalesce textline components that share one balloon/caption container.

`textline_merge` joins lines only when their gap is < 1.0x the font size; caption boxes are spaced
1.0-1.7x, so a caption arrives as one region per line and is translated as fragments. When a
container holds several components and at least one is a single line, they are one block.
"""
from manga_translator.container_merge import coalesce_container_fragments


def _stack(n, x1=100, x2=300, top=100, pitch=40, h=20):
    """n line boxes stacked one per `pitch` px (gap = pitch - h = 1.0x a 20 px font)."""
    return [(x1, top + i * pitch, x2, top + i * pitch + h) for i in range(n)]


def _merge(groups, containers, directions, boxes=None):
    boxes = boxes or _stack(len(containers))
    return coalesce_container_fragments(groups, containers, directions, boxes, [20] * len(boxes))


def test_fragments_in_one_container_become_one_group():
    # caption 0: a 5-line block plus four single lines (the 2026-10-20 page's left caption)
    groups = [{0}, {1}, {2, 3, 4, 5, 6}, {7}, {8}, {9, 10}]
    containers = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
    out = _merge(groups, containers, ['h'] * 11)
    assert out == [{0, 1, 2, 3, 4, 5, 6, 7, 8}, {9, 10}]


def test_multi_line_paragraphs_in_one_box_are_left_alone():
    groups = [{0, 1, 2}, {3, 4, 5}]
    out = _merge(groups, [0] * 6, ['h'] * 6)
    assert out == [{0, 1, 2}, {3, 4, 5}]


def test_untagged_lines_are_never_merged():
    groups = [{0}, {1}]
    assert _merge(groups, [None, None], ['h', 'h']) == [{0}, {1}]


def test_a_component_straddling_two_containers_is_not_moved():
    groups = [{0, 1}, {2}]
    out = _merge(groups, [0, 1, 0], ['h'] * 3)
    assert out == [{0, 1}, {2}]


def test_mixed_directions_are_not_merged():
    # a vertical JP line and a horizontal SFX/caption in the same balloon stay apart
    groups = [{0}, {1}]
    assert _merge(groups, [0, 0], ['v', 'h']) == [{0}, {1}]


def test_order_follows_the_first_member_of_each_container():
    groups = [{5}, {0}, {6}, {1}]
    containers = [1, 1, None, None, None, 0, 0]
    out = _merge(groups, containers, ['h'] * 7)
    assert out == [{5, 6}, {0, 1}]


# Geometry guard: sharing a container is not enough. Seen on the 2026-10-20 corpus: two stacked
# speech boxes under one YOLO polygon (6.1x the font apart) and a region nested inside another.

def test_far_apart_blocks_in_one_container_stay_apart():
    boxes = [(100, 100, 300, 120), (100, 242, 300, 262)]  # gap 122 px = 6.1x a 20 px font
    assert _merge([{0}, {1}], [0, 0], ['h', 'h'], boxes) == [{0}, {1}]


def test_side_by_side_blocks_in_one_container_stay_apart():
    boxes = [(100, 100, 200, 120), (400, 100, 500, 120)]  # same row, no horizontal overlap
    assert _merge([{0}, {1}], [0, 0], ['h', 'h'], boxes) == [{0}, {1}]


def test_vertical_columns_chain_right_to_left():
    # JP vertical text: columns read right-to-left, 1.2x the font apart
    boxes = [(300, 100, 320, 300), (256, 100, 276, 260)]
    assert _merge([{0}, {1}], [0, 0], ['v', 'v'], boxes) == [{0, 1}]
