"""Per-request page-context reset (Issue #136).

The worker's MangaTranslator is a process-lifetime singleton; the page-context
lists used for context-aware translation must not survive across requests —
they made worker RAM grow with every page ever translated and let pages from
unrelated jobs bleed into prompts (see #140 for the real Session seam).

Constructed via __new__ to avoid the heavy ML constructor; only the context
fields are exercised.
"""
from manga_translator.manga_translator import MangaTranslator


def _bare_translator() -> MangaTranslator:
    # #187 S16 moved the two cross-page lists into TranslationMemory
    from manga_translator.translation_memory import TranslationMemory
    t = MangaTranslator.__new__(MangaTranslator)
    t._translation_memory = TranslationMemory()
    t._translation_memory.all_page_translations = [{"page": "stale"}]
    t._translation_memory.original_page_texts = [{"page": "stale"}]
    return t


def test_reset_page_context_empties_both_lists():
    t = _bare_translator()
    t.reset_page_context()
    assert t._translation_memory.all_page_translations == []
    assert t._translation_memory.original_page_texts == []


def test_translate_patches_resets_context_first():
    """The patch entry point must start every request with a clean context —
    wiring check via source inspection (running the pipeline needs GPU/models)."""
    import inspect
    src = inspect.getsource(MangaTranslator.translate_patches)
    assert "reset_page_context" in src.split("await self._translate_until_translation")[0]
