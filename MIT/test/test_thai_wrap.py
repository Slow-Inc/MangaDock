"""Tests for Thai line-breaking correctness in horizontal text rendering.

Two layers of defense against breaking Thai mid-word / orphaning marks:
  1. _insert_thai_word_breaks: pythainlp segments Thai into words and joins them
     with zero-width spaces, giving calc_horizontal word-boundary break points.
  2. _safe_char_split: the last-resort character split keeps Thai combining marks
     attached to their base consonant, so even an over-wide token never orphans a
     mark (e.g. 'ที่' -> ['ที่'], never ['ท','ี','่']).

These stay in pure-Python territory — no ML models needed.
"""
from pathlib import Path
from types import SimpleNamespace

from manga_translator.rendering import text_render as tr
from manga_translator.rendering import _clean_layout_dst
from manga_translator.rendering.text_render import (
    _insert_thai_word_breaks,
    _safe_char_split,
    _ZWSP,
    _HAS_PYTHAINLP,
)

_FONT = str(Path(__file__).parent.parent / 'fonts' / 'Arial-Unicode-Regular.ttf')


# ── _safe_char_split: cluster-safe fallback (no dependency) ───────────────────

def test_safe_split_keeps_below_vowel_and_tone_with_base():
    # 'ที่' = ท + ี (sara ii, above) + ่ (mai ek, tone). All attach to ท.
    assert _safe_char_split('ที่') == ['ที่']


def test_safe_split_keeps_mai_han_akat_with_base():
    # 'ฉัน' = ฉ + ั (mai han-akat) + น. The mark attaches to ฉ; น is its own cluster.
    assert _safe_char_split('ฉัน') == ['ฉั', 'น']


def test_safe_split_ascii_is_plain_list():
    # No Thai combining marks → identical to list().
    assert _safe_char_split('hello') == list('hello')


def test_safe_split_never_orphans_a_mark():
    # Every cluster must start with a non-combining (base) character.
    from manga_translator.rendering.text_render import _THAI_COMBINING
    for cluster in _safe_char_split('เรียนภาษาไทยที่นี่'):
        assert cluster[0] not in _THAI_COMBINING


def test_safe_split_leading_mark_does_not_crash():
    # A combining mark with no preceding base (malformed input) is kept, not dropped.
    out = _safe_char_split('ัก')
    assert ''.join(out) == 'ัก'


# ── _insert_thai_word_breaks: word-boundary segmentation ──────────────────────

def test_non_thai_text_is_unchanged():
    assert _insert_thai_word_breaks('hello world') == 'hello world'
    assert _ZWSP not in _insert_thai_word_breaks('hello world')


def test_empty_text_is_unchanged():
    assert _insert_thai_word_breaks('') == ''


# ── longest_token_width: word-atomic width (floor against mid-word breaks) ─────

def test_longest_token_width_is_word_atomic_for_thai():
    # The widest atomic word in the line is "ข้างนอก"; the helper must return its FULL
    # width (word-aware via ZWSP segmentation), not a per-character fragment.
    tr.set_font(_FONT)
    s = 'ไปกินข้างนอกกันเถอะ'
    got = tr.longest_token_width(32, s, 'th_TH')
    if _HAS_PYTHAINLP:
        assert got == tr.get_string_width(32, 'ข้างนอก')
    else:
        # No segmentation → whole line is one token.
        assert got == tr.get_string_width(32, s)


def test_longest_token_width_latin_uses_widest_word():
    tr.set_font(_FONT)
    assert tr.longest_token_width(40, 'hi enormous ok', 'en_US') == tr.get_string_width(40, 'enormous')


def test_longest_token_width_empty_is_zero():
    tr.set_font(_FONT)
    assert tr.longest_token_width(40, '', 'en_US') == 0


# ── clean-layout must never force-break a Thai word mid-word ───────────────────

def test_clean_layout_does_not_break_thai_word_in_narrow_box():
    # A dialogue line misrouted to clean-layout with a NARROW source bbox (40px) must not
    # force-split "ข้างนอก" mid-word: the returned block width is floored to the longest word,
    # so re-wrapping at that width keeps the word intact. (Regression: item 9 word-break.)
    tr.set_font(_FONT)
    region = SimpleNamespace(xyxy=(0, 0, 40, 200), translation='ไปกินข้างนอกกันเถอะ',
                             font_size=0, target_lang='th_TH')
    clean_fs, block_w, block_h = _clean_layout_dst(region, (1000, 1000), 8, 0, (1000, 1000))
    lines, _ = tr.calc_horizontal(clean_fs, region.translation, int(block_w), 10 ** 7, language='th_TH')
    if _HAS_PYTHAINLP:
        assert any('ข้างนอก' in ln for ln in lines), lines


def test_supersample_wrap_floor_keeps_thai_word_whole():
    # The renderer re-wraps the laid-out text at the SUPERSAMPLED scale (font*ss). Integer rounding
    # of the ss-scaled column can land one pixel below the widest atomic word at font*ss and
    # force-split a Thai word mid-cluster ("ทำอาหาร"→"ทำอา"/"หาร") — even though the layout floored
    # the column at ss=1. render() now floors the supersampled column at longest_token_width(font*ss);
    # this pins that the floor keeps the word whole where one px under splits it. (Regression: p19.)
    tr.set_font(_FONT)
    text = 'ฉันทำอาหารและงานบ้านได้'
    fs, ss = 17, 4
    floor_ss = tr.longest_token_width(fs * ss, text, 'th_TH')
    lines_under, _ = tr.calc_horizontal(fs * ss, text, floor_ss - 1, 10 ** 7, language='th_TH')
    lines_floored, _ = tr.calc_horizontal(fs * ss, text, max(floor_ss - 1, floor_ss), 10 ** 7, language='th_TH')
    if _HAS_PYTHAINLP:
        assert not any('ทำอาหาร' in ln for ln in lines_under), lines_under   # one px under -> split
        assert any('ทำอาหาร' in ln for ln in lines_floored), lines_floored   # floor -> whole


def test_thai_text_segmented_into_words_when_available():
    s = 'ตัวของฉันนั้นกำลังจะไปอยู่แล้ว'
    out = _insert_thai_word_breaks(s)
    if _HAS_PYTHAINLP:
        # ZWSP break opportunities are inserted; stripping them restores the text.
        assert _ZWSP in out
        assert out.replace(_ZWSP, '') == s
        # The known bad break 'จะ' -> 'จ' + 'ะ' must not be a break point:
        # 'กำลังจะ' is one token, so no ZWSP sits between จ and ะ.
        assert 'จ' + _ZWSP + 'ะ' not in out
    else:
        # Degrades to a no-op without the dependency (cluster-safe fallback still
        # protects marks at the calc_horizontal layer).
        assert out == s
