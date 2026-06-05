import asyncio
import pickle

# Default timeout for the streaming consumer (seconds). A worker that dies or
# stalls without emitting a terminal frame would otherwise hang the response
# indefinitely (Issue #106).
_STREAM_TIMEOUT = float(300)


async def stream(messages, timeout: float = _STREAM_TIMEOUT):
    while True:
        try:
            message = await asyncio.wait_for(messages.get(), timeout=timeout)
        except asyncio.TimeoutError:
            # Worker stalled — emit an error frame so the client gets a clean close.
            yield b'\x02' + (0).to_bytes(4, 'big')
            break
        yield message
        if message[0] == 0 or message[0] == 2:
            break

def notify(code: int, data: bytes, transform_to_bytes, messages: asyncio.Queue):
    if code == 0:
        result_bytes = transform_to_bytes(pickle.loads(data))
        encoded_result = b'\x00' + len(result_bytes).to_bytes(4, 'big') + result_bytes
        messages.put_nowait(encoded_result)
    else:
        encoded_result =code.to_bytes(1, 'big') + len(data).to_bytes(4, 'big') + data
        messages.put_nowait(encoded_result)