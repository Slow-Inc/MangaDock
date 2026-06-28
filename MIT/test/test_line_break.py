"""Knuth-Plass line breaking (#180, render parity).

Greedy wrap fills each line then overflows to the next, which often leaves an ugly
short last line. MangaTranslator (text_processing.py:489-579) uses a pragmatic
Knuth-Plass DP that globally minimises total badness (slack^exponent) so lines are
balanced. Pure arithmetic over a word-width callback — unit-tests with no PIL/fonts.
"""
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


# --- #180 step 3: CJK kinsoku integration (consumes the kinsoku module's forbidden sets) ---
# CJK has no inter-word spaces, so callers tokenise per-character and pass space_width=0.

def test_respect_kinsoku_off_by_default_keeps_byte_identical_breaks():
    # `あいう。え` / max 3: the balanced break is [あいう][。え] — which strands the
    # forbidden 。 at a line START. With kinsoku OFF (the default) the DP is unchanged
    # and still produces that break, proving byte-identity for existing callers.
    tokens = ['あ', 'い', 'う', '。', 'え']
    lines = find_optimal_line_breaks(tokens, max_width=3, word_width=width_by_len,
                                     space_width=0.0)
    assert lines == [['あ', 'い', 'う'], ['。', 'え']]


def test_respect_kinsoku_avoids_forbidden_char_at_line_start():
    # Same input, kinsoku ON: 。 (行頭禁則) must not open a line, so the DP picks the
    # equal-badness-but-legal break [あい][う。え] instead.
    tokens = ['あ', 'い', 'う', '。', 'え']
    lines = find_optimal_line_breaks(tokens, max_width=3, word_width=width_by_len,
                                     space_width=0.0, respect_kinsoku=True)
    assert lines == [['あ', 'い'], ['う', '。', 'え']]


def test_respect_kinsoku_avoids_forbidden_char_at_line_end():
    # `あ「いう` / max 2: the balanced break [あ「][いう] ends a line on 「 (行末禁則,
    # an opening bracket). Kinsoku ON reshuffles to [あ][「い][う] so no line ends on 「.
    tokens = ['あ', '「', 'い', 'う']
    lines = find_optimal_line_breaks(tokens, max_width=2, word_width=width_by_len,
                                     space_width=0.0, respect_kinsoku=True)
    assert lines == [['あ'], ['「', 'い'], ['う']]


def test_respect_kinsoku_never_deadlocks_when_every_break_is_forbidden():
    # max 1 forces one char per line, so EVERY break after the first opens on 。
    # (行頭禁則). A FINITE penalty (not a hard skip) means the DP still returns full,
    # in-order coverage instead of an empty/None result.
    tokens = ['あ', '。', '。', '。']
    lines = find_optimal_line_breaks(tokens, max_width=1, word_width=width_by_len,
                                     space_width=0.0, respect_kinsoku=True)
    assert lines == [['あ'], ['。'], ['。'], ['。']]
