"""#535: the source_lang_only filter must not drop Latin-script source text on a
langdetect misfire — live Otome p10 lost "STARTING WITH THE HEROINE…" to a
Maltese guess and "SiEg…" to Danish, leaving them untranslated on the page."""
from types import SimpleNamespace

from manga_translator.manga_translator import MangaTranslator


def _filter(regions, source='ENG'):
    self = object.__new__(MangaTranslator)
    config = SimpleNamespace(translator=SimpleNamespace(
        source_lang_only=True, source_lang=source))
    return MangaTranslator._filter_regions_by_source_lang(self, regions, config)


def _region(text):
    return SimpleNamespace(text=text, sfx_rescued=False)


def test_ascii_text_kept_when_source_is_english_despite_misdetection():
    # langdetect calls this Maltese — ASCII text cannot be non-Latin source; keep it.
    r = _region('STARTING WITH THE HEROINE WHO IS CLEAN, WELL-ENDOWED, AND LOVED BY PLAYERS, EVEN SHE...')
    assert _filter([r]) == [r]


def test_short_ascii_name_kept():
    r = _region('SiEg…')                       # detected as Danish live
    assert _filter([r]) == [r]


def test_thai_text_still_dropped_for_english_source():
    r = _region('ข้อความภาษาไทยล้วนยาวพอให้ตรวจจับได้')
    assert _filter([r]) == []
