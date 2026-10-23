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
    leaked_script,
    negation_lost,
    normalize_thai_marks,
    runaway_translation,
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


def test_tone_before_vowel_is_reordered_889():
    """The model emits 'ท่ี' (tone then vowel); no shaper renders that order correctly."""
    assert normalize_thai_marks('ท่ี') == 'ที่'
    assert normalize_thai_marks('น้ี') == 'นี้'


def test_a_repeated_mark_in_one_cluster_is_dropped_889():
    assert normalize_thai_marks('ก้้') == 'ก้'
    assert normalize_thai_marks('ฟูู่่') == 'ฟู่'


def test_valid_thai_and_other_text_are_untouched_889():
    for s in ('ที่', 'นี้', 'ก่', 'น้ำ', 'ภาษาไทย 100%', 'Hello ที่นี่', '调用', ''):
        assert normalize_thai_marks(s) == s


def test_a_japanese_negation_missing_from_the_thai_is_flagged_898():
    """Real JP->TH path: 可愛くない ("not cute") came out น่ารักดีนะ ("cute") in 2 of 4 runs."""
    assert negation_lost('でも可愛くないなコイツ', 'แต่เด็กนี่น่ารักดีนะ', 'THA') is True
    assert negation_lost('これは良くない', 'อันนี้ดี', 'THA') is True


def test_a_kept_negation_is_not_flagged_898():
    assert negation_lost('でも可愛くないなコイツ', 'แต่ไอ้นี่ไม่น่ารักเลยนะ', 'THA') is False
    assert negation_lost('これは良くない', 'อันนี้ไม่ดี', 'THA') is False
    assert negation_lost('行かない', 'ไม่ไป', 'THA') is False


def test_english_idioms_and_clean_sources_are_not_flagged_898():
    # EN->TH path hangs on idioms ('like there's no tomorrow' -> ราวกับวันสุดท้ายของชีวิต); only JP sources are checked
    assert negation_lost("MEN HAVE BEEN FAWNING OVER ME LIKE THERES NO TOMORROW!", 'ผู้ชายต่างพากันหมกมุ่นกับฉันราวกับวันสุดท้ายของชีวิต!', 'THA') is False
    assert negation_lost('可愛いな', 'น่ารักจัง', 'THA') is False


def _loop_text(n: int = 60) -> str:
    """The observed #901 output: a short pattern cycling forever."""
    return 'แม่นดูหมั้นแม่นดูรักแม่นดูงานแม่นดูเงิน' * n


def test_a_repetition_loop_far_longer_than_its_source_is_runaway_901():
    assert runaway_translation('YOU WERE SPOT ON, GOD- MOTHER!', _loop_text()) is True


def test_a_normal_translation_is_not_runaway_901():
    src = 'YOU WERE SPOT ON, GOD- MOTHER!'
    assert runaway_translation(src, 'แม่นยายโหราศาสตร์! ทายแม่นเป๊ะทุกข้อเลย!') is False
    long_src = 'I have been looking at this scenery for a very, very long time now, and I still cannot understand it.'
    long_dst = 'ฉันมองทิวทัศน์นี้มานานมากแล้ว และก็ยังไม่เข้าใจมันอยู่ดี'
    assert runaway_translation(long_src, long_dst) is False


def test_short_outputs_and_empty_sources_are_never_runaway_901():
    # under the 120-char floor nothing is a loop, however different the source and translation are
    assert runaway_translation('!', 'โอ๊ย!' * 20) is False
    assert runaway_translation('', 'โอ๊ย!') is False


def test_a_long_output_from_a_short_source_is_runaway_901():
    assert runaway_translation('!', 'โอ๊ย!' * 40) is True


def test_cyrillic_and_cjk_leaks_are_named_903():
    """Real corpus leaks: the model transliterated Tsukuyomi into Cyrillic and CHEATS into ЧИТ."""
    assert leaked_script('ЦУКУโยมิ!', 'TSUKU- YOMI!') == 'cyrillic'
    assert leaked_script("เรียกว่า ' ЧИТ' (โกง) ได้เลย,", "THEYRE'SO STRONG THAT THEY CAN BE CALLED' CHEATS,") == 'cyrillic'
    assert leaked_script('ถ้ามีศาสนาที่ก่อตั้งขึ้น围绕สึกุโยมิ', 'IF THERE WAS A RELIGION FORMED AROUND TSUKUYOMI') == 'cjk'
    assert leaked_script('한국어 이름', 'KOREAN NAME') == 'hangul'


def test_clean_output_and_sources_that_contain_the_script_are_not_leaks_903():
    assert leaked_script('สึกุโยมิ!', 'TSUKU- YOMI!') is None
    # a source that itself carries Cyrillic is not a leak (e.g. a Russian name in the original)
    assert leaked_script('ชื่อ ЦУКУ', 'ИМЯ ЦУКУ') is None


def test_spurious_tolerance_flags_a_hallucinated_endurance_verb_1031():
    from manga_translator.translation_quality import spurious_filler
    assert spurious_filler("ฉันทนฟังบทสนทนาของเธอกับเทพธิดาแล้ว", "I HEARD YOUR CONVERSATION WITH THE GODDESS.")
    assert spurious_filler("ฉันทนมอบพลังทั้งหมดที่มีให้เธอ", "I AM GRANTING YOU ALL THE POWER I CAN.")


def test_spurious_tolerance_keeps_a_source_that_really_says_endure_1031():
    from manga_translator.translation_quality import spurious_filler
    assert not spurious_filler("ฉันทนมานานแล้ว", "I ENDURED IT FOR A LONG TIME.")
    assert not spurious_filler("ฉันทนไม่ไหวแล้ว", "I CANT STAND IT ANYMORE.")


def test_spurious_tolerance_ignores_other_words_and_tolerant_1031():
    from manga_translator.translation_quality import spurious_filler
    assert not spurious_filler("ฉันจะให้พลังเธอ", "I WILL GIVE YOU POWER.")
    assert not spurious_filler("วัสดุนี้ทนทานมาก", "THIS MATERIAL IS VERY DURABLE.")


def test_spurious_filler_flags_a_pronoun_glued_to_than_1031():
    from manga_translator.translation_quality import spurious_filler
    assert spurious_filler("ฉันทันมอบพลังทั้งหมดที่มีให้เธอ", "I AM GRANTING YOU ALL THE POWER I CAN.")
    assert not spurious_filler("ฉันจะมอบพลังทั้งหมดที่มีให้เธอ", "I AM GRANTING YOU ALL THE POWER I CAN.")
    assert not spurious_filler("ฉันทันเห็นมันก่อนที่มันจะหนีไป", "I SAW IT IN TIME BEFORE IT RAN AWAY.")


def test_spurious_filler_does_not_judge_a_japanese_source_1039b():
    from manga_translator.translation_quality import spurious_filler
    assert not spurious_filler("ฉันทนมันมานานแล้ว", "もう我慢できない")
    assert not spurious_filler("ฉันทนฟังจนจบ", "最後まで聞いた")


def test_spurious_filler_keeps_natural_thai_idioms_1039c():
    from manga_translator.translation_quality import spurious_filler
    # real translations from the corpus that are NOT broken Thai
    assert not spurious_filler("ฉันทนไม่ได้ที่จะมอบพลังอะไรให้เธอเลย", "ICANT EVEN GIVE YOU ANY POWER")
    assert not spurious_filler("อย่ามามองหน้าฉันทันทีเลย เธอช่างน่ารังเกียจจริงๆ", "JUST GET OUT OF MY SIGHT YOURE DISGUSTING.")
    assert not spurious_filler("ถ้ามีศาสนาที่บูชาสึกูโยมิ ฉันคงจะเข้าทันที", "IF THERE WAS R RFLIGION FORMED AROUND TSUKUYOMI, I")
    assert not spurious_filler("ฉันทนไม่ไหวแล้ว", "I CANT STAND IT ANYMORE.")


def test_spurious_filler_still_flags_broken_glued_shapes_1039c():
    from manga_translator.translation_quality import spurious_filler
    assert spurious_filler("ฉันทนมันมาหลายครั้งแล้ว", "IVE BEEN KILLED BY IT SO MANY TIMES...")
    assert spurious_filler("นี่ก้อวิธีที่ฉันทนเลือดในกาย...", "THIS IS HOW I DRAIN THE BLOOD IN MY BODY..")
    assert spurious_filler("ฉันทันมอบพลังทั้งหมดที่มีให้เธอ", "I AM GRANTING YOU ALL THE POWER I CAN.")


def test_lost_rendered_as_rare_is_flagged_1055():
    from manga_translator.translation_quality import lost_as_rare
    assert lost_as_rare("ของหายาก", "LOST ITEMS.")
    assert lost_as_rare("บ้านของหนึ่งในของหายากเหล่านั้น", "THIS ISLAND IS HOME TO ONE OF THOSE LOST ITEMS.")


def test_lost_as_rare_keeps_the_real_word_and_a_rare_source_1055():
    from manga_translator.translation_quality import lost_as_rare
    assert not lost_as_rare("ของหาย", "LOST ITEMS.")
    assert not lost_as_rare("ของหายาก", "RARE ITEMS.")
    assert not lost_as_rare("ของหายาก", "SCARCE RESOURCES.")
    assert not lost_as_rare("อะไรก็ได้", "LOST ITEMS.")


def test_the_filler_and_lost_guards_are_real_retry_triggers_1039_1052():
    """Regression: the predicates must be part of _is_glitched itself, not only the retry note."""
    from manga_translator.translators.common import CommonTranslator
    is_glitched = CommonTranslator._is_glitched
    assert is_glitched(None, "I AM GRANTING YOU ALL THE POWER I CAN.", "ฉันทันมอบพลังทั้งหมดที่มีให้เธอ", "THA")
    assert is_glitched(None, "LOST ITEMS.", "ของหายาก", "THA")
    assert not is_glitched(None, "HELLO THERE!", "สวัสดี!", "THA")
    assert not is_glitched(None, "RARE ITEMS.", "ของหายาก", "THA")
