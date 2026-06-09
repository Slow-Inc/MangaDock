"""Knuth-Plass line breaking (#180, render parity).

Greedy wrap fills each line then overflows to the next, which often leaves an ugly
short last line. MangaTranslator (text_processing.py:489-579) uses a pragmatic
Knuth-Plass DP that globally minimises total badness (slack^exponent) so lines are
balanced. Pure arithmetic over a word-width callback — unit-tests with no PIL/fonts.
"""
import re
from pathlib import Path

from manga_translator.line_break import find_optimal_line_breaks


def width_by_len(token: str) -> float:
    return float(len(token))


def test_dp_balances_instead_of_leaving_a_short_last_line():
    # widths [4,4,1], max 9, space 1.
    # greedy: ["wxyz abcd"](9) then ["e"] → last line slack 8 (badness 8^3=512).
    # DP: ["wxyz"](slack5,125) + ["abcd e"](6,slack3,27) = 152 < 512 → balanced.
    tokens = ["wxyz", "abcd", "e"]
    lines = find_optimal_line_breaks(tokens, max_width=9, word_width=width_by_len,
                                     space_width=1.0)
    assert lines == [["wxyz"], ["abcd", "e"]]


def test_empty_tokens_returns_no_lines():
    assert find_optimal_line_breaks([], max_width=10, word_width=width_by_len) == []


def test_everything_fits_on_one_line():
    tokens = ["ab", "cd", "ef"]  # 2+1+2+1+2 = 8 <= 10
    assert find_optimal_line_breaks(tokens, max_width=10, word_width=width_by_len,
                                    space_width=1.0) == [["ab", "cd", "ef"]]


def test_single_token_wider_than_max_gets_its_own_line_no_deadlock():
    # A word longer than the column must still place (hyphenation is upstream);
    # it never deadlocks the DP into an empty result.
    tokens = ["supercalifragilistic", "ok"]
    lines = find_optimal_line_breaks(tokens, max_width=5, word_width=width_by_len,
                                     space_width=1.0)
    assert lines == [["supercalifragilistic"], ["ok"]]


def test_hyphen_penalty_avoids_ending_a_line_on_a_hyphen():
    # widths [2,2,2], max 5. Without the penalty, [["a-","bb"],["cc"]] and
    # [["a-"],["bb","cc"]] tie (27 each); the hyphen penalty breaks the tie toward
    # NOT leaving "a-" dangling at a line end.
    tokens = ["a-", "bb", "cc"]
    lines = find_optimal_line_breaks(tokens, max_width=5, word_width=width_by_len,
                                     space_width=1.0)
    assert lines == [["a-", "bb"], ["cc"]]
