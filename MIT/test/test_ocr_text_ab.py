"""Tests for tools/ocr_text_ab pure helpers."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'tools'))

from ocr_text_ab import build_user, collect_changes, parse_choices, tally


def test_collect_changes_pairs_by_index_and_skips_unequal_pages(tmp_path):
    a = tmp_path / 'a'
    b = tmp_path / 'b'
    a.mkdir()
    b.mkdir()
    (a / 'p1_THA_x.doctor.json').write_text(json.dumps({'regions': [{'src': 'OLD READ'}, {'src': 'SAME'}]}), encoding='utf-8')
    (b / 'p1_THA_x.doctor.json').write_text(json.dumps({'regions': [{'src': 'NEW READ'}, {'src': 'SAME'}]}), encoding='utf-8')
    (a / 'p2_THA_x.doctor.json').write_text(json.dumps({'regions': [{'src': 'A1'}]}), encoding='utf-8')
    (b / 'p2_THA_x.doctor.json').write_text(json.dumps({'regions': [{'src': 'B1'}, {'src': 'B2'}]}), encoding='utf-8')
    pairs = collect_changes(str(a), str(b))
    assert pairs == [('p1', 'OLD READ', 'NEW READ')]


def test_build_user_and_parse_choices():
    pairs = [('p1', 'A TEXT', 'B TEXT'), ('p1', 'A2', 'B2')]
    user = build_user(pairs, offset=2)
    assert '<|2|> A: A TEXT' in user and '<|3|> A: A2' in user
    parsed = parse_choices('[{"i":0,"better":"B"},{"i":1,"better":"A"}]')
    assert parsed and len(parsed) == 2
    assert parse_choices('nope') is None


def test_tally_counts_and_marks_missing():
    choices = [{'i': 0, 'better': 'B'}, {'i': 1, 'better': 'TIE'}]
    assert tally(choices, 4) == {'A': 0, 'B': 1, 'TIE': 1, 'unparsed': 2}

