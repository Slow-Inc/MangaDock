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
