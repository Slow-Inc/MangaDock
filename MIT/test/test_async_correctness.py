"""Tests for async-correctness fixes (Issue #106).

Covers:
  - stream() terminates on result/error frames and on timeout
  - to_pil_image() uses async HTTP (not blocking requests.get)
  - find_executor() does not hold lock while waiting for a free executor
"""
import asyncio

from unittest.mock import AsyncMock, MagicMock, patch


# ── streaming.py ────────────────────────────────────────────────────────────

def test_stream_terminates_on_result_frame():
    """Stream must stop when it receives a code-0 (result) frame."""
    from server.streaming import stream

    async def run():
        q = asyncio.Queue()
        result_frame = b'\x00' + (3).to_bytes(4, 'big') + b'abc'
        await q.put(result_frame)
        frames = []
        async for frame in stream(q):
            frames.append(frame)
        return frames

    frames = asyncio.run(run())
    assert len(frames) == 1
    assert frames[0][0:1] == b'\x00'


def test_stream_terminates_on_error_frame():
    """Stream must stop when it receives a code-2 (error) frame."""
    from server.streaming import stream

    async def run():
        q = asyncio.Queue()
        error_frame = b'\x02' + (0).to_bytes(4, 'big')
        await q.put(error_frame)
        frames = []
        async for frame in stream(q):
            frames.append(frame)
        return frames

    frames = asyncio.run(run())
    assert len(frames) == 1
    assert frames[0][0:1] == b'\x02'


def test_stream_terminates_on_timeout():
    """Stream must stop with an error frame when no message arrives in time."""
    from server.streaming import stream

    async def run():
        q = asyncio.Queue()  # nothing ever put in
        frames = []
        # Use a tiny timeout so the test runs fast
        async for frame in stream(q, timeout=0.05):
            frames.append(frame)
        return frames

    frames = asyncio.run(run())
    assert len(frames) == 1
    assert frames[0][0:1] == b'\x02'  # error frame on timeout


def test_stream_yields_intermediate_progress_frames():
    """Non-terminal frames (code 3 = queue position) are yielded without stopping."""
    from server.streaming import stream

    async def run():
        q = asyncio.Queue()
        progress = b'\x03' + (1).to_bytes(4, 'big') + b'0'
        result = b'\x00' + (0).to_bytes(4, 'big')
        await q.put(progress)
        await q.put(result)
        frames = []
        async for frame in stream(q):
            frames.append(frame)
        return frames

    frames = asyncio.run(run())
    assert len(frames) == 2


# ── request_extraction.py ────────────────────────────────────────────────────

def test_to_pil_image_url_uses_async_http():
    """to_pil_image uses httpx.AsyncClient (non-blocking) for URL inputs."""
    import io
    import server.request_extraction as re_mod
    from PIL import Image

    fake_img = Image.new("RGB", (2, 2))
    buf = io.BytesIO()
    fake_img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    mock_response = MagicMock()
    mock_response.content = png_bytes
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch('server.request_extraction.httpx') as mock_httpx:
        mock_httpx.AsyncClient.return_value = mock_client

        async def run():
            return await re_mod.to_pil_image("http://example.com/img.png")

        asyncio.run(run())
        assert mock_httpx.AsyncClient.called
        assert mock_client.get.called


# ── instance.py ──────────────────────────────────────────────────────────────

def test_find_executor_marks_instance_busy():
    """find_executor must return a free instance and mark it busy."""
    from server.instance import ExecutorInstance, Executors

    async def run():
        execs = Executors()
        inst = ExecutorInstance(ip='127.0.0.1', port=5004)
        execs.register(inst)
        result = await execs.find_executor()
        return result, inst.busy

    result, busy = asyncio.run(run())
    assert result.port == 5004
    assert busy is True


def test_find_executor_concurrent_callers_do_not_deadlock():
    """Two concurrent find_executor calls with one executor must not deadlock.

    The first acquires and makes it busy; the second must wait until free_executor
    is called. We signal free after a short delay to unblock the second waiter.
    """
    from server.instance import ExecutorInstance, Executors

    async def run():
        execs = Executors()
        inst = ExecutorInstance(ip='127.0.0.1', port=5004)
        execs.register(inst)

        first = await execs.find_executor()
        assert first.busy is True

        # Schedule free after tiny delay
        async def free_later():
            await asyncio.sleep(0.02)
            await execs.free_executor(first)

        asyncio.create_task(free_later())
        second = await asyncio.wait_for(execs.find_executor(), timeout=1.0)
        return second

    result = asyncio.run(run())
    assert result.port == 5004
