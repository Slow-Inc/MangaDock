"""Tests for tools/omission_verify pure helpers."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'tools'))

from omission_verify import build_user, flagged, long_pairs, parse_verdicts


def _doctor(regions):
    return {'regions': regions}


def test_long_pairs_keeps_only_long_source_lines():
    doctor = _doctor([
        {'src': 'ALSO... THIS PIQUED MY CURIOSITY EARLIER IN THE DINING HALL,', 'dst': 'แล้วอีกอย่าง... เมื่อตอนกลางวันในโรงอาหาร'},
        {'src': 'MAN..', 'dst': 'เฮ้...'},
        {'src': 'A LONG LINE WITH NO TRANSLATION HERE', 'dst': ''},
    ])
    pairs = long_pairs(doctor, min_words=8)
    assert len(pairs) == 1
    assert pairs[0][0].startswith('ALSO')
    assert long_pairs(doctor, min_words=4) == [pairs[0]] or len(long_pairs(doctor, min_words=4)) == 2


def test_build_user_numbers_pairs_and_parse_verdicts_round_trips():
    pairs = [('SRC ONE', 'ไทยหนึ่ง'), ('SRC TWO', 'ไทยสอง')]
    user = build_user(pairs, offset=3)
    assert '<|3|> SR: SRC ONE' in user and '<|4|> SR: SRC TWO' in user
    parsed = parse_verdicts('[{"i":0,"omitted":true,"missing":"x"},{"i":1,"omitted":false}]')
    assert parsed and len(parsed) == 2
    assert parse_verdicts('no json here') is None


def test_flagged_selects_only_omitted_entries():
    pairs = [('A', 'a'), ('BB', 'bb')]
    verdicts = [{'i': 0, 'omitted': True, 'missing': 'clause x'}, {'i': 1, 'omitted': False}]
    hits = flagged(pairs, verdicts)
    assert len(hits) == 1 and hits[0][0] == 0 and hits[0][3] == 'clause x'
    assert flagged(pairs, None) == []

