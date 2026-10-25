"""#1123: batch slots inside one worker (Strata BATCHING.md) - the pure parts: slot count and the shared/exclusive gate."""
import asyncio

from server.worker_slots import SlotGate, slots_from_env


def test_slots_default_to_one():
    assert slots_from_env({}) == 1
    assert slots_from_env({"MIT_WORKER_SLOTS": "abc"}) == 1


def test_slots_need_preload():
    # A first-time model load from two concurrent requests could race, so slots only run on preloaded workers.
    assert slots_from_env({"MIT_WORKER_SLOTS": "3"}) == 1
    assert slots_from_env({"MIT_WORKER_SLOTS": "3", "MIT_PRELOAD": "1"}) == 3
    assert slots_from_env({"MIT_WORKER_SLOTS": "99", "MIT_PRELOAD": "1"}) == 8


def test_shared_holders_run_together_and_exclusive_waits_for_them():
    async def main():
        gate, log = SlotGate(), []

        async def shared(name, hold):
            async with gate.hold(exclusive=False):
                log.append(f"+{name}"); await asyncio.sleep(hold); log.append(f"-{name}")

        async def exclusive(name):
            async with gate.hold(exclusive=True):
                log.append(f"+{name}"); await asyncio.sleep(0.01); log.append(f"-{name}")

        a = asyncio.ensure_future(shared("a", 0.05)); b = asyncio.ensure_future(shared("b", 0.05))
        await asyncio.sleep(0.01)
        x = asyncio.ensure_future(exclusive("x"))
        await asyncio.sleep(0.01)
        c = asyncio.ensure_future(shared("c", 0.01))   # arrives after x: must wait behind it
        await asyncio.gather(a, b, x, c)
        return log
    log = asyncio.run(main())
    assert log[:2] == ["+a", "+b"]
    assert log.index("+x") > log.index("-a") and log.index("+x") > log.index("-b")
    assert log.index("+c") > log.index("-x")
