"""Translation glitch scoring (quality loop, 2026-10-20). Pure, torch-free.

Measured on 6 runs x 17 real pages: the LLM leaks other scripts into Thai ('Чит', '甚至连', '체인'),
leaves segments untranslated, or empties them — at random, under every prompt tried. These are
detectable without a judge, so the translator can re-ask instead of shipping them.
"""
from manga_translator.translation_quality import (
    classify_glitch,
    foreign_script,
    is_letter_name_spelling,
    is_oversized_art_glyph,
)


def test_foreign_script_flags_other_scripts_but_not_the_target_or_latin():
    assert foreign_script('ฉัน甚至连พลัง', 'THA')
    assert foreign_script('" Чит" (โกง)', 'THA')
    assert foreign_script('체인ซอแมน', 'THA')
    assert not foreign_script('สวัสดี HP 100%', 'THA')
    assert not foreign_script('anything', 'ENG')  # no script rule for Latin targets


def test_japanese_punctuation_is_not_a_leak():
    assert not foreign_script('・โลกเกมโอโตเมะ', 'THA')
    assert not foreign_script('อาาาーー', 'THA')


def test_classify_glitch_names_leaks_untranslated_and_empty():
    sources = ['HELLO', 'SPECIAL THANKS TO ALL', 'BYE', 'HP']
    outputs = ['สวัสดี 甚至连', 'SPECIAL THANKS TO ALL', '', 'HP']
    assert [classify_glitch(s, d, 'THA') for s, d in zip(sources, outputs)] ==         ['foreign_script', 'untranslated', 'empty', None]
    assert not any(classify_glitch(s, d, 'THA')
                   for s, d in zip(sources, ['สวัสดี', 'ขอบคุณทุกคน', 'ลาก่อน', 'HP']))


def test_script_table_is_shared_with_the_page_ratio_check():
    """One script table (utils/lang_ratio) for both the page-level ratio check and the per-segment
    leak check — Serbian/Montenegrin Cyrillic targets are known to both."""
    assert not foreign_script('Здраво', 'SRP')
    assert foreign_script('Здраво 你好', 'SRP')


def test_a_script_copied_from_the_source_is_not_foreign():
    assert not foreign_script('ドン เสียงดัง', 'THA', source='ドン')
    assert foreign_script('ドン เสียงดัง', 'THA', source='BANG')
    assert classify_glitch('ドン', 'ドン', 'THA') is None
    assert classify_glitch('BANG', 'ドン', 'THA') == 'foreign_script'


def test_ocr_noise_glyph_tokens_are_stripped_from_latin_text_857():
    """#857 follow-up (Iruma p0, Anta p1, 2026-10-21): once kept, '피 WONDER WHY..' translated as
    'เพราะ WONDER' (the misread '피' confused the LLM) and '╩ THATS HOW…' carried the '╩' into the
    Thai. A whitespace token made only of non-Latin glyphs in otherwise Latin text is OCR noise."""
    from manga_translator.translation_quality import strip_noise_glyphs
    assert strip_noise_glyphs('피 WONDER WHY..') == 'WONDER WHY..'
    assert strip_noise_glyphs('╩ THATS HOW YOU WANNA PLAY IT,') == 'THATS HOW YOU WANNA PLAY IT,'
    assert strip_noise_glyphs('I AL- READY KNEW THAT, DUMMY. ○') == 'I AL- READY KNEW THAT, DUMMY.'
    # kept: Latin letters with accents, punctuation, hearts, and anything not mostly Latin
    for keep in ('CAFÉ… ♡', 'DON’T — STOP!', '★ BONUS ★', 'ข้อความไทย OK', '平ク ザワ'):
        assert strip_noise_glyphs(keep) == keep


def test_noise_strip_keeps_real_symbols_and_names_857():
    """Review of 8ec816dd: the allow-list stripped real text — '€', '×', '→', '©', '½', a kanji name.
    Only known OCR-noise classes (Hangul, box drawing, geometric shapes) are stripped."""
    from manga_translator.translation_quality import strip_noise_glyphs
    for keep in ('100 € ONLY!!', '3 × 4 = 12', 'GO A → B', '© 2024 SHUEISHA', 'ONE ½ CUP',
                 'MR. 田中 IS HERE NOW OK', 'WOW 😂 LOL'):
        assert strip_noise_glyphs(keep) == keep, keep
    assert strip_noise_glyphs('A\n피 WONDER') == 'A WONDER'


def test_a_lookalike_katakana_inside_an_english_word_is_read_as_latin_857():
    """Third corpus, Horimiya p0: OCR read STRANGELY as 'STRANGEレY…' and the LLM transliterated the kana
    ('เล่ย์แปลกๆ…'). Inside a token that also has Latin letters, katakana that look like Latin letters
    (レ L, ロ O, エ E) are OCR misreads; Japanese words without Latin letters are left alone."""
    from manga_translator.translation_quality import strip_noise_glyphs
    assert strip_noise_glyphs('STRANGEレY…') == 'STRANGELY…'
    assert strip_noise_glyphs('GロOD MエRNING') == 'GOOD MERNING'
    for keep in ('レロエ', 'ザワ ザワ', 'TOKYO レストラン'):
        assert strip_noise_glyphs(keep) == keep, keep


def test_a_letter_name_spelling_of_stylized_art_is_flagged_882():
    """Boku p0: the bubble-letter SFX `Siiigh` was OCR-read as `Siiig` and the translator spelled the
    letters out into `ซีไอไอ`, which rendered as junk over the art (#882)."""
    assert is_letter_name_spelling('Siiig', 'ซีไอไอ') is True


def test_real_dialogue_and_abbreviations_are_not_spellings_882():
    assert is_letter_name_spelling('SOR', 'ขอ...') is False        # one letter name, real word
    assert is_letter_name_spelling('OMG', 'โอเอ็มจี') is False      # all-caps abbreviation
    assert is_letter_name_spelling('OK', 'โอเค') is False          # two syllables, real abbreviation
    assert is_letter_name_spelling('LOOM', 'ลูม') is False          # not letter names
    assert is_letter_name_spelling('MAN', 'โธ่...') is False


def test_spelling_guard_needs_a_stylized_source_882():
    assert is_letter_name_spelling('Aaaah', 'ซีไอไอ') is True       # stylized read
    assert is_letter_name_spelling('Hmm', 'ซีไอไอ') is False        # too short
    assert is_letter_name_spelling('TOWELS', 'ซีไอไอ') is False     # no repeated letter


def test_a_logo_scale_single_cjk_glyph_is_art_not_dialogue_886():
    """Tsuki ga Michibiku Isekai Douchuu p0: the title logo `月が導く異世界道中` was detected as a
    single `月` glyph and rendered as `เดือน` over the logo, mangling it. Mushoku p1's `을` (OCR noise
    on art) rendered `อูล`. Art-scale single glyphs are left as art."""
    assert is_oversized_art_glyph('月', 120) is True
    assert is_oversized_art_glyph('을', 120) is True


def test_small_or_non_art_glyphs_are_kept_886():
    assert is_oversized_art_glyph('月', 40) is False          # small = readable text, keep
    assert is_oversized_art_glyph('あ', 80) is False         # below art scale
    assert is_oversized_art_glyph('AB', 120) is False        # ASCII is not a CJK art glyph
    assert is_oversized_art_glyph('月', 120, rescued=True) is False    # the rescue localized it already
    assert is_oversized_art_glyph('月光の下', 120) is False   # phrase, not a single glyph
    assert is_oversized_art_glyph('ドン', 150, rescued=False) is True  # big SFX the rescue could not serve -> art
