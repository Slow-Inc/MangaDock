"""#905: cross-page stage pipelining loop — ordering, overlap and cancellation, without the ML stack."""
import asyncio

import pytest

from server.batch_pipeline import run_pipelined


def _run(coro):
    return asyncio.run(coro)


def _scripted(log, delays=None):
    """Build injectable stage functions that record their order in ``log``."""
    delays = delays or {}

    async def prepare_front(page):
        log.append(('front_start', page))
        await asyncio.sleep(delays.get(('front', page), 0))
        log.append(('front_done', page))
        return {'page': page}

    async def translate(front, prev_context):
        log.append(('translate_start', front['page'], prev_context))
        await asyncio.sleep(delays.get(('translate', front['page']), 0))
        log.append(('translate_done', front['page']))
        return {'translation': f"t{front['page']}", 'block': f"b{front['page']}"}

    async def finish_back(page, front, translated):
        log.append(('back_start', page))
        await asyncio.sleep(delays.get(('back', page), 0))
        log.append(('back_done', page))
        return {'page': page, 'text': translated['translation']}

    return prepare_front, translate, finish_back


def test_results_come_out_in_page_order():
    log = []
    prepare, translate, finish = _scripted(log)
    out = _run(run_pipelined([0, 1, 2], prepare_front=prepare, translate=translate, finish_back=finish))
    assert [r['page'] for r in out] == [0, 1, 2]
    assert [r['text'] for r in out] == ['t0', 't1', 't2']


def test_translation_is_strictly_ordered_and_chains_the_context():
    log = []
    prepare, translate, finish = _scripted(log)
    _run(run_pipelined([0, 1, 2], prepare_front=prepare, translate=translate, finish_back=finish))
    context = {entry[1]: entry[2] for entry in log if entry[0] == 'translate_start'}
    assert ('translate_done', 0) in log
    assert context[0] is None
    assert context[1] == 'b0'
    assert context[2] == 'b1'
    starts = [p for k, p, *_ in log if k == 'translate_start']
    assert starts == [0, 1, 2]


def test_the_next_pages_front_stages_start_while_the_current_page_translates():
    """The whole point: GPU front work of page i+1 overlaps the gateway wait of page i."""
    log = []
    # translation is slow, front stages are fast
    prepare, translate, finish = _scripted(log, delays={('translate', 0): 0.05})
    _run(run_pipelined([0, 1], prepare_front=prepare, translate=translate, finish_back=finish))
    front1 = log.index(('front_start', 1))
    translate0_done = log.index(('translate_done', 0))
    assert front1 < translate0_done, log


def test_cancellation_stops_before_the_next_page():
    log = []
    prepare, translate, finish = _scripted(log)
    cancelled = {'after': 2, 'seen': 0}

    def cancel_check():
        cancelled['seen'] += 1
        return cancelled['seen'] > cancelled['after']

    out = _run(run_pipelined([0, 1, 2, 3], prepare_front=prepare, translate=translate,
                             finish_back=finish, cancel_check=cancel_check))
    assert [r['page'] for r in out] == [0, 1]
    # a prefetched front stage may already be in flight; no NEW translation may start
    assert ('translate_start', 2) not in log


def test_a_stage_failure_propagates():
    async def prepare_front(page):
        if page == 1:
            raise RuntimeError('gpu oom')
        return {'page': page}

    async def translate(front, prev_context):
        return {'translation': 'x', 'block': 'b'}

    async def finish_back(page, front, translated):
        return {'page': page}

    with pytest.raises(RuntimeError, match='gpu oom'):
        _run(run_pipelined([0, 1], prepare_front=prepare_front, translate=translate, finish_back=finish_back))
