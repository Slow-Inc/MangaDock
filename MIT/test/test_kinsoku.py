"""#180 step 2 — kinsoku (CJK line-break) forbidden-position rules, pure.

Japanese/CJK typography forbids certain characters at a line START (行頭禁則:
closing brackets, trailing punctuation, small kana, prolonged sound) or a line END
(行末禁則: opening brackets). The Knuth-Plass breaker (step 1, line_break.py) must
respect these so a comma/period/closing-bracket never opens a wrapped line. These
pure predicates are font-free and table-driven; wiring into the KP penalty model is
the next step."""
from manga_translator.kinsoku import (
    is_forbidden_line_start, is_forbidden_line_end,
)


# --- 行頭禁則: must NOT start a line ---

def test_closing_brackets_forbidden_at_start():
    assert is_forbidden_line_start('）') is True
    assert is_forbidden_line_start('」') is True
    assert is_forbidden_line_start('』') is True


def test_trailing_punctuation_forbidden_at_start():
    assert is_forbidden_line_start('、') is True
    assert is_forbidden_line_start('。') is True
    assert is_forbidden_line_start('！') is True
    assert is_forbidden_line_start('？') is True


def test_small_kana_forbidden_at_start():
    assert is_forbidden_line_start('っ') is True
    assert is_forbidden_line_start('ゃ') is True
    assert is_forbidden_line_start('ッ') is True


def test_prolonged_sound_mark_forbidden_at_start():
    assert is_forbidden_line_start('ー') is True


def test_normal_char_allowed_at_start():
    assert is_forbidden_line_start('あ') is False
    assert is_forbidden_line_start('漢') is False
    assert is_forbidden_line_start('A') is False


# --- 行末禁則: must NOT end a line ---

def test_opening_brackets_forbidden_at_end():
    assert is_forbidden_line_end('（') is True
    assert is_forbidden_line_end('「') is True
    assert is_forbidden_line_end('『') is True


def test_normal_char_allowed_at_end():
    assert is_forbidden_line_end('あ') is False
    assert is_forbidden_line_end('。') is False  # period may end a line


# --- robustness: empty / multi-char input ---

def test_empty_string_is_not_forbidden():
    assert is_forbidden_line_start('') is False
    assert is_forbidden_line_end('') is False


def test_only_first_char_considered_for_multichar():
    assert is_forbidden_line_start('）あ') is True   # leading closing bracket
    assert is_forbidden_line_end('「あ') is False    # ends with あ, not opening
