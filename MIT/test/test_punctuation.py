"""Punctuation correction (#187 — extracted from the god object, verbatim).

`correct_punctuation` restores source-style quotation/bracket marks that a
translator swapped for target-language equivalents. It was duplicated inline in two
places inside MangaTranslator; these golden cases lock its behaviour so the
extraction + both call-site rewrites are byte-identical.
"""
from manga_translator.punctuation import correct_punctuation


def test_smart_quotes_convert_to_source_corner_brackets():
    assert correct_punctuation('「こんにちは」', '“Hello” ใช่ไหม') == '「Hello」 ใช่ไหม'


def test_forced_replacements_normalise_curly_quotes():
    assert correct_punctuation('x', '“A” ‘B’') == '「A」 「B」'


def test_corner_bracket_source_normalises_smart_quotes_even_when_counts_mismatch():
    assert correct_punctuation('「a」', '“Hello”') == '「Hello」'


def test_plain_text_is_unchanged():
    assert correct_punctuation('plain', 'plain translation') == 'plain translation'


def test_already_matching_fullwidth_brackets_are_unchanged():
    assert correct_punctuation('（A）', 'text with （A） and more') == 'text with （A） and more'


def test_fullwidth_double_quote_count_mismatch_leaves_text_untouched():
    assert correct_punctuation('『x』', '＂Hi＂ こ') == '＂Hi＂ こ'


def test_is_wired_into_the_translator():
    """Source-inspection (no ML import): both former inline copies now delegate."""
    import re
    from pathlib import Path
    mt = (Path(__file__).parent.parent / 'manga_translator' / 'manga_translator.py').read_text(encoding='utf-8')
    assert 'from .punctuation import correct_punctuation' in mt
    assert len(re.findall(r'correct_punctuation\(region\.text, region\.translation\)', mt)) == 2
    assert 'check_items = [' not in mt  # the duplicated data tables are gone
