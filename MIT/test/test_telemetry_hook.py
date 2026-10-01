"""Unit tests for server.webhook.make_telemetry_hook — the worker-side hook that times
each pipeline stage (gap between consecutive stage starts) and reports it to the parent's
/internal/telemetry for the Dev console. Import-light (httpx only), runs in <1s."""

import asyncio

from server import webhook


def _capture(monkeypatch):
    calls = []

    async def fake_send(url, nonce, payload):
        calls.append((url, nonce, payload))

    monkeypatch.setattr(webhook, "send_telemetry", fake_send)
    return calls


def test_no_parent_url_is_a_noop(monkeypatch):
    calls = _capture(monkeypatch)
    hook = webhook.make_telemetry_hook("", "n")
    asyncio.run(hook("translating"))
    asyncio.run(hook("finished", finished=True))
    assert calls == []


def test_times_each_stage_by_the_gap_to_the_next_stage(monkeypatch):
    calls = _capture(monkeypatch)
    # One clock read per hook call (the real patch-path sequence + the 'finished' sentinel).
    ticks = iter([0.0, 3.0, 3.1, 3.2, 4.8, 5.0])
    hook = webhook.make_telemetry_hook("http://127.0.0.1:5003/", "secret", clock=lambda: next(ticks))

    async def run():
        await hook("translating")        # t=0.0 — start translate
        await hook("after-translating")  # t=3.0 — bookkeeping (ignored)
        await hook("mask-generation")    # t=3.1 — not a canonical stage (ignored)
        await hook("inpainting")         # t=3.2 — flush translate (3200ms), start inpaint
        await hook("rendering")          # t=4.8 — flush inpaint (1600ms), start render
        await hook("finished", finished=True)  # t=5.0 — flush render (200ms)

    asyncio.run(run())

    # parent_url + nonce forwarded to send_telemetry (which builds the /internal/telemetry
    # path itself); durations are the start-to-start gaps.
    assert all(c[0] == "http://127.0.0.1:5003/" and c[1] == "secret" for c in calls)
    stages = [(c[2]["stage"], round(c[2]["ms"])) for c in calls]
    assert stages == [("translate", 3200), ("inpaint", 1600), ("render", 200)]
    assert all(c[2]["kind"] == "stage" for c in calls)


def test_unknown_states_alone_never_emit(monkeypatch):
    calls = _capture(monkeypatch)
    ticks = iter([0.0, 1.0, 2.0])
    hook = webhook.make_telemetry_hook("http://p", "n", clock=lambda: next(ticks))

    async def run():
        await hook("skip-no-regions", finished=True)  # no canonical stage ever started
        await hook("after-translating")
        await hook("downscaling")

    asyncio.run(run())
    assert calls == []
