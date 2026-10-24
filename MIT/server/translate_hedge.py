"""Hedged translation request (#1119), pure asyncio and torch-free.

Translation is output-token bound and its latency has a long tail: one generation that runs to
2815 tokens turns a 19 s page into 91 s. The gateway serves 8 concurrent calls as fast as one, so
the cheap cut is a hedge: when a call has not answered after ``hedge_after`` seconds, start one
identical call and keep whichever finishes first. Same prompt and the same guards downstream, so
the output distribution does not change.

Opt-in: ``MIT_TRANSLATE_HEDGE_S=<seconds>``; unset, empty, zero or invalid means no hedge.
"""
import asyncio
import os

ENV_HEDGE = 'MIT_TRANSLATE_HEDGE_S'


def hedge_after_from_env(env=None):
    """Seconds before the hedge starts, or None when hedging is off."""
    env = env if env is not None else os.environ
    try:
        value = float(str(env.get(ENV_HEDGE, '')).strip())
    except ValueError:
        return None
    return value if value > 0 else None


async def hedged(start, hedge_after, on_hedge=None):
    """Await ``start()``; after ``hedge_after`` s without an answer, race it against one more ``start()``.

    ``start`` returns a fresh coroutine per call. The loser is cancelled. A call that fails while
    the other is still running is ignored; when both fail, the first failure is raised.
    ``on_hedge()`` is called when the second call starts (logging).
    """
    first = asyncio.ensure_future(start())
    if hedge_after is None:
        return await first
    tasks = [first]
    try:
        done, _ = await asyncio.wait(tasks, timeout=hedge_after)
        if done:
            return first.result()
        if on_hedge is not None:
            on_hedge()
        tasks.append(asyncio.ensure_future(start()))
        pending, errors = set(tasks), []
        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                if task.exception() is None:
                    return task.result()
                errors.append(task.exception())
        raise errors[0]
    finally:
        # The loser, or both calls when the caller (e.g. the translator's timeout) cancels us.
        for task in tasks:
            if not task.done():
                task.cancel()
