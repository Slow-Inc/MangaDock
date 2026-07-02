"""Model-unload routing (#187 seam S4 / #188).

`ModelUnloader` replaces the `match tool:` block in `MangaTranslator._unload_model`
with an injected `{tool: async unload_fn}` table + an `empty_cache` hook. The routing
table is keyed by the **unload-side** names (`'colorization'`, `'detection'`, …), so an
unknown key — including the L1-drifted `'colorizer'` / `'textline_merge'` / `'rendering'`
that `ModelUsageTracker` (S3) stamps — matches nothing and only triggers `empty_cache`,
exactly as the original `match/case` did. Routes are injected so this tests with no ML
stack; the async method is driven via `asyncio.run` (the repo's pattern — pytest-asyncio
is not active here).
"""
import asyncio

from manga_translator.model_unloader import ModelUnloader
from manga_translator.vram_tracker import VramTracker


def _spy():
    """Return (calls list, make_unload factory, empty_cache spy)."""
    calls = []

    def make_unload(name):
        async def _unload(model):
            calls.append((name, model))
        return _unload

    def empty_cache():
        calls.append('empty_cache')

    return calls, make_unload, empty_cache


def test_known_tool_routes_to_its_fn_then_empties_cache():
    calls, make_unload, empty_cache = _spy()
    unloader = ModelUnloader(
        {'detection': make_unload('detection')},
        empty_cache=empty_cache,
        cuda_available=lambda: True,
    )
    asyncio.run(unloader.unload('detection', 'mymodel'))
    assert calls == [('detection', 'mymodel'), 'empty_cache']


def test_L1_drifted_colorizer_key_unloads_nothing_only_empties_cache():
    # the tracker stamps 'colorizer' but the table is keyed 'colorization' → no match.
    # 'textline_merge'/'rendering' likewise have no route. Preserve verbatim: no unload,
    # but empty_cache still fires (mirrors the match/case falling through).
    calls, make_unload, empty_cache = _spy()
    routes = {'colorization': make_unload('colorization')}
    unloader = ModelUnloader(routes, empty_cache=empty_cache, cuda_available=lambda: True)
    for drifted in ('colorizer', 'textline_merge', 'rendering'):
        asyncio.run(unloader.unload(drifted, 'm'))
    assert calls == ['empty_cache', 'empty_cache', 'empty_cache']  # 3× cache, 0 unloads


def test_no_empty_cache_when_cuda_unavailable():
    calls, make_unload, empty_cache = _spy()
    unloader = ModelUnloader(
        {'detection': make_unload('detection')},
        empty_cache=empty_cache,
        cuda_available=lambda: False,
    )
    asyncio.run(unloader.unload('detection', 'm'))
    assert calls == [('detection', 'm')]  # unloaded, but no empty_cache


def test_unload_measures_freed_vram_and_feeds_the_tracker():
    # A clean unload (allocated drops 1100→20) frees the footprint; first one, no leak.
    calls, make_unload, empty_cache = _spy()
    tracker = VramTracker()
    reads = iter([1100, 20])  # before unload, after unload
    unloader = ModelUnloader(
        {'detection': make_unload('detection')},
        empty_cache=empty_cache, cuda_available=lambda: True,
        read_vram=lambda: next(reads), vram_tracker=tracker,
    )
    asyncio.run(unloader.unload('detection', 'mymodel'))
    m = tracker.models()[0]
    assert m['freed_mb'] == 1080 and m['footprint_mb'] == 1080 and m['leaked'] is False


def test_a_later_unload_that_frees_almost_nothing_flags_a_leak_via_the_tracker():
    calls, make_unload, empty_cache = _spy()
    tracker = VramTracker()
    reads = iter([2400, 0,   2400, 2390])  # 1st cycle frees 2400 (footprint); 2nd frees 10 → leak
    unloader = ModelUnloader(
        {'ocr': make_unload('ocr')},
        empty_cache=empty_cache, cuda_available=lambda: True,
        read_vram=lambda: next(reads), vram_tracker=tracker,
    )
    asyncio.run(unloader.unload('ocr', 'mocr'))  # learns footprint 2400
    asyncio.run(unloader.unload('ocr', 'mocr'))  # frees only 10 → leak
    assert tracker.models()[0]['leaked'] is True


def test_each_tool_routes_to_its_own_fn():
    calls, make_unload, empty_cache = _spy()
    routes = {name: make_unload(name) for name in
              ('colorization', 'detection', 'inpainting', 'ocr', 'upscaling', 'translation')}
    unloader = ModelUnloader(routes, empty_cache=empty_cache, cuda_available=lambda: False)
    for name in ('ocr', 'translation', 'upscaling'):
        asyncio.run(unloader.unload(name, f'{name}-model'))
    assert calls == [('ocr', 'ocr-model'), ('translation', 'translation-model'),
                     ('upscaling', 'upscaling-model')]
