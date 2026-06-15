"""Unit tests for the `/status/stream` SSE framing + merge loop (PRD #279, ADR 016).

`format_sse` is pure. `status_frames` is the hybrid generator: it pushes each
queued event the instant it arrives (no polling) and emits a fresh metric sample
on every interval tick. Driven with a tiny interval + a bounded `should_continue`
so the test is deterministic and sub-second; no network/ML.
"""
import asyncio
import json

from server.status_stream import format_sse, status_frames


def _data(frame: str) -> dict:
    assert frame.startswith("data: ") and frame.endswith("\n\n")
    return json.loads(frame[len("data: "):].strip())


def test_format_sse_is_one_compact_data_frame():
    frame = format_sse({"type": "metric", "service": "mit"})
    assert frame == 'data: {"type":"metric","service":"mit"}\n\n'


def test_format_sse_preserves_non_ascii():
    # A Thai log line must survive the wire intact (ensure_ascii=False).
    frame = format_sse({"type": "event", "detail": "แปลเสร็จ"})
    assert "แปลเสร็จ" in frame


def test_status_frames_emits_initial_sample_then_pushed_event_then_next_sample():
    async def run():
        queue: asyncio.Queue = asyncio.Queue()
        queue.put_nowait({"type": "event", "service": "mit", "kind": "translate_triggered"})

        calls = {"n": 0}
        def sample():
            calls["n"] += 1
            return [{"type": "metric", "service": "mit", "tick": calls["n"]}]

        # Continue for two loop iterations, then stop.
        gate = {"n": 0}
        def should_continue():
            gate["n"] += 1
            return gate["n"] <= 2

        frames = []
        async for f in status_frames(queue=queue, sample=sample, interval_s=0.01, should_continue=should_continue):
            frames.append(_data(f))
        return frames

    frames = asyncio.run(run())
    # 1) initial sample (tick 1), 2) the queued event pushed immediately,
    # 3) a fresh sample on the interval timeout (tick 2).
    assert frames[0] == {"type": "metric", "service": "mit", "tick": 1}
    assert frames[1] == {"type": "event", "service": "mit", "kind": "translate_triggered"}
    assert frames[2] == {"type": "metric", "service": "mit", "tick": 2}


def test_status_frames_supports_an_async_sample():
    # The real route's sampler is a coroutine (it collects metrics + re-validates
    # the token), so the generator must await an awaitable sample.
    async def run():
        async def sample():
            return [{"type": "metric", "service": "mit", "async": True}]
        frames = []
        async for f in status_frames(queue=asyncio.Queue(), sample=sample, interval_s=0.01, should_continue=lambda: False):
            frames.append(_data(f))
        return frames

    assert asyncio.run(run()) == [{"type": "metric", "service": "mit", "async": True}]


def test_status_frames_stops_when_should_continue_is_false():
    async def run():
        queue: asyncio.Queue = asyncio.Queue()
        frames = []
        async for f in status_frames(queue=queue, sample=lambda: [{"type": "metric"}], interval_s=0.01, should_continue=lambda: False):
            frames.append(_data(f))
        return frames

    frames = asyncio.run(run())
    # Only the initial sample is emitted, then the loop exits at once.
    assert frames == [{"type": "metric"}]
