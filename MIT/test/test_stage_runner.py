"""Uniform per-stage runner (#187 seam S23).

Every pipeline stage in `MangaTranslator._translate` / `_translate_until_translation`
shares the identical shape: report progress under `name`, await the stage
dispatcher, and on failure either re-raise (`ignore_errors=False`) or fall back to
a default (`ignore_errors=True`) — logging `"Error during {name}"` with the
traceback. This module folds that ~14×-duplicated try/except into one helper.
These cases pin the policy in isolation (no ML stack); the async path is driven
via `asyncio.run`.
"""
import asyncio

import pytest

import manga_translator.stage_runner as sr


def _run(coro):
    return asyncio.run(coro)


class _RecLogger:
    """Captures logger.error(...) messages so the failure path is assertable."""
    def __init__(self):
        self.errors = []

    def error(self, msg):
        self.errors.append(msg)


def _recorder():
    """Returns (seen-list, async report_progress) recording reported names."""
    seen = []

    async def report_progress(name):
        seen.append(name)

    return seen, report_progress


# ---- success: fn result returned, progress reported, fallback untouched -------

def test_success_returns_fn_result_and_reports_progress():
    seen, report = _recorder()
    log = _RecLogger()
    fallback_calls = []

    async def fn():
        return 'DET'

    out = _run(sr.run_stage(
        'detection', fn, lambda: fallback_calls.append(1),
        report_progress=report, ignore_errors=True, logger=log))

    assert out == 'DET'
    assert seen == ['detection']        # progress reported once, with the stage name
    assert fallback_calls == []         # fallback never runs on success
    assert log.errors == []             # nothing logged on success


# ---- failure + ignore_errors=True: returns fallback(), logs the traceback -----

def test_failure_ignored_returns_fallback_and_logs():
    seen, report = _recorder()
    log = _RecLogger()

    async def boom():
        raise RuntimeError('kaboom')

    out = _run(sr.run_stage(
        'ocr', boom, lambda: 'FALLBACK',
        report_progress=report, ignore_errors=True, logger=log))

    assert out == 'FALLBACK'
    assert seen == ['ocr']
    assert len(log.errors) == 1
    assert log.errors[0].startswith('Error during ocr:')   # exact message prefix
    assert 'kaboom' in log.errors[0]                        # traceback captured


# ---- failure + ignore_errors=False: re-raises after logging, no fallback ------

def test_failure_not_ignored_reraises_after_logging():
    seen, report = _recorder()
    log = _RecLogger()
    fallback_calls = []

    async def boom():
        raise ValueError('nope')

    with pytest.raises(ValueError):
        _run(sr.run_stage(
            'translating', boom, lambda: fallback_calls.append(1),
            report_progress=report, ignore_errors=False, logger=log))

    assert seen == ['translating']      # progress still reported before the raise
    assert fallback_calls == []         # fallback never runs when re-raising
    assert len(log.errors) == 1         # error still logged before the re-raise


# ---- ordering: progress is reported BEFORE the stage body runs ----------------

def test_reports_progress_before_running_stage():
    order = []

    async def report(name):
        order.append(f'report:{name}')

    async def fn():
        order.append('fn')
        return 'X'

    out = _run(sr.run_stage(
        'rendering', fn, lambda: None,
        report_progress=report, ignore_errors=True, logger=_RecLogger()))

    assert out == 'X'
    assert order == ['report:rendering', 'fn']


# ---- fallback may be any value, incl. a tuple (detection's 3-field unpack) -----

def test_fallback_value_can_be_a_tuple_for_multi_assign():
    _, report = _recorder()

    async def boom():
        raise Exception('detect failed')

    out = _run(sr.run_stage(
        'detection', boom, lambda: ([], None, None),
        report_progress=report, ignore_errors=True, logger=_RecLogger()))

    assert out == ([], None, None)      # caller does textlines, mask_raw, mask = ...
