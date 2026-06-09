"""Concurrent gather + per-exception placeholder (#187 seam S19).

`gather_per_context` runs the concurrent translate tasks with
`return_exceptions=True`; for each that raised it re-raises unless `ignore_errors`, else
substitutes a keep-original placeholder (`apply_original_as_translation` on that ctx's
regions), index-aligned with `contexts_with_configs`. Driven via `asyncio.run` (the
repo's pattern — pytest-asyncio is not active here).
"""
import asyncio
from types import SimpleNamespace

from manga_translator.gather_per_context import gather_per_context


def _cfg():
    return SimpleNamespace(
        translator=SimpleNamespace(target_lang='TH'),
        render=SimpleNamespace(alignment='auto', direction='auto'),
    )


async def _ok(val):
    return val


async def _boom():
    raise ValueError("boom")


def test_all_succeed_returns_results_in_order():
    tasks = [_ok(('A', 'cfgA')), _ok(('B', 'cfgB'))]
    out = asyncio.run(gather_per_context(tasks, [None, None], ignore_errors=False))
    assert out == [('A', 'cfgA'), ('B', 'cfgB')]


def test_exception_with_ignore_errors_substitutes_placeholder_index_aligned():
    region = SimpleNamespace(text='orig', translation=None)
    ctx = SimpleNamespace(text_regions=[region])
    cfg = _cfg()
    tasks = [_boom(), _ok(('B', 'cfgB'))]
    contexts = [(ctx, cfg), ('unused', 'unused')]
    out = asyncio.run(gather_per_context(tasks, contexts, ignore_errors=True))
    assert out[0] == (ctx, cfg)          # placeholder (ctx, config) at the failed index
    assert region.translation == 'orig'  # apply_original_as_translation ran on its regions
    assert out[1] == ('B', 'cfgB')       # the successful result stays index-aligned


def test_exception_without_ignore_errors_reraises_the_original():
    ctx = SimpleNamespace(text_regions=[])
    tasks = [_boom()]
    try:
        asyncio.run(gather_per_context(tasks, [(ctx, _cfg())], ignore_errors=False))
        assert False, "expected the original exception to propagate"
    except ValueError as e:
        assert str(e) == "boom"


def test_placeholder_skips_apply_when_no_text_regions():
    ctx = SimpleNamespace(text_regions=[])  # falsy -> apply skipped, still placeholdered
    cfg = _cfg()
    out = asyncio.run(gather_per_context([_boom()], [(ctx, cfg)], ignore_errors=True))
    assert out == [(ctx, cfg)]
