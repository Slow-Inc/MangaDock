"""Translation hallucination / language checks (#187 — extract pure verdicts off
the MangaTranslator god object).

`_check_repetition_hallucination` and `_check_target_language_ratio` are pure logic
welded onto the 3,200-line orchestrator as `async` methods (they await nothing).
Pulling them into `translation_checks` gives a unit-testable seam where *new*
validators attach — instead of growing the god object (feedback_core_boundary).
Behaviour is preserved verbatim.
"""
from manga_translator.translation_checks import check_repetition_hallucination


def test_clean_text_is_not_flagged():
    assert check_repetition_hallucination("hello there friend", silent=True) is False


def test_empty_or_too_short_text_is_not_flagged():
    assert check_repetition_hallucination("", silent=True) is False
    assert check_repetition_hallucination("abcd", silent=True) is False  # len < default threshold 5


def test_consecutive_character_repetition_is_flagged():
    assert check_repetition_hallucination("aaaaa", silent=True) is True   # 5 consecutive 'a'


def test_consecutive_segment_repetition_is_flagged():
    assert check_repetition_hallucination("go go go go go", silent=True) is True  # 5 repeated tokens


def test_threshold_is_honoured():
    # 'aaa' (len 3) only trips char-repetition once threshold drops to 3
    assert check_repetition_hallucination("aaa", threshold=3, silent=True) is True
    assert check_repetition_hallucination("aaa", threshold=5, silent=True) is False  # len < threshold
