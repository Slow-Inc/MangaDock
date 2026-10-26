"""#1144: a page that FAILED is reported as an error, not as an empty page the Backend caches for 7 days.

Live (Haimiya ch. 6 p2, 2026-10-25): the translator echoed the source twice, every region dropped as
"Translation identical to original", translate_patches returned success with 0 patches and the Backend stored
{"patches": []}. Drives the real MangaTranslator._empty_or_failed on a bare context."""
import types

import pytest

from manga_translator.manga_translator import MangaTranslator
from manga_translator.text_layer import PageTranslationFailed
from manga_translator import stage_runner


def _ctx(reasons):
    return types.SimpleNamespace(dropped_regions=[(types.SimpleNamespace(text=f'L{i}', translation=f'L{i}',
                                                                          xyxy=[0, 0, 1, 1]), r)
                                                  for i, r in enumerate(reasons)])


def test_an_echoed_page_raises():
    # its own exception, so the worker can answer 422 and the Backend stops retrying it as "MIT is starting".
    # TWO echoed lines is the live repro (ch. 6 p2 echoed the source twice) - a cut-off of three missed it.
    stage_runner.begin_page()
    with pytest.raises(PageTranslationFailed, match='echoed'):
        MangaTranslator._empty_or_failed(None, _ctx(['Translation identical to original'] * 2), 10, 10)


def test_one_echoed_line_is_a_empty_page_not_a_failure():
    # a page whose only line is a sign or a name may legitimately come back identical; one line is not a failure
    stage_runner.begin_page()
    out = MangaTranslator._empty_or_failed(None, _ctx(['Translation identical to original']), 10, 10)
    assert out['patches'] == []


def test_a_failed_translate_step_raises():
    stage_runner.begin_page()
    with pytest.raises(PageTranslationFailed, match='translating'):
        MangaTranslator._empty_or_failed(None, _ctx([]), 10, 10, ['translating'])


def test_a_page_with_no_text_is_still_an_empty_result():
    stage_runner.begin_page()
    out = MangaTranslator._empty_or_failed(None, _ctx(['speculative box read as junk']), 10, 10)
    assert out['patches'] == [] and out['regions'][0]['drop_reason'] == 'speculative box read as junk'
