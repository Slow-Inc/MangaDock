"""Unit tests for target-language script ratio (Issue #109).

Pure function, no ML imports.
"""
from manga_translator.utils.lang_ratio import target_script_ratio


def test_thai_page_with_a_few_latin_sfx_is_mostly_thai():
    # A correctly-translated Thai page that still contains untranslated credits/SFX.
    text = "อายจังไม่อยากให้ใครสนใจฉันเลยอยากหายไปเลยเธอไม่เป็นไรนะ SETSU SCANS"
    assert target_script_ratio(text, "THA") > 0.8


def test_untranslated_latin_when_target_thai_is_near_zero():
    text = "HAIMIYA SENPAI IS SCARY AND CUTE"
    assert target_script_ratio(text, "THA") < 0.1


def test_english_translation_when_target_english_is_high():
    assert target_script_ratio("I want to disappear into the crowd", "ENG") > 0.9


def test_untranslated_japanese_when_target_english_is_low():
    assert target_script_ratio("恥ずかしい目立ちたくない", "ENG") < 0.1


def test_empty_or_symbol_only_text_does_not_reject():
    assert target_script_ratio("", "THA") == 1.0
    assert target_script_ratio("!!! ... ?!", "THA") == 1.0


def test_unknown_target_falls_back_to_latin():
    # An unlisted target language is treated as Latin-script.
    assert target_script_ratio("hello world", "XYZ") > 0.9
