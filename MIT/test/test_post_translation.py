"""Post-translation processing (#187 seam S18).

Characterization of `post_translation.apply_post_translation_processing` — the
punctuation + post-dictionary + phase-1 repetition-hallucination retry block
lifted verbatim from `MangaTranslator._apply_post_translation_processing` (the
shared helper the batch and concurrent drivers call). The per-scope page-level
ratio-check + retry loops (single/batch/concurrent) are deliberately NOT folded
in: their min_ratio (0.5 vs 0.3), region thresholds (>=6 vs >10) and
collect/reassign strategies are load-bearing (landmines L6/L8), so they stay as
separate scope code. The async path is driven via `asyncio.run`.
"""
import asyncio
from types import SimpleNamespace

import manga_translator.post_translation as pt


def _region(text, translation):
    return SimpleNamespace(text=text, translation=translation)


def _config(*, enable_check=False, rep_threshold=5):
    return SimpleNamespace(translator=SimpleNamespace(
        enable_post_translation_check=enable_check,
        post_check_repetition_threshold=rep_threshold,
    ))


async def _always_false(text, threshold, silent=False):
    return False


async def _boom(*a, **k):
    raise AssertionError('callback called unexpectedly')


def _run(regions, config, post_dict, **kw):
    return asyncio.run(pt.apply_post_translation_processing(
        regions, config, post_dict, **kw))


# ---- empty / guard ----

def test_empty_regions_returns_empty_list():
    out = _run([], _config(), {}, check_repetition=_always_false, retry_region=_always_false)
    assert out == []


# ---- punctuation + post-dictionary always run (check disabled) ----

def test_punct_and_postdict_applied_then_returns_same_list(monkeypatch):
    calls = []
    monkeypatch.setattr(pt, 'correct_punctuation', lambda src, tr: (calls.append(('punct', src, tr)) or f'P({tr})'))
    monkeypatch.setattr(pt, 'apply_post_dictionary', lambda regions, pd: calls.append(('postdict', len(regions), pd)))
    regions = [_region('hello', 'สวัสดี'), _region('', 'x'), _region('y', '')]

    out = _run(regions, _config(enable_check=False), {'k': 'v'},
               check_repetition=_boom, retry_region=_boom)  # check disabled → never called
    assert out is regions
    # punct only where both text and translation truthy → first region only
    assert ('punct', 'hello', 'สวัสดี') in calls
    assert regions[0].translation == 'P(สวัสดี)'
    assert ('postdict', 3, {'k': 'v'}) in calls
    # punct ran before postdict
    assert calls.index(('punct', 'hello', 'สวัสดี')) < calls.index(('postdict', 3, {'k': 'v'}))


# ---- phase-1 repetition check: collect failures, retry each, use return value ----

def test_repetition_failures_are_retried_and_translation_replaced(monkeypatch):
    monkeypatch.setattr(pt, 'correct_punctuation', lambda src, tr: tr)
    monkeypatch.setattr(pt, 'apply_post_dictionary', lambda regions, pd: None)
    regions = [_region('a', 'repeatrepeat'), _region('b', 'good'), _region('c', '   ')]

    checked = []
    async def check(text, threshold, silent=False):
        checked.append((text, threshold, silent))
        return text == 'repeatrepeat'  # only region a fails

    retried = []
    async def retry(region, config):
        retried.append(region.text)
        return 'FIXED'

    _run(regions, _config(enable_check=True, rep_threshold=7),
         {}, check_repetition=check, retry_region=retry)

    # blank-translation region c is skipped by the `.strip()` guard
    assert checked == [('repeatrepeat', 7, False), ('good', 7, False)]
    assert retried == ['a']               # only the failed region retried
    assert regions[0].translation == 'FIXED'   # return value applied
    assert regions[1].translation == 'good'    # untouched


def test_retry_falsy_return_keeps_original_and_exception_is_swallowed(monkeypatch):
    monkeypatch.setattr(pt, 'correct_punctuation', lambda src, tr: tr)
    monkeypatch.setattr(pt, 'apply_post_dictionary', lambda regions, pd: None)
    regions = [_region('a', 'bad1'), _region('b', 'bad2')]

    async def check(text, threshold, silent=False):
        return True  # both fail

    async def retry(region, config):
        if region.text == 'a':
            return ''            # falsy → keep original
        raise RuntimeError('boom')  # must be swallowed, not propagated

    # must not raise
    _run(regions, _config(enable_check=True), {},
         check_repetition=check, retry_region=retry)
    assert regions[0].translation == 'bad1'   # falsy return → unchanged
    assert regions[1].translation == 'bad2'   # exception swallowed → unchanged
