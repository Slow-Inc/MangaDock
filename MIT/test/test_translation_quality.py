"""Translation glitch scoring (quality loop, 2026-10-20). Pure, torch-free.

Measured on 6 runs x 17 real pages: the LLM leaks other scripts into Thai ('Чит', '甚至连', '체인'),
leaves segments untranslated, or empties them — at random, under every prompt tried. These are
detectable without a judge, so the translator can re-ask instead of shipping them.
"""
from manga_translator.translation_quality import classify_glitch, foreign_script


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
