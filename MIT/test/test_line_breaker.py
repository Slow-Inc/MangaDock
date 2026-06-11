"""LineBreaker seam unit tests (#186).

The seam lets calc_horizontal's "Step 1" be swapped between the greedy packer
and the Knuth-Plass DP (#180) without touching tokenization or assembly. The
first two tests exercise the strategies *in isolation* with a stubbed width
function — pure arithmetic, no PIL/freetype/fonts. The last test proves the
Knuth-Plass strategy is selectable through ``calc_horizontal`` and actually
balances lines (greedy leaves a lone short last word; KP pulls a word down),
pinned to the bundled font like the characterization net.
"""
from pathlib import Path

from manga_translator.rendering import text_render as tr

_FONT = str(Path(__file__).parent.parent / 'fonts' / 'Arial-Unicode-Regular.ttf')

# widths [4, 4, 1], column 9, one space. greedy fills "wxyz abcd" (9) then
# overflows "e" onto its own line; the Knuth-Plass DP keeps "wxyz" alone and
# pairs "abcd e" so neither line is needlessly short.
_WORDS = ['wxyz', 'abcd', 'e']
_WORD_WIDTHS = [4, 4, 1]
_SYLLABLES = [['wxyz'], ['abcd'], ['e']]
_PACK_KW = dict(font_size=10, max_width=9, whitespace_offset_x=1, hyphen_offset_x=0)


def test_greedy_breaker_packs_until_overflow_no_pil(monkeypatch):
    monkeypatch.setattr(tr, 'get_string_width', lambda fs, s: len(s))
    breaker = tr.GreedyLineBreaker()
    line_words, line_widths, hyphenation = breaker.pack(
        _WORDS, _WORD_WIDTHS, _SYLLABLES, **_PACK_KW)
    assert line_words == [[0, 1], [2]]          # "wxyz abcd" full, then lone "e"
    assert line_widths == [9, 1]
    assert hyphenation == [0, 0]
    assert breaker.greedy_postprocess is True   # Step 2 backward-hyphenation applies


def test_knuth_plass_breaker_balances_last_line_no_pil(monkeypatch):
    monkeypatch.setattr(tr, 'get_string_width', lambda fs, s: len(s))
    breaker = tr.KnuthPlassLineBreaker()
    line_words, line_widths, hyphenation = breaker.pack(
        _WORDS, _WORD_WIDTHS, _SYLLABLES, **_PACK_KW)
    assert line_words == [[0], [1, 2]]          # "wxyz" / "abcd e" — balanced
    assert line_widths == [4, 6]                # 4 ; 4+1+1(space)
    assert hyphenation == [0, 0]                # word granularity: never splits a word
    assert breaker.greedy_postprocess is False  # must NOT be re-greedified


def test_knuth_plass_breaker_fits_one_line_no_pil(monkeypatch):
    monkeypatch.setattr(tr, 'get_string_width', lambda fs, s: len(s))
    line_words, line_widths, hyphenation = tr.KnuthPlassLineBreaker().pack(
        ['ab', 'cd', 'ef'], [2, 2, 2], [['ab'], ['cd'], ['ef']],
        font_size=10, max_width=10, whitespace_offset_x=1, hyphen_offset_x=0)
    assert line_words == [[0, 1, 2]]            # 2+1+2+1+2 = 8 <= 10
    assert line_widths == [8]
    assert hyphenation == [0]


def test_knuth_plass_selectable_via_calc_horizontal_balances_lines():
    tr.set_font(_FONT)
    args = (40, 'the quick brown fox jumps over the lazy dog today', 220, 500, 'en_US', True)
    greedy_lines, greedy_w = tr.calc_horizontal(*args)
    kp_lines, kp_w = tr.calc_horizontal(*args, line_breaker=tr.KnuthPlassLineBreaker())
    # greedy overflows into a lone short last word; KP pulls "dog" down to balance.
    assert greedy_lines == ['the quick', 'brown fox', 'jumps over', 'the lazy dog', 'today']
    assert kp_lines == ['the quick', 'brown fox', 'jumps over', 'the lazy', 'dog today']
    assert kp_lines != greedy_lines
    assert min(kp_w) > min(greedy_w)                                  # no lone short line
    assert (max(kp_w) - min(kp_w)) < (max(greedy_w) - min(greedy_w))  # tighter spread
