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


# ── no-break rules on top of newmm tokens (2026-10-20 quality loop) ───────────
# newmm splits bound morphemes off their head ('ผู้|พักอาศัย'), so the wrapper could end a line
# on 'ผู้' and start the next with 'พักอาศัย' — seen on the 2026-10-20 EN→TH caption page.

def _segments(text):
    return _insert_thai_word_breaks(text).split(_ZWSP)


def test_prefix_morpheme_stays_with_its_head():
    if not _HAS_PYTHAINLP:
        return
    assert 'ผู้พักอาศัย' in _segments('ผู้พักอาศัยถูกท่วมท้นโดยไม่มีโอกาส')


def test_repetition_mark_never_starts_a_segment():
    if not _HAS_PYTHAINLP:
        return
    assert not any(s.startswith('ๆ') for s in _segments('เด็กๆ วิ่งเล่นกันอยู่'))


def test_brackets_and_quotes_bind_to_the_word_they_enclose():
    if not _HAS_PYTHAINLP:
        return
    segs = _segments('ในปี 1254 ตามปฏิทินจักรวรรดิ (IC) เรียกว่า "บั๊กส์"')
    assert not any(s in ('(', ')', '"') for s in segs)
    assert '"บั๊กส์"' in segs  # a straight quote opens, then closes


def test_demonstrative_stays_with_the_word_it_modifies():
    """Replay A/B 2026-10-20 (Tsukimichi p0): 'เทพธิดาพวก / นั้น' — newmm splits 'พวก|นั้น' and the
    wrapper broke between them. A demonstrative (นี้/นั้น/โน้น) never starts a line."""
    if not _HAS_PYTHAINLP:
        return
    segs = _segments('เทพธิดาพวกนั้นช่างน่ารังเกียจนัก!')
    assert not any(s.startswith(('นั้น', 'นี้', 'โน้น')) for s in segs)


def test_overwide_thai_compound_splits_into_dictionary_subwords():
    """A compound wider than the column must break between its dictionary parts, not at an
    arbitrary character cluster."""
    if not _HAS_PYTHAINLP:
        return
    from manga_translator.rendering.text_render import _thai_subwords
    assert _thai_subwords('ในเวลาเดียวกัน') == ('ใน', 'เวลา', 'เดียวกัน')
    assert _thai_subwords('เวสตา') is None  # no dictionary split -> caller falls back


def test_line_breaks_never_split_a_thai_word():
    """The resize_regions_thai golden caught it (2026-10-20): at 38 px calc_horizontal laid out
    'น่ารักในเวลาเดี / ยวกันเลยนะ'. newmm keeps 'ในเวลาเดียวกัน' as one token; wider than the
    column, it was char-split. Every break must fall on a word or dictionary-subword boundary."""
    if not _HAS_PYTHAINLP:
        return
    from manga_translator.rendering.text_render import _thai_subwords
    tr.set_font(_FONT)
    text = 'ไฮมิยะเซนไพน่ากลัวและก็น่ารักในเวลาเดียวกันเลยนะ'
    boundaries, pos = set(), 0
    for seg in _segments(text):
        for part in (_thai_subwords(seg) or [seg]):
            pos += len(part)
            boundaries.add(pos)
    for size in range(24, 44):
        lines, _ = tr.calc_horizontal(size, text, max_width=239, max_height=184, language='THA')
        pos = 0
        for line in lines[:-1]:
            pos += len(line.replace(_ZWSP, '').replace('-', ''))
            assert pos in boundaries, (size, lines)


def test_thai_sentence_spaces_survive_wrapping():
    """Thai separates sentences/phrases with a space ('เวสตา มีอุตสาหกรรม'); the ZWSP segmentation
    dropped every space, so rendered captions ran sentences together. A space that fits stays a
    space; a break may replace it, and no line starts or ends with one."""
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_FONT)
    text = 'ดาวอาณานิคมเวสตา มีอุตสาหกรรมหลักคือเกษตรกรรม'
    lines, _ = tr.calc_horizontal(20, text, max_width=2000, max_height=400, language='THA')
    assert lines == [text]
    lines, _ = tr.calc_horizontal(20, text, max_width=180, max_height=400, language='THA')
    assert len(lines) > 1
    assert all(l == l.strip() for l in lines)
    assert ''.join(l.replace(_ZWSP, '') for l in lines).replace(' ', '') == text.replace(' ', '')


def test_punctuation_never_starts_a_line_even_with_kept_spaces():
    """Replay A/B 2026-10-20 (Chainsaw Man credits): 'RTSD / ,ZERO' — once spaces were kept, the
    comma token became ', ' and the closer check no longer recognised it."""
    if not _HAS_PYTHAINLP:
        return
    segs = _segments('จัดหน้าโดย RTSD, ZERO และ "เพื่อน" ของเขา')
    assert not any(s.strip()[:1] in ',.!?:;…)”' for s in segs[1:])  # a straight " may open


def test_space_after_punctuation_survives_in_spaced_languages():
    """#792: compact_special_symbols deleted every space after punctuation (a CJK rule), so English
    rendered 'Well,I / so!Yes.' and Thai credits 'RTSD,ZERO'. CJK still compacts."""
    c = tr.compact_special_symbols
    assert c('Well, I think so! Yes.') == 'Well, I think so! Yes.'
    assert c('จัดหน้าโดย RTSD, ZERO') == 'จัดหน้าโดย RTSD, ZERO'
    assert c('เยส! ฉันอยากทำ') == 'เยส! ฉันอยากทำ'
    assert c('안녕! 세계') == '안녕! 세계'
    assert c('你好！ 世界') == '你好！世界'
    assert c('本当? 嘘だ') == '本当?嘘だ'
    assert c('Wait... what') == 'Wait… what'


def test_put_text_horizontal_wraps_english_on_its_spaces(monkeypatch):
    """#792: the render entry point compacts before wrapping — measure what it actually wraps."""
    seen = {}
    real = tr.calc_horizontal

    def spy(font_size, text, *a, **k):
        seen['text'] = text
        return real(font_size, text, *a, **k)

    monkeypatch.setattr(tr, 'calc_horizontal', spy)
    tr.set_font(_FONT)
    tr.put_text_horizontal(20, 'Well, I think so! Yes.', 90, 400, 'center', False,
                           (0, 0, 0), (255, 255, 255), 'en_US')
    assert seen['text'] == 'Well, I think so! Yes.'


def test_a_token_starting_with_punctuation_never_starts_a_line():
    """#792: a translator that typed no space ('RTSD,ZERO') makes newmm emit ',ZERO' — the comma
    must still stay on the previous line."""
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_FONT)
    for size in range(14, 30):
        for w in range(60, 130, 6):
            lines, _ = tr.calc_horizontal(size, 'จัดหน้าโดย RTSD,ZERO', max_width=w, max_height=400,
                                          language='THA')
            assert not any(l.lstrip().startswith(',') for l in lines), (size, w, lines)


def test_latin_words_inside_thai_text_are_not_split():
    """Guard (2026-10-20): a replay of the Chainsaw Man credits page showed 'RTSD / ,ZERO'. A fresh
    process does not reproduce it at any size — this pins that a Latin word and its comma stay
    together, so a regression shows up here rather than on a page."""
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_FONT)
    for size in range(14, 30):
        lines, _ = tr.calc_horizontal(size, 'จัดหน้าโดย RTSD, ZERO', max_width=110, max_height=400, language='THA')
        assert not any(l.lstrip().startswith(',') for l in lines), (size, lines)
        assert any('RTSD' in l for l in lines), (size, lines)


def _assert_no_mid_word(lines, words):
    """Every dictionary word must sit whole on one line."""
    joined = [l.replace(' ', '') for l in lines]
    for w in words:
        assert any(w in l for l in joined), (w, lines)


def test_a_kept_space_does_not_stop_the_dictionary_split():
    """Review 2026-10-20: the trailing space #791 keeps on a token made _thai_subwords fail
    ('ในเวลาเดียวกัน ' is not in the trie) so the compound fell to a mid-word char split."""
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_FONT)
    lines, widths = tr.calc_horizontal(20, 'ผมไปในเวลาเดียวกัน ครับ', 70, 400, language='THA')
    _assert_no_mid_word(lines, ['เวลา', 'เดียวกัน', 'ครับ'])


def test_an_over_wide_dictionary_part_is_split_again():
    """'ในเวลาเดียวกันนั้น' -> fewest words ('ในเวลาเดียวกัน', 'นั้น'); the first part is itself
    too wide and must break at its own dictionary parts ('เดียว|กัน'), not mid-word ('เดียวกั|นนั้น')."""
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_FONT)
    lines, _ = tr.calc_horizontal(20, 'ในเวลาเดียวกันนั้น', 60, 400, language='THA')
    _assert_no_mid_word(lines, ['เวลา', 'เดียว', 'กัน', 'นั้น'])


def test_a_demonstrative_after_a_real_space_may_start_a_line():
    """A space is a legal Thai break point; gluing 'นี้' back across it made 'ชื่อ นี้' unbreakable."""
    from manga_translator.rendering.text_render import _glue_thai_tokens
    assert _glue_thai_tokens(['ชื่อ ', 'นี้']) == ['ชื่อ ', 'นี้']
    assert _glue_thai_tokens(['ชื่อ', 'นี้']) == ['ชื่อนี้']


def test_no_rendered_line_starts_or_ends_with_a_space():
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_FONT)
    for text in ['กันนั้น ', 'ในเวลาเดียวกันนั้น ครับ', 'เยส! ฉันอยากทำ']:
        for w in (40, 60, 90):
            lines, _ = tr.calc_horizontal(20, text, w, 400, language='THA')
            assert all(l == l.strip(' ') for l in lines), (text, w, lines)


def test_every_piece_of_a_spaced_compound_fits_the_column():
    """2026-10-20: the kept trailing space appended to the last dictionary piece made it wider than
    max_width, and the greedy packer (which assumes every piece fits) broke empty lines forever."""
    if not _HAS_PYTHAINLP:
        return
    from manga_translator.rendering.text_render import _fit_syllable
    tr.set_font(_FONT)
    for w in range(40, 120, 3):
        for piece in _fit_syllable('ในเวลาเดียวกัน ', 20, w):
            assert tr.get_string_width(20, piece) <= w, (w, piece)


def test_greedy_pack_places_an_over_wide_syllable_instead_of_looping():
    """Guard for the packer's invariant: a syllable wider than the column goes on its own line.
    (Red not run on purpose — before the guard this call never returns and eats memory.)"""
    tr.set_font(_FONT)
    word = 'กกกกกกกกกกกกกกกกกกกก'
    w = tr.get_string_width(20, word)
    lines, widths, _ = tr._greedy_pack([word], [w], [[word]], 20, w // 2, 0, 0)
    assert lines == [[0]]


def _ink_height(font, text):
    import cv2
    tr.set_font(font)
    img = tr.put_text_horizontal(60, text, 600, 300, 'left', False, (0, 0, 0), (255, 255, 255), 'THA')
    return cv2.boundingRect(img[..., 3])[3]


def test_a_tone_mark_over_an_upper_vowel_stays_visible():
    """#793: Prompt (prod font) puts the tone at the vowel's height and relies on OpenType
    mark-to-mark positioning, which this per-glyph renderer lacks — 'ที่' drew as 'ที'."""
    prompt = str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf')
    for word, bare in [('ที่', 'ที'), ('นี้', 'นี'), ('กั้น', 'กัน'), ('น้ำ', 'นำ'), ('ต่ำ', 'ตำ')]:
        assert _ink_height(prompt, word) > _ink_height(prompt, bare), word


def test_a_font_that_already_places_the_tone_high_is_untouched():
    tr.set_font(_FONT)
    assert tr._stacked_mark_lift('ที่', 2, 60) == 0


def test_arial_never_lifts_a_stacked_mark_at_any_size():
    """#793 must leave a font that already sets tones high byte-identical (the render goldens)."""
    tr.set_font(_FONT)
    for size in range(12, 64, 4):
        for word in ('ที่', 'นี้', 'ปี่', 'กิ๊ก',
                     'น้ำ', 'ศักดิ์'):
            assert all(tr._stacked_mark_lift(word, k, size) == 0 for k in range(len(word))), (size, word)


_PROMPT = str(Path(__file__).parent.parent / 'fonts' / 'Prompt-Regular.ttf')


def test_a_bracketed_word_that_fits_is_not_split_by_its_trailing_space():
    """Scrutinize 2026-10-21: '(ผู้ชาย)' is exactly as wide as the column; its kept trailing space
    made the piece over-wide, so it was char-split to '(ผู้' / 'ชาย)'."""
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_PROMPT)
    lines, _ = tr.calc_horizontal(20, 'ฉัน (ผู้ชาย) ไป', 60, 400, language='THA')
    assert any('(ผู้ชาย)' in l for l in lines), lines


def test_spaced_mai_yamok_never_starts_a_line_and_words_stay_whole():
    """Scrutinize 2026-10-21: newmm returns 'ไป ๆ มา ๆ' as ONE token with spaces inside; it was
    char-split ('ไป ๆ ม' / 'า ๆ อยู่') or, without ZWSP, split on spaces so 'ๆ' started a line."""
    if not _HAS_PYTHAINLP:
        return
    tr.set_font(_PROMPT)
    for text in ('ฉันเดินไป ๆ มา ๆ อยู่ที่นี่ทั้งวันเลย', 'ไป ๆ มา ๆ'):
        for w in (60, 90):
            lines, _ = tr.calc_horizontal(20, text, w, 400, language='THA')
            assert not any(l.startswith('ๆ') for l in lines), (text, w, lines)
            assert not any(l.endswith('ม') for l in lines), (text, w, lines)


def test_a_tall_balloon_shrinks_the_font_until_the_block_fits_816():
    """#816: bubble_fit_tall fell back to the flat 20 px unconditionally, so a Thai line wider than
    the balloon's interior was placed spilling past the edge (Tsuki p1: 8-25 px over the art)."""
    if not _HAS_PYTHAINLP:
        return
    from manga_translator.rendering import _clean_layout_dst
    tr.set_font(_PROMPT)
    region = SimpleNamespace(translation='เทพธิดาพวกนั้นช่างน่ารักจริงๆ เลยนะ', target_lang='THA',
                             font_size=0, xyxy=(0.0, 0.0, 44.0, 180.0))
    _, bw0, _ = _clean_layout_dst(region, (800, 800, 3), 8, 20)
    assert bw0 > 44 * 1.05  # the flat 20 px really overflows this interior
    fs, bw, bh = _clean_layout_dst(region, (800, 800, 3), 8, 20, shrink_to_fit=True)
    assert fs < 20 and bw <= 44 * 1.05 and bh <= 180, (fs, bw, bh)


def test_fullwidth_and_double_marks_never_start_a_line():
    """'จะทำยังไง / ⁉ ตอนนี้' (One-Punch JP->TH): ⁉ ‼ ！ ？ were not in the closer set."""
    from manga_translator.rendering.text_render import _glue_thai_tokens
    for mark in ('⁉', '‼', '！', '？'):
        assert _glue_thai_tokens(['ยังไง', mark]) == ['ยังไง' + mark], mark


def test_a_tall_balloon_keeps_its_size_when_dictionary_breaks_make_it_fit_816():
    """#816 replay: the first fix shrank 'เทพธิดาพวกนั้นช่างน่ารังเกียจนัก!' to 10 px in a 74x166 interior,
    because the column was never narrower than its longest word. Broken at dictionary parts it fits
    at the full 20 px as a 5-line column — shrink only when that is not enough."""
    if not _HAS_PYTHAINLP:
        return
    from manga_translator.rendering import _clean_layout_dst
    tr.set_font(_PROMPT)
    region = SimpleNamespace(translation='เทพธิดาพวกนั้นช่างน่ารังเกียจนัก!', target_lang='THA',
                             font_size=0, xyxy=(0.0, 0.0, 74.0, 166.0))
    fs, bw, bh = _clean_layout_dst(region, (800, 800, 3), 8, 20, shrink_to_fit=True)
    assert fs == 20 and bw <= 74 * 1.05 and bh <= 166, (fs, bw, bh)


def test_render_rewrap_follows_the_layouts_dictionary_breaks_816():
    """#816 replay: the layout broke 'น่ารังเกียจ' to fit a 68 px balloon, but the supersampled
    render re-wrapped at >= the longest whole word, then squeezed the wider block into the box —
    the text came out visibly smaller. When the layout had to split a word, re-wrap at the layout's
    own width; otherwise the floor is unchanged."""
    if not _HAS_PYTHAINLP:
        return
    from manga_translator.rendering import _render_wrap_width
    tr.set_font(_PROMPT)
    thai = 'เทพธิดาพวกนั้นช่างน่ารังเกียจนัก!'
    assert _render_wrap_width(20, thai, 'THA', 68.0, 4) <= (68 + 1) * 4
    assert _render_wrap_width(20, 'HELLO THERE', 'en_US', 200.0, 4) == 800
