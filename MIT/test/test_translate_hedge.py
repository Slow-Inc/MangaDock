"""#1119: hedged translation request — after `hedge_after` seconds without an answer, start one identical
call and keep whichever finishes first (Strata-style tail-latency cut). Torch-free, runs in <1s."""
import asyncio

import pytest

from server.translate_hedge import hedge_after_from_env, hedged


def _call_factory(durations, results=None, errors=None):
    """Each start() takes the next duration; returns ('call', n) or raises errors[n]."""
    calls = {'n': 0, 'cancelled': []}

    def start():
        n = calls['n']
        calls['n'] += 1

        async def run():
            try:
                await asyncio.sleep(durations[n])
            except asyncio.CancelledError:
                calls['cancelled'].append(n)
                raise
            if errors and errors.get(n):
                raise errors[n]
            return ('call', n)
        return run()
    return start, calls


def test_no_hedge_when_disabled():
    start, calls = _call_factory([0.05])
    assert asyncio.run(hedged(start, None)) == ('call', 0)
    assert calls['n'] == 1


def test_fast_first_call_never_starts_a_hedge():
    start, calls = _call_factory([0.02, 0.01])
    assert asyncio.run(hedged(start, 0.2)) == ('call', 0)
    assert calls['n'] == 1


def test_slow_first_call_loses_to_the_hedge_and_is_cancelled():
    start, calls = _call_factory([1.0, 0.02])
    assert asyncio.run(hedged(start, 0.05)) == ('call', 1)
    assert calls['n'] == 2 and calls['cancelled'] == [0]


def test_a_failed_call_falls_back_to_the_other():
    start, calls = _call_factory([0.1, 0.02], errors={1: RuntimeError('hedge broke')})
    assert asyncio.run(hedged(start, 0.05)) == ('call', 0)


def test_both_failing_raises():
    start, _ = _call_factory([0.1, 0.02], errors={0: ValueError('a'), 1: RuntimeError('b')})
    with pytest.raises((ValueError, RuntimeError)):
        asyncio.run(hedged(start, 0.05))


@pytest.mark.parametrize('raw,expected', [(None, None), ('', None), ('0', None), ('abc', None), ('-3', None),
                                          ('12', 12.0), ('7.5', 7.5)])
def test_hedge_after_from_env(raw, expected):
    env = {} if raw is None else {'MIT_TRANSLATE_HEDGE_S': raw}
    assert hedge_after_from_env(env) == expected


def test_cancelling_the_caller_cancels_the_in_flight_call():
    start, calls = _call_factory([1.0, 1.0])

    async def main():
        task = asyncio.ensure_future(hedged(start, 0.5))
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        await asyncio.sleep(0.01)
        # Checked inside the loop: asyncio.run would cancel a leaked call at shutdown anyway.
        assert calls['cancelled'] == [0]
    asyncio.run(main())


def test_on_hedge_fires_only_when_the_second_call_starts():
    fired = []
    start, _ = _call_factory([0.01])
    asyncio.run(hedged(start, 0.2, on_hedge=lambda: fired.append(1)))
    assert fired == []
    start, _ = _call_factory([1.0, 0.01])
    asyncio.run(hedged(start, 0.05, on_hedge=lambda: fired.append(1)))
    assert fired == [1]
