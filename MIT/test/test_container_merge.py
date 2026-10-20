"""#757: coalesce textline components that share one balloon/caption container.

`textline_merge` joins lines only when their gap is < 1.0x the font size; caption boxes are spaced
1.0-1.7x, so a caption arrives as one region per line and is translated as fragments. When a
container holds several components and at least one is a single line, they are one block.
"""
from manga_translator.container_merge import coalesce_container_fragments


def test_fragments_in_one_container_become_one_group():
    # caption 0: a 5-line block plus four single lines (the 2026-10-20 page's left caption)
    groups = [{0}, {1}, {2, 3, 4, 5, 6}, {7}, {8}, {9, 10}]
    containers = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
    out = coalesce_container_fragments(groups, containers, ['h'] * 11)
    assert out == [{0, 1, 2, 3, 4, 5, 6, 7, 8}, {9, 10}]


def test_multi_line_paragraphs_in_one_box_are_left_alone():
    groups = [{0, 1, 2}, {3, 4, 5}]
    out = coalesce_container_fragments(groups, [0] * 6, ['h'] * 6)
    assert out == [{0, 1, 2}, {3, 4, 5}]


def test_untagged_lines_are_never_merged():
    groups = [{0}, {1}]
    assert coalesce_container_fragments(groups, [None, None], ['h', 'h']) == [{0}, {1}]


def test_a_component_straddling_two_containers_is_not_moved():
    groups = [{0, 1}, {2}]
    out = coalesce_container_fragments(groups, [0, 1, 0], ['h'] * 3)
    assert out == [{0, 1}, {2}]


def test_mixed_directions_are_not_merged():
    # a vertical JP line and a horizontal SFX/caption in the same balloon stay apart
    groups = [{0}, {1}]
    assert coalesce_container_fragments(groups, [0, 0], ['v', 'h']) == [{0}, {1}]


def test_order_follows_the_first_member_of_each_container():
    groups = [{5}, {0}, {6}, {1}]
    containers = [1, 1, None, None, None, 0, 0]
    out = coalesce_container_fragments(groups, containers, ['h'] * 7)
    assert out == [{5, 6}, {0, 1}]
