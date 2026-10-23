"""Series-scoped name memory for the single-page path (#980 follow-up)."""
from types import SimpleNamespace

from manga_translator.series_glossary_memory import (
    remember_and_apply, reset_memory, series_memory_enabled,
)


def _region(src, dst):
    return SimpleNamespace(text=src, translation=dst)


def test_the_second_page_of_a_series_gets_the_first_pages_spelling():
    reset_memory()
    page1 = [_region("TSUKUYOMI IS HERE.", "สึกุโยมิอยู่ที่นี่"), _region("TSUKUYOMI.", "สึกุโยมิ")]
    assert remember_and_apply(page1, "series: tsuki", "THA") == 0          # first page learns only
    page2 = [_region("TSUKUYOMI!", "ทสึคึโยมิ!")]
    assert remember_and_apply(page2, "series: tsuki", "THA") == 1
    assert page2[0].translation == "สึกุโยมิ!"


def test_another_series_is_not_touched_by_the_first_series_memory():
    reset_memory()
    remember_and_apply([_region("TSUKUYOMI.", "สึกุโยมิ")], "series: tsuki", "THA")
    other = [_region("TSUKUYOMI!", "ทสึคึโยมิ!")]
    assert remember_and_apply(other, "series: other", "THA") == 0
    assert other[0].translation == "ทสึคึโยมิ!"


def test_the_same_series_in_another_target_language_has_its_own_memory():
    reset_memory()
    remember_and_apply([_region("TSUKUYOMI.", "สึกุโยมิ")], "series: tsuki", "THA")
    english = [_region("TSUKUYOMI!", "Tsukuyomi!")]
    assert remember_and_apply(english, "series: tsuki", "ENG") == 0


def test_without_a_series_key_nothing_is_remembered_or_applied():
    reset_memory()
    page1 = [_region("TSUKUYOMI.", "สึกุโยมิ")]
    assert remember_and_apply(page1, None, "THA") == 0
    page2 = [_region("TSUKUYOMI!", "ทสึคึโยมิ!")]
    assert remember_and_apply(page2, None, "THA") == 0
    assert page2[0].translation == "ทสึคึโยมิ!"


def test_the_memory_is_on_by_default_and_can_be_switched_off():
    assert series_memory_enabled({})
    assert series_memory_enabled({'MIT_SERIES_GLOSSARY': '1'})
    assert not series_memory_enabled({'MIT_SERIES_GLOSSARY': '0'})
    assert not series_memory_enabled({'MIT_SERIES_GLOSSARY': 'off'})
    assert not series_memory_enabled({'MIT_NAME_GLOSSARY': '0'})
