"""#1123: batch slots inside one worker (Strata BATCHING.md) - the pure parts: slot count and the shared/exclusive gate."""
import asyncio

from server.worker_slots import SlotGate, effective_slots, page_runs_alone, slots_from_env


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


def test_rolling_page_context_forces_one_slot():
    # translate() shares the worker's translation memory when context_size > 0 (#136 class) - no slots then.
    from server.worker_slots import effective_slots
    env = {"MIT_WORKER_SLOTS": "4", "MIT_PRELOAD": "1"}
    assert effective_slots(env, context_size=0) == 4
    assert effective_slots(env, context_size=2) == 1


def test_a_cancelled_exclusive_waiter_does_not_block_later_pages():
    """Scrutinize #1128: the waiting-exclusive count leaked when the waiter was cancelled (a client disconnecting from
    /execute/translate while pages were in flight), and every later shared hold() then waited forever."""
    async def main():
        gate = SlotGate()
        release = asyncio.Event()

        async def page():
            async with gate.hold(exclusive=False):
                await release.wait()

        p = asyncio.ensure_future(page()); await asyncio.sleep(0)
        waiter = asyncio.ensure_future(gate.hold(exclusive=True).__aenter__()); await asyncio.sleep(0.01)
        waiter.cancel()
        try:
            await waiter
        except asyncio.CancelledError:
            pass
        release.set(); await p

        async def later():
            async with gate.hold(exclusive=False):
                return "ran"
        return await asyncio.wait_for(later(), 1)

    assert asyncio.run(main()) == "ran"


def test_a_worker_that_reaps_idle_models_keeps_one_slot():
    """Scrutinize #1128: with models_ttl > 0 the reaper can unload a model while an offloaded forward waits on it."""
    env = {"MIT_WORKER_SLOTS": "5", "MIT_PRELOAD": "1"}
    assert effective_slots(env, 0, models_ttl=0) == 5
    assert effective_slots(env, 0, models_ttl=60) == 1


def test_offline_translators_and_selective_flux_run_alone():
    """Scrutinize #1128: an offline translator is one shared instance with a GPU forward on the loop; selective-Flux
    unloads shared models. Both take the whole worker."""
    from types import SimpleNamespace as NS
    cfg = lambda tr, flux=False: NS(translator=NS(translator=tr), inpainter=NS(selective_flux=flux))
    offline = {"m2m100", "sugoi"}
    assert page_runs_alone(cfg("custom_openai"), offline) is False
    assert page_runs_alone(cfg("sugoi"), offline) is True
    assert page_runs_alone(cfg("custom_openai", flux=True), offline) is True
