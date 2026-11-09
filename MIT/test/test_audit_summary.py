"""Tests for tools/audit_summary noise classification (quality-measurement tool)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'tools'))

from audit_summary import _is_noise


def test_an_identical_typo_pair_is_judge_noise():
    assert _is_noise('Meaning preserved but typos: ฉัน→ฉัน, ไม่มี→ไม่มี')
    assert _is_noise('Typos: จริง→จริง')


def test_a_real_typo_mapping_is_not_noise():
    assert not _is_noise('Typos: บ่าน→บ้าน, ถูก→ถูก')
    assert not _is_noise('ฬ: วิ่่ง should be วิ่ง (extra mai ek)')


def test_a_real_meaning_complaint_with_a_typo_word_is_not_noise():
    assert not _is_noise('Meaning preserved but literal: อรุณสวัสดิ์ missing; typos: ฉัน→ฉัน')


def test_an_empty_or_plain_note_is_not_noise():
    assert not _is_noise('')
    assert not _is_noise('complete mistranslation / wrong sense')

