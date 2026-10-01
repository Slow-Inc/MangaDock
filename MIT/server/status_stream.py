"""`/status/stream` SSE framing + hybrid merge loop (PRD #279, ADR 016 §Decision 3).

Two data natures on one stream (ADR 016): continuous metrics are SAMPLED on an
interval (the loop lives here, at the source — it is moved, not eliminated),
while discrete events are PUSHED the instant a `StatusHub` subscriber queue
receives one. Pure framing + an injectable generator (queue / sample / clock-gate
passed in) so the loop is unit-tested without FastAPI, the real hub, or wall time.
"""
import asyncio
import inspect
import json


def format_sse(message: dict) -> str:
    """Encode one message as a single SSE `data:` frame. `ensure_ascii=False`
    keeps Thai/JP log lines intact on the wire."""
    return f"data: {json.dumps(message, ensure_ascii=False, separators=(',', ':'))}\n\n"


async def _draw(sample):
    """Call the sampler, awaiting it when it is a coroutine (the route's sampler
    collects metrics + re-validates the token; tests pass a plain function)."""
    result = sample()
    return await result if inspect.isawaitable(result) else result


async def status_frames(*, queue: asyncio.Queue, sample, interval_s: float, should_continue):
    """Yield SSE frames until `should_continue()` returns False.

    - On connect: emit the initial `sample()` (host/gpu metric + gateway status).
    - Then each iteration waits up to `interval_s` for the next pushed event:
      an event arrives → forward it immediately (low-latency push); the wait
      times out → emit a fresh `sample()` (the sampled metric tier).

    `should_continue` is the route's gate (token still valid, client still
    connected); calling it once per loop is what makes the stream zero-trust
    (re-validate + close on expiry, ADR 016 §Decision 4).
    """
    for message in await _draw(sample):
        yield format_sse(message)
    while should_continue():
        try:
            event = await asyncio.wait_for(queue.get(), timeout=interval_s)
        except asyncio.TimeoutError:
            for message in await _draw(sample):
                yield format_sse(message)
        else:
            yield format_sse(event)
