"""#1144: a page that FAILED is reported as an error, not as an empty page the Backend caches for 7 days.

Live (Haimiya ch. 6 p2, 2026-10-25): the translator echoed the source twice, every region dropped as
"Translation identical to original", translate_patches returned success with 0 patches and the Backend stored
{"patches": []}. Drives the real MangaTranslator._empty_or_failed on a bare context."""
import types

import pytest

from manga_translator.manga_translator import MangaTranslator
from manga_translator import stage_runner


def _ctx(reasons):
    return types.SimpleNamespace(dropped_regions=[(types.SimpleNamespace(text=f'L{i}', translation=f'L{i}',
                                                                          xyxy=[0, 0, 1, 1]), r)
                                                  for i, r in enumerate(reasons)])


def test_an_echoed_page_raises():
    stage_runner.begin_page()
    with pytest.raises(RuntimeError, match='echoed'):
        MangaTranslator._empty_or_failed(None, _ctx(['Translation identical to original'] * 4), 10, 10)


def test_a_failed_translate_step_raises():
    stage_runner.begin_page()
    with pytest.raises(RuntimeError, match='translating'):
        MangaTranslator._empty_or_failed(None, _ctx([]), 10, 10, ['translating'])


def test_a_page_with_no_text_is_still_an_empty_result():
    stage_runner.begin_page()
    out = MangaTranslator._empty_or_failed(None, _ctx(['speculative box read as junk']), 10, 10)
    assert out['patches'] == [] and out['regions'][0]['drop_reason'] == 'speculative box read as junk'
