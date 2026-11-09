"""#905: translate_batch_pipelined runs each page through the same three phases, in order."""
import asyncio
from types import SimpleNamespace

import numpy as np

from manga_translator.config import Config
from manga_translator.manga_translator import MangaTranslator


def _translator():
    mt = MangaTranslator.__new__(MangaTranslator)
    mt.ignore_errors = True
    calls = []

    async def _report_progress(*a, **k):
        pass

    def reset_page_context():
        calls.append(("reset", None))

    async def _translate_until_translation(image, cfg):
        calls.append(("front", image.name))
        return SimpleNamespace(img_rgb=np.zeros((8, 8, 3), np.uint8),
                               text_regions=[SimpleNamespace(translation="")], dropped_regions=None)

    async def _run_text_translation(cfg, ctx):
        calls.append(("translate", cfg.translator.prev_context))
        ctx.text_regions = [SimpleNamespace(translation="t")]
        return ctx.text_regions

    async def _finish_patches(ctx, cfg, icc):
        calls.append(("back", icc))
        return {"patches": [], "img_width": 8, "img_height": 8}

    mt.reset_page_context = reset_page_context
    mt._report_progress = _report_progress
    mt._translate_until_translation = _translate_until_translation
    mt._run_text_translation = _run_text_translation
    mt._finish_patches = _finish_patches
    return mt, calls


def test_pipelined_batch_runs_each_page_through_the_three_phases():
    mt, calls = _translator()
    images = [SimpleNamespace(info={"icc_profile": f"icc{i}"}, name=f"p{i}") for i in range(3)]
    out = asyncio.run(mt.translate_batch_pipelined(images, Config()))
    assert len(out) == 3
    assert [c for c in calls if c[0] == "front"] == [("front", "p0"), ("front", "p1"), ("front", "p2")]
    assert [c for c in calls if c[0] == "back"] == [("back", "icc0"), ("back", "icc1"), ("back", "icc2")]
    translates = [c for c in calls if c[0] == "translate"]
    assert len(translates) == 3
    assert calls[0] == ("reset", None)


def test_a_page_with_no_regions_skips_translation_and_returns_an_empty_patch_result():
    mt, calls = _translator()

    async def _empty_front(image, cfg):
        return SimpleNamespace(img_rgb=np.zeros((8, 8, 3), np.uint8), text_regions=[], dropped_regions=None)

    mt._translate_until_translation = _empty_front
    images = [SimpleNamespace(info={}, name="p0")]
    out = asyncio.run(mt.translate_batch_pipelined(images, Config()))
    assert out and out[0].get("patches") == []
    assert not [c for c in calls if c[0] == "translate"]


def test_the_batch_pipeline_enforces_the_name_glossary_on_later_pages_980(monkeypatch):
    """Page 1 spells TSUKUYOMI as สึกุโยมิ; page 2 drifts to ทสึคิโยมิ and must be corrected to the page-1 spelling."""
    import os
    monkeypatch.setenv('MIT_NAME_GLOSSARY', '1')
    mt = MangaTranslator.__new__(MangaTranslator)
    mt.ignore_errors = True
    calls = {'translate': 0}

    async def _report_progress(*a, **k):
        pass

    def reset_page_context():
        pass

    class _Region:
        def __init__(self, text, translation):
            self.text, self.translation = text, translation

    async def _translate_until_translation(image, cfg):
        # a character name recurs in a chapter; the glossary only pins names seen at least twice
        return SimpleNamespace(img_rgb=np.zeros((8, 8, 3), np.uint8),
                               text_regions=[_Region('TSUKUYOMI!', ''), _Region('TSUKUYOMI, WAIT!', '')],
                               dropped_regions=None)

    async def _run_text_translation(cfg, ctx):
        calls['translate'] += 1
        spelling = 'สึกุโยมิ!' if calls['translate'] == 1 else 'ทสึคิโยมิ!'
        ctx.text_regions = [_Region('TSUKUYOMI!', spelling), _Region('TSUKUYOMI, WAIT!', spelling)]
        return ctx.text_regions

    captured = {}

    async def _finish_patches(ctx, cfg, icc):
        captured.setdefault('spellings', []).append(ctx.text_regions[0].translation)
        captured.setdefault('second', []).append(ctx.text_regions[1].translation)
        return {"patches": [], "img_width": 8, "img_height": 8}

    mt.reset_page_context = reset_page_context
    mt._report_progress = _report_progress
    mt._translate_until_translation = _translate_until_translation
    mt._run_text_translation = _run_text_translation
    mt._finish_patches = _finish_patches
    images = [SimpleNamespace(info={}, name='p0'), SimpleNamespace(info={}, name='p1')]
    asyncio.run(mt.translate_batch_pipelined(images, Config()))
    # page 1 keeps its own spelling; page 2 is corrected to the glossary
    assert captured['spellings'][0] == 'สึกุโยมิ!'
    assert captured['spellings'][1] == 'สึกุโยมิ!'
    assert os.environ['MIT_NAME_GLOSSARY'] == '1'
