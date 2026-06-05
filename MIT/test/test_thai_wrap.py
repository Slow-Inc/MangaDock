"""Tests for Thai line-breaking correctness in horizontal text rendering.

Two layers of defense against breaking Thai mid-word / orphaning marks:
  1. _insert_thai_word_breaks: pythainlp segments Thai into words and joins them
     with zero-width spaces, giving calc_horizontal word-boundary break points.
  2. _safe_char_split: the last-resort character split keeps Thai combining marks
     attached to their base consonant, so even an over-wide token never orphans a
     mark (e.g. 'ที่' -> ['ที่'], never ['ท','ี','่']).

These stay in pure-Python territory — no ML models needed.
"""
from manga_translator.rendering.text_render import (
    _insert_thai_word_breaks,
    _safe_char_split,
    _ZWSP,
    _HAS_PYTHAINLP,
)


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
