"""Regression test for the _timed_stage decorator's introspection (#499).

The standing per-stage timing decorator (`_timed_stage`, added in PR #496)
wraps ~9 `MangaTranslator._run_*` methods. Without `functools.wraps`, the
wrapped methods report `__name__ == 'wrapper'`, breaking tracebacks and any
name-based introspection. This locks the decorator to preserve the original
method identity.
"""
from manga_translator.manga_translator import MangaTranslator


def test_timed_stage_preserves_method_name():
    # The wrapped stage methods must report their own name, not 'wrapper'.
    assert MangaTranslator._run_detection.__name__ == '_run_detection'
    assert MangaTranslator._run_text_rendering.__name__ == '_run_text_rendering'
    assert MangaTranslator._run_text_translation.__name__ == '_run_text_translation'
