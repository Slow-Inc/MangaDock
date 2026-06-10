"""Model lifecycle facade (#187 seam S21 / #188).

`ModelLifecycle` folds the two duplicated eager-preload blocks (`preload`) and the two
idempotent cleanup-task guards (`ensure_running` → `ModelReaper.ensure_started`). The
prepare_* functions are injected so it tests with no ML stack; the async preload is
driven via `asyncio.run`.
"""
import asyncio
from types import SimpleNamespace

from manga_translator.config import Colorizer
from manga_translator.model_lifecycle import ModelLifecycle


def _spy_prepare(calls):
    def make(name):
        async def fn(*args):
            calls.append((name, args))
        return fn
    return {k: make(k) for k in
            ('upscaling', 'detection', 'ocr', 'inpainting', 'translation', 'colorization')}


def _config(upscale_ratio=2, colorizer=Colorizer.mc2):
    return SimpleNamespace(
        upscale=SimpleNamespace(upscale_ratio=upscale_ratio, upscaler='UP'),
        detector=SimpleNamespace(detector='DET'),
        ocr=SimpleNamespace(ocr='OCR'),
        inpainter=SimpleNamespace(inpainter='INP'),
        translator=SimpleNamespace(translator_gen='TG'),
        colorizer=SimpleNamespace(colorizer=colorizer),
    )


def test_preload_skips_everything_when_ttl_nonzero():
    calls = []
    lc = ModelLifecycle(reaper=None, prepare_fns=_spy_prepare(calls))
    asyncio.run(lc.preload(_config(), device='cpu', models_ttl=5))
    assert calls == []  # eager-preload only when models_ttl == 0


def test_preload_full_order_with_upscale_and_colorizer():
    calls = []
    lc = ModelLifecycle(None, _spy_prepare(calls))
    asyncio.run(lc.preload(_config(upscale_ratio=2, colorizer=Colorizer.mc2), 'cuda', 0))
    assert [c[0] for c in calls] == [
        'upscaling', 'detection', 'ocr', 'inpainting', 'translation', 'colorization']
    # device threaded into ocr + inpainting
    assert ('ocr', ('OCR', 'cuda')) in calls
    assert ('inpainting', ('INP', 'cuda')) in calls


def test_preload_skips_upscaling_when_no_ratio_and_colorization_when_none():
    calls = []
    lc = ModelLifecycle(None, _spy_prepare(calls))
    asyncio.run(lc.preload(_config(upscale_ratio=0, colorizer=Colorizer.none), 'cpu', 0))
    assert [c[0] for c in calls] == ['detection', 'ocr', 'inpainting', 'translation']


def test_ensure_running_delegates_to_reaper_ensure_started():
    class FakeReaper:
        def __init__(self):
            self.calls = 0
        def ensure_started(self):
            self.calls += 1
            return 'TASK'
    r = FakeReaper()
    lc = ModelLifecycle(r, {})
    assert lc.ensure_running() == 'TASK'
    assert lc.ensure_running() == 'TASK'
    assert r.calls == 2  # delegates each time; idempotency lives in the reaper
