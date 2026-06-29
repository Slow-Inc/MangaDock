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

import pytest

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


# --- #180 step 2 (gap-D adoption): the render path must be able to forward a chosen
# line_breaker all the way to calc_horizontal, so the balanced KP wrap reaches the
# actual rendered glyphs (put_text_horizontal), not just the fit measurement. ---

class _StopRender(Exception):
    """Abort put_text_horizontal right after calc_horizontal so the test stays font-free."""


def test_put_text_horizontal_forwards_line_breaker_to_calc_horizontal(monkeypatch):
    sentinel = tr.KnuthPlassLineBreaker()
    captured = {}

    def fake_calc_horizontal(*args, **kwargs):
        captured['line_breaker'] = kwargs.get('line_breaker')
        raise _StopRender                      # stop before any glyph rendering (no font needed)

    monkeypatch.setattr(tr, 'calc_horizontal', fake_calc_horizontal)
    with pytest.raises(_StopRender):
        tr.put_text_horizontal(40, 'hello world', 200, 500, 'center', False,
                               (0, 0, 0), None, line_breaker=sentinel)
    assert captured['line_breaker'] is sentinel


def test_put_text_horizontal_defaults_to_no_line_breaker(monkeypatch):
    # Default call (no line_breaker) forwards None → calc_horizontal picks GreedyLineBreaker,
    # i.e. byte-identical to today. Guards the opt-in contract.
    captured = {}

    def fake_calc_horizontal(*args, **kwargs):
        captured['line_breaker'] = kwargs.get('line_breaker', 'MISSING')
        raise _StopRender

    monkeypatch.setattr(tr, 'calc_horizontal', fake_calc_horizontal)
    with pytest.raises(_StopRender):
        tr.put_text_horizontal(40, 'hello world', 200, 500, 'center', False, (0, 0, 0), None)
    assert captured['line_breaker'] is None
