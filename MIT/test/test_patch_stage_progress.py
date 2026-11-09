"""#1137: the back stages of the patch path report their progress when each one starts, not all at once.

Live timeline before the fix: `mask-generation`, `inpainting` and `rendering` arrived in the same instant right
after translation (page 4: 11.87 / 11.87 / 11.87 s, result at 12.9 s), so the Reader never showed step 4 and
showed "rendering" while it was still erasing. Drives the real `_finish_patches` on a fake driver; models,
geometry and the patch renderer are stubbed.
"""
import asyncio
import contextlib
import types

import numpy as np
import pytest

import manga_translator.manga_translator as mt
import manga_translator.patch_geometry as patch_geometry
import manga_translator.detection_postproc as detection_postproc
import manga_translator.rendering as rendering


class _Driver:
    def __init__(self, log):
        self.log = log
        self._flux_lock = contextlib.nullcontext()

    def _apply_source_lang_filter(self, ctx, config):
        return list(ctx.text_regions)

    def _tag_regions_with_bubbles(self, ctx, regions, synth_fallback=False):
        pass

    def _group_nearby_regions(self, regions, threshold, w, h):
        return [regions]

    async def _report_progress(self, state, finished=False):
        self.log.append(f'progress:{state}')

    async def _run_mask_refinement(self, config, ctx):
        self.log.append('work:mask')
        return np.zeros((8, 8), np.uint8)

    async def _run_inpainting(self, config, ctx):
        self.log.append('work:inpaint')
        return np.zeros((8, 8, 3), np.uint8)


def _config(full_page):
    return types.SimpleNamespace(
        detector=types.SimpleNamespace(det_bubble_seg=False, det_bubble_synth=False),
        render=types.SimpleNamespace(font_src_scale=1.0),
        inpainter=types.SimpleNamespace(full_page_inpaint=full_page, restrict_fullpage_mask=False,
                                        protect_figures=False, adaptive_dilate=False, mask_tighten=False,
                                        selective_flux=False),
    )


@pytest.fixture
def run(monkeypatch):
    log = []

    class FakeRenderer:
        def __init__(self, *a, **k):
            pass

        async def process_group(self, group):
            log.append('work:render')
            return {'x': 0}

    monkeypatch.setattr(mt, 'PatchRenderer', FakeRenderer)
    monkeypatch.setattr(mt, 'create_text_only_mask', lambda h, w, regions: np.zeros((h, w), np.uint8))
    monkeypatch.setattr(patch_geometry, 'assemble_fullpage_erase_mask', lambda m, t, img, restrict=False: m)
    monkeypatch.setattr(detection_postproc, 'flatten_white_captions', lambda inpainted, img: inpainted)
    monkeypatch.setattr(rendering, 'annotate_page_font', lambda regions, scale: None)
    monkeypatch.setattr(mt, 'regions_payload', lambda regions: [])

    def _go(full_page):
        ctx = types.SimpleNamespace(img_rgb=np.zeros((8, 8, 3), np.uint8), text_regions=['r'],
                                    source_lang_filtered=False, mask=None, dropped_regions=None)
        asyncio.run(mt.MangaTranslator._finish_patches(_Driver(log), ctx, _config(full_page), None))
        return [e for e in log if e != 'progress:finished']
    return _go


def test_full_page_path_reports_each_stage_as_it_starts(run):
    assert run(True) == ['progress:mask-generation', 'work:mask',
                         'progress:inpainting', 'work:inpaint',
                         'progress:rendering', 'work:render']


def test_per_crop_path_reports_the_erase_step_before_the_groups(run):
    # mask, inpaint and render all run inside each group here; the label shows step 4 while they work
    assert run(False) == ['progress:inpainting', 'work:render']
