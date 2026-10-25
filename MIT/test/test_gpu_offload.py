"""#1123: model forwards off the event loop in worker-slot mode, one at a time (process-wide GPU lock)."""
import asyncio
import threading
import time

import manga_translator.gpu_offload as gpu_offload


def _blocking_forward(log, name):
    async def _infer():
        log.append(("start", name, threading.get_ident(), time.perf_counter()))
        time.sleep(0.05)          # synchronous torch/cv2 work inside an async _infer
        log.append(("end", name, threading.get_ident(), time.perf_counter()))
        return name
    return _infer


def test_disabled_runs_inline_on_the_loop_thread():
    gpu_offload.set_enabled(False)
    log = []

    async def main():
        return await gpu_offload.run(_blocking_forward(log, "a")), threading.get_ident()
    result, loop_thread = asyncio.run(main())
    assert result == "a" and log[0][2] == loop_thread


def test_enabled_frees_the_loop_and_serialises_forwards():
    gpu_offload.set_enabled(True)
    log, ticks = [], []
    try:
        async def ticker():
            for _ in range(8):
                ticks.append(time.perf_counter()); await asyncio.sleep(0.01)

        async def main():
            loop_thread = threading.get_ident()
            t = asyncio.ensure_future(ticker())
            res = await asyncio.gather(gpu_offload.run(_blocking_forward(log, "a")),
                                       gpu_offload.run(_blocking_forward(log, "b")))
            await t
            return res, loop_thread
        res, loop_thread = asyncio.run(main())
    finally:
        gpu_offload.set_enabled(False)
    assert sorted(res) == ["a", "b"]
    assert all(entry[2] != loop_thread for entry in log)          # off the loop
    starts = sorted(e[3] for e in log if e[0] == "start"); ends = sorted(e[3] for e in log if e[0] == "end")
    assert starts[1] >= ends[0]                                    # one forward at a time
    assert len(ticks) == 8 and ticks[3] < ends[-1]                 # the loop kept running meanwhile
