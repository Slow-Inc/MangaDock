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


# ============================================================================
# concurrent_page_lang_check_retry — single-context, min_ratio 0.3, threshold 6,
# filter-empty + text_idx reassign (the divergence vs the single driver's
# pad-with-empty + enumerate). L6/L8 pinned as params.
# ============================================================================

def _ccfg(*, enable_check=True, target='THA', max_retry=2):
    return SimpleNamespace(translator=SimpleNamespace(
        enable_post_translation_check=enable_check,
        target_lang=target,
        post_check_max_retry_attempts=max_retry,
    ))


def _run_concurrent(regions, config, ctx, *, min_regions, min_ratio, check_ratio, batch_translate):
    return asyncio.run(pt.concurrent_page_lang_check_retry(
        regions, config, ctx, min_regions=min_regions, min_ratio=min_ratio,
        check_ratio=check_ratio, batch_translate=batch_translate))


def test_concurrent_noop_when_check_disabled_or_below_threshold():
    regions = [_region(f'r{i}', f't{i}') for i in range(6)]
    async def check_ratio(*a, **k):
        raise AssertionError('check_ratio called while disabled/below-threshold')
    # disabled
    _run_concurrent(regions, _ccfg(enable_check=False), object(),
                    min_regions=6, min_ratio=0.3, check_ratio=check_ratio, batch_translate=_boom)
    # below threshold (5 < 6)
    _run_concurrent(regions[:5], _ccfg(enable_check=True), object(),
                    min_regions=6, min_ratio=0.3, check_ratio=check_ratio, batch_translate=_boom)


def test_concurrent_pass_first_time_no_retry():
    regions = [_region(f'r{i}', f't{i}') for i in range(6)]
    seen = []
    async def check_ratio(rs, target, min_ratio):
        seen.append((target, min_ratio))
        return True
    _run_concurrent(regions, _ccfg(), object(),
                    min_regions=6, min_ratio=0.3, check_ratio=check_ratio, batch_translate=_boom)
    assert seen == [('THA', 0.3)]   # checked once with 0.3, never retried


def test_concurrent_retry_filters_empty_and_reassigns_by_text_idx():
    # mix of empty-text regions; the filter+text_idx path must only consume one
    # new translation per non-empty region, in order, skipping the empty one.
    regions = [_region('a', 'old_a'), _region('', 'keep_empty'), _region('c', 'old_c'),
               _region('d', 'old_d'), _region('e', 'old_e'), _region('f', 'old_f')]
    results = iter([False, True])   # fail, then pass after one retry
    async def check_ratio(rs, target, min_ratio):
        return next(results)
    captured = {}
    async def batch_translate(texts, config, ctx):
        captured['texts'] = list(texts)
        return [t.upper() for t in texts]
    _run_concurrent(regions, _ccfg(max_retry=3), object(),
                    min_regions=6, min_ratio=0.3, check_ratio=check_ratio, batch_translate=batch_translate)
    # empty region filtered out of the re-translate request
    assert captured['texts'] == ['a', 'c', 'd', 'e', 'f']
    assert regions[0].translation == 'A'         # reassigned
    assert regions[1].translation == 'keep_empty'  # empty region untouched
    assert regions[2].translation == 'C'


# ============================================================================
# single_page_lang_check_retry — single driver, min_ratio 0.5, threshold 6,
# pad-with-empty + enumerate reassign (the divergence vs concurrent), plus the
# skip-log and unified success/failure message the concurrent path lacks.
# ============================================================================

def _run_single(regions, config, ctx, *, min_regions, min_ratio, check_ratio, batch_translate):
    return asyncio.run(pt.single_page_lang_check_retry(
        regions, config, ctx, min_regions=min_regions, min_ratio=min_ratio,
        check_ratio=check_ratio, batch_translate=batch_translate))


def test_single_noop_when_check_disabled():
    async def check_ratio(*a, **k):
        raise AssertionError('check_ratio called while disabled')
    _run_single([_region('a', 'b')], _ccfg(enable_check=False), object(),
                min_regions=6, min_ratio=0.5, check_ratio=check_ratio, batch_translate=_boom)


def test_single_below_threshold_skips_check_but_reports_success(caplog):
    import logging
    regions = [_region(f'r{i}', f't{i}') for i in range(5)]  # 5 < 6
    async def check_ratio(*a, **k):
        raise AssertionError('check_ratio must not run below threshold')
    with caplog.at_level(logging.INFO, logger='manga_translator'):
        _run_single(regions, _ccfg(), object(),
                    min_regions=6, min_ratio=0.5, check_ratio=check_ratio, batch_translate=_boom)
    msgs = [r.message for r in caplog.records]
    assert any('Skipping page-level target language check: only 5 regions' in m for m in msgs)
    assert 'All translation regions passed post-translation check.' in msgs


def test_single_retry_pads_empty_and_reassigns_by_enumerate():
    # pad-with-empty: empty-text region contributes "" to the request and its
    # enumerate index still lines up; reassign skips falsy new translations.
    regions = [_region('a', 'old_a'), _region('', 'keep'), _region('c', 'old_c'),
               _region('d', 'old_d'), _region('e', 'old_e'), _region('f', 'old_f')]
    results = iter([False, True])
    async def check_ratio(rs, target, min_ratio):
        assert min_ratio == 0.5
        return next(results)
    captured = {}
    async def batch_translate(texts, config, ctx):
        captured['texts'] = list(texts)
        # index 1 (the padded "") returns falsy → must be skipped on reassign
        return ['A', '', 'C', 'D', 'E', 'F']
    _run_single(regions, _ccfg(max_retry=3), object(),
                min_regions=6, min_ratio=0.5, check_ratio=check_ratio, batch_translate=batch_translate)
    assert captured['texts'] == ['a', '', 'c', 'd', 'e', 'f']  # padded, index-aligned
    assert regions[0].translation == 'A'
    assert regions[1].translation == 'keep'   # falsy new[1] → original kept
    assert regions[2].translation == 'C'
