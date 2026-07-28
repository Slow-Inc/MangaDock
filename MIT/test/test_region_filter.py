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


def test_sfx_rescued_region_survives_the_identical_filter():
    """#168: a vision-OCR-rescued SFX carries text == translation (both the English
    onomatopoeia), which would trip the 'identical to source' drop. Rescued regions
    with a non-blank translation are kept so the localized SFX renders + its mask
    inpaints the original art."""
    r = SimpleNamespace(text='LOOM', translation='LOOM', sfx_rescued=True)
    assert filter_translated_regions([r], _cfg()) == [r]


def test_sfx_rescued_region_with_blank_translation_is_still_filtered():
    """A rescued region that ended up blank has nothing to render → still dropped."""
    r = SimpleNamespace(text='LOOM', translation='   ', sfx_rescued=True)
    assert filter_translated_regions([r], _cfg()) == []


# ---- #535 Phase-0a: drop telemetry — every dropped region + its reason exposed ----

def test_with_drops_returns_kept_and_dropped_with_reasons():
    from manga_translator.region_filter import filter_translated_regions_with_drops
    keep = _r('hello', 'สวัสดี')
    blank = _r('konnichiwa', '   ')
    numeric = _r('123', '42')
    kept, dropped = filter_translated_regions_with_drops([keep, blank, numeric], _cfg())

    assert kept == [keep]
    assert [(r is blank, reason) for r, reason in dropped][0] == (True, 'Translation contain blank areas')
    assert dropped[1][0] is numeric and dropped[1][1] == 'Numeric translation'


def test_with_drops_blank_translation_is_still_reported():
    # the legacy logger skipped blank translations entirely — telemetry must not.
    from manga_translator.region_filter import filter_translated_regions_with_drops
    blank = _r('source text here', '')
    kept, dropped = filter_translated_regions_with_drops([blank], _cfg())
    assert kept == [] and len(dropped) == 1
    assert dropped[0][1] == 'Translation contain blank areas'


def test_legacy_filter_unchanged_and_delegates():
    # backward compat: same kept list as the *_with_drops variant.
    from manga_translator.region_filter import filter_translated_regions_with_drops
    regions = [_r('a', 'b'), _r('x', ''), _r('n', '7')]
    kept_legacy = filter_translated_regions(list(regions), _cfg())
    kept_new, _ = filter_translated_regions_with_drops(list(regions), _cfg())
    assert kept_legacy == kept_new
