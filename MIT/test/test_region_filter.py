"""Post-translation region filtering (#187 seam S1).

The `should_filter` block — drop regions whose translation is blank, numeric,
matches `re_filter_text`, or is identical to the source — lived **verbatim-identical
in three places** inside MangaTranslator (single 1287-1314, batch 2372-2401,
concurrent 2542-2571). Extracted to `region_filter.filter_translated_regions` so the
three drift surfaces collapse to one tested function. Behaviour preserved verbatim,
including the `none` (only-blank-filtered) and `original` (no identical-check) carve-outs.
"""
from types import SimpleNamespace

from manga_translator.config import Translator
from manga_translator.region_filter import filter_translated_regions


def _cfg(translator=Translator.gemini, filter_text='', re_filter_text=''):
    return SimpleNamespace(
        translator=SimpleNamespace(translator=translator),
        filter_text=filter_text,
        re_filter_text=re_filter_text,
    )


def _r(text, translation):
    return SimpleNamespace(text=text, translation=translation)


def test_blank_translation_is_filtered():
    kept = filter_translated_regions([_r('hi', '   ')], _cfg())
    assert kept == []


def test_numeric_translation_is_filtered_for_real_translators():
    assert filter_translated_regions([_r('hi', '123')], _cfg()) == []


def test_filter_text_match_is_filtered():
    r = _r('hi', 'buy now spam')
    assert filter_translated_regions([r], _cfg(filter_text='spam', re_filter_text='spam')) == []


def test_translation_identical_to_source_is_filtered():
    assert filter_translated_regions([_r('Hello', 'hello')], _cfg()) == []


def test_normal_translation_is_kept():
    r = _r('hi', 'สวัสดี')
    assert filter_translated_regions([r], _cfg()) == [r]


def test_none_translator_only_filters_blanks():
    # numeric + identical are NOT filtered when the translator is `none`
    rn = _r('hi', '123')
    ri = _r('Hello', 'hello')
    cfg = _cfg(translator=Translator.none)
    assert filter_translated_regions([rn, ri], cfg) == [rn, ri]


def test_original_translator_keeps_identical_text():
    r = _r('Hello', 'hello')
    assert filter_translated_regions([r], _cfg(translator=Translator.original)) == [r]
