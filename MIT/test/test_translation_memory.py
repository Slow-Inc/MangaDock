"""Cross-page translation memory (#187 seam S16, #136/#140).

`TranslationMemory` names the two cross-page lists that lived directly on the god object
— the per-page translated-sentence dicts and their parallel original-text dicts — plus
`reset()`. This makes the #140 bleed boundary explicit (the worker singleton accumulated
these forever; L9). The append sites and the reset-only-from-patch asymmetry stay driven
by the caller — this only wraps the shared state, byte-identical.
"""
from manga_translator.translation_memory import TranslationMemory


def test_starts_with_two_empty_lists():
    m = TranslationMemory()
    assert m.all_page_translations == []
    assert m.original_page_texts == []


def test_lists_are_plain_appendable():
    m = TranslationMemory()
    m.all_page_translations.append({'0': 'hi'})
    m.original_page_texts.append({'0': 'こんにちは'})
    assert len(m.all_page_translations) == 1
    assert m.original_page_texts[0] == {'0': 'こんにちは'}


def test_reset_clears_both_lists():
    m = TranslationMemory()
    m.all_page_translations.append({'0': 'a'})
    m.original_page_texts.append({'0': 'b'})
    m.reset()
    assert m.all_page_translations == []
    assert m.original_page_texts == []


def test_reset_rebinds_so_old_references_are_untouched():
    # reset reassigns (not .clear()) — a caller holding the old list keeps its contents
    m = TranslationMemory()
    m.all_page_translations.append({'0': 'a'})
    old = m.all_page_translations
    m.reset()
    assert old == [{'0': 'a'}]            # old list object untouched
    assert m.all_page_translations == []  # new empty list bound
