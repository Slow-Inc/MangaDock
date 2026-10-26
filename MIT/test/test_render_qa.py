"""Post-render QA helpers (#1143 Track C), torch-free.

The recogniser runs outside this venv; what decides here is the comparison and its threshold, so both are pinned
with the numbers from the ch. 6 run.
"""
from manga_translator.render_qa import (MIN_LENGTH_FOR_CHECK, SUSPICIOUS_CER, cer, edit_distance,
                                        is_suspicious, normalize)


def test_normalize_drops_the_spaces_and_punctuation_the_recogniser_invents():
    assert normalize("ดีใจ จัง") == normalize("ดีใจจัง")
    assert normalize("คุโรเสะคุง...") == normalize("คุโรเสะคุง")
    assert normalize(None) == ""


def test_combining_marks_are_kept_so_a_missing_tone_mark_still_counts():
    assert normalize("พรึ่บ") != normalize("พรึบ")
    assert len(normalize("พรึ่บ")) == 5 and len(normalize("พรึบ")) == 4   # the mark is a character of its own


def test_edit_distance_basics():
    assert edit_distance("abc", "abc") == 0
    assert edit_distance("abc", "abd") == 1
    assert edit_distance("", "xy") == 2


def test_cer_ignores_spaces_and_reports_missing_marks():
    assert cer("ดีใจจัง", "ดีใจ จัง") == 0.0
    # the measured case: a possibly clipped tone mark
    assert 0.15 <= cer("พรึ่บ", "พรึบ") <= 0.25


def test_the_suspicious_threshold_sits_above_recogniser_noise():
    assert SUSPICIOUS_CER == 0.18
    assert is_suspicious("ทั้งที่เราเพิ่งจะสนิทกันขึ้นแท้ๆ", "ทั้งที่เรา เพิ่งจะสนิท กันขึ้นแท้ๆ") is False
    assert is_suspicious("พรึ่บ", "พรึบ") is True


def test_a_four_character_interjection_is_noise_not_an_alarm():
    # measured: the only alarms on ch. 6 above the threshold were these two, both recogniser confusions
    assert MIN_LENGTH_FOR_CHECK == 5
    assert is_suspicious("ฟุฟุ", "ฟพ") is False
    assert is_suspicious("หืม?", "หีม?") is False


def test_an_empty_intention_is_never_suspicious_when_nothing_was_read():
    assert cer("", "") == 0.0
    assert cer("", "x") == 1.0
