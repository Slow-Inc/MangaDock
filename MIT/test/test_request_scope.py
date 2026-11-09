"""#1123: per-request translator instances and progress hooks, so concurrent pages in one worker never share state."""
import asyncio

from manga_translator.dispatch_registry import DispatchRegistry
from manga_translator.request_scope import request_hooks, request_scope


class _Tr:
    made = 0

    def __init__(self):
        _Tr.made += 1
        self.closed = False

    async def aclose_clients(self):
        self.closed = True


def _registry():
    return DispatchRegistry({"api": _Tr, "offline": _Tr}, "translator", scoped=lambda key: key == "api")


def test_outside_a_scope_the_cached_instance_is_shared():
    reg = _registry()
    assert reg.get("api") is reg.get("api")


def test_inside_a_scope_each_request_gets_its_own_instance_and_reuses_it():
    reg = _registry()
    shared = reg.get("api")

    async def one():
        async with request_scope():
            a, b = reg.get("api"), reg.get("api")
            assert a is b and a is not shared
            return a

    async def main():
        return await asyncio.gather(one(), one())
    x, y = asyncio.run(main())
    assert x is not y and x.closed and y.closed


def test_unscoped_keys_stay_shared_inside_a_scope():
    reg = _registry()
    shared = reg.get("offline")

    async def main():
        async with request_scope():
            return reg.get("offline")
    assert asyncio.run(main()) is shared


def test_request_hooks_are_seen_only_by_their_own_request():
    seen = {"a": [], "b": []}

    async def report(state):
        for hook in request_hooks():
            await hook(state)

    async def one(name):
        async def hook(state):
            seen[name].append(state)
        async with request_scope(hooks=[hook]):
            await asyncio.sleep(0)
            await report(f"{name}-ocr")

    async def main():
        await asyncio.gather(one("a"), one("b"))
        await report("outside")
    asyncio.run(main())
    assert seen == {"a": ["a-ocr"], "b": ["b-ocr"]}


def test_a_per_request_openai_style_client_is_closed():
    class _Client:
        closed = False

        async def close(self):
            _Client.closed = True

    class _Api:
        def __init__(self):
            self.client = _Client()

    reg = DispatchRegistry({"api": _Api}, "translator", scoped=lambda key: True)

    async def main():
        async with request_scope():
            reg.get("api")
    asyncio.run(main())
    assert _Client.closed


def test_front_stages_run_one_page_at_a_time_in_arrival_order():
    # #1123 convoy: without this, 5 pages round-robin through detection/OCR and all reach the LLM together.
    from manga_translator.request_scope import front_stage_lock
    log = []
    lock = asyncio.Lock()

    async def page(name):
        async with request_scope(stage_lock=lock):
            async with front_stage_lock():
                log.append(f"+{name}"); await asyncio.sleep(0.01); log.append(f"-{name}")

    async def main():
        await asyncio.gather(page("a"), page("b"), page("c"))
    asyncio.run(main())
    assert log == ["+a", "-a", "+b", "-b", "+c", "-c"]


def test_front_stage_lock_is_a_no_op_outside_a_slot_scope():
    from manga_translator.request_scope import front_stage_lock

    async def main():
        async with front_stage_lock():
            return True
    assert asyncio.run(main())
