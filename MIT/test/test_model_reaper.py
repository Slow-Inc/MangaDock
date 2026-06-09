"""Model TTL reaper loop (#187 seam S20 / #188).

`ModelReaper` wraps the usage tracker (S3) + unloader (S4) into the background TTL loop
that was `_detector_cleanup_job`. `reap_once` is the testable single sweep; `_loop` polls
it; `stop()` is **new and opt-in** — by default the task is never cancelled, preserving
the L14 cleanup-task leak verbatim. The `ttl == 0` short-circuit is preserved. Driven via
`asyncio.run` (the repo's pattern — pytest-asyncio is not active here).
"""
import asyncio

from manga_translator.model_reaper import ModelReaper


class _Unloader:
    def __init__(self):
        self.events = []

    async def unload(self, tool, model):
        self.events.append(('unload', tool, model))


class _Tracker:
    def __init__(self, expired_list, sink=None):
        self._expired = expired_list
        self.events = sink if sink is not None else []
        self.recorded = None

    def expired(self, ttl, now):
        self.recorded = (ttl, now)
        return list(self._expired)

    def forget(self, tool, model):
        self.events.append(('forget', tool, model))


def test_reap_once_unloads_then_forgets_each_expired():
    unl = _Unloader()
    trk = _Tracker([('detection', 'd'), ('ocr', 'o')])
    r = ModelReaper(trk, unl, get_ttl=lambda: 30)
    asyncio.run(r.reap_once(now=100))
    assert trk.recorded == (30, 100)  # ttl + now passed through to expired()
    assert unl.events == [('unload', 'detection', 'd'), ('unload', 'ocr', 'o')]
    assert trk.events == [('forget', 'detection', 'd'), ('forget', 'ocr', 'o')]


def test_reap_once_ttl_zero_short_circuits_no_unload():
    unl = _Unloader()
    trk = _Tracker([('detection', 'd')])
    r = ModelReaper(trk, unl, get_ttl=lambda: 0)
    asyncio.run(r.reap_once(now=100))
    assert unl.events == []
    assert trk.events == []
    assert trk.recorded is None  # expired() not even queried when ttl == 0


def test_unload_happens_before_forget_per_model():
    shared = []
    unl = _Unloader()
    unl.events = shared
    trk = _Tracker([('a', '1')], sink=shared)
    r = ModelReaper(trk, unl, lambda: 5)
    asyncio.run(r.reap_once(0))
    assert shared == [('unload', 'a', '1'), ('forget', 'a', '1')]


def test_stop_with_no_task_is_a_noop():
    ModelReaper(None, None, lambda: 0).stop()  # must not raise


def test_ensure_started_is_idempotent():
    async def run():
        r = ModelReaper(_Tracker([]), _Unloader(), lambda: 0)
        t1 = r.ensure_started()
        t2 = r.ensure_started()
        assert t1 is t2  # same task — not restarted on the second call
        r.stop()
        try:
            await t1
        except asyncio.CancelledError:
            pass
    asyncio.run(run())


def test_start_creates_task_and_stop_cancels_it():
    async def run():
        r = ModelReaper(_Tracker([]), _Unloader(), lambda: 0)
        task = r.start()
        assert task is not None
        r.stop()
        try:
            await task
        except asyncio.CancelledError:
            pass
        assert task.cancelled()
    asyncio.run(run())
