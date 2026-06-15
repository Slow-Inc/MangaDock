"""Unit tests for the translator-gateway diagnostics probe (PRD #279, ADR 016).

Pure-logic tests: httpx is faked, no network and no ML imports, so the whole
module imports in <1s (same pattern as test_readiness.py / test_webhook.py).
The async entry point is driven with asyncio.run() so no pytest-asyncio is
needed. Each test scripts the gateway's `/models` (control plane) and
`/chat/completions` (inference) responses, then asserts the classified status —
the 2026-06-14 incident was `/models` OK while the chat completion hung.
"""
import asyncio

import httpx

from server import diagnostics


class FakeResponse:
    def __init__(self, status_code: int, json_body: dict | None = None):
        self.status_code = status_code
        self._json = json_body or {}

    def json(self):
        return self._json


class FakeClient:
    """Async-context HTTP client stub. Replays one scripted outcome for the
    `/models` GET and one for the `/chat/completions` POST. An outcome is either
    a FakeResponse or an Exception instance (raised, to simulate timeout /
    connection refused). Records every call."""

    def __init__(self, *, models, chat):
        self._models = models
        self._chat = chat
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, **kwargs):
        self.calls.append(("GET", url))
        return _replay(self._models)

    async def post(self, url, **kwargs):
        self.calls.append(("POST", url))
        return _replay(self._chat)


def _replay(outcome):
    if isinstance(outcome, Exception):
        raise outcome
    return outcome


def _install(monkeypatch, *, models, chat):
    client = FakeClient(models=models, chat=chat)
    monkeypatch.setattr(diagnostics.httpx, "AsyncClient", lambda *a, **k: client)
    return client


MODEL = "qwen3.6-35b-a3b"
MODELS_OK = FakeResponse(200, {"data": [{"id": MODEL}]})
CHAT_OK = FakeResponse(200, {"choices": [{"message": {"content": "x"}}]})


def test_healthy_gateway_is_ok(monkeypatch):
    """Control plane lists the model and the chat completion returns fast →
    the gateway + model are both healthy."""
    _install(monkeypatch, models=MODELS_OK, chat=CHAT_OK)

    status = asyncio.run(
        diagnostics.probe_translator("https://gw.example/v1", "key", MODEL)
    )

    assert status.status == "ok"


def test_model_hung_is_timeout_with_model_down_detail(monkeypatch):
    """The 2026-06-14 incident: the control plane (`/models`) answers, but the
    chat completion hangs — the gateway is up, the model backend is down. This
    must read as `timeout` and the detail must point at the model, not the
    gateway, so the dev does not chase the wrong layer."""
    _install(monkeypatch, models=MODELS_OK, chat=httpx.ReadTimeout("hung"))

    status = asyncio.run(
        diagnostics.probe_translator("https://gw.example/v1", "key", MODEL)
    )

    assert status.status == "timeout"
    assert "model" in status.detail.lower()


def test_bad_key_is_auth(monkeypatch):
    """A rejected key surfaces at the control plane (401/403) — classify as
    `auth` so the dev fixes the credential, not the model."""
    _install(monkeypatch, models=FakeResponse(401), chat=CHAT_OK)

    status = asyncio.run(
        diagnostics.probe_translator("https://gw.example/v1", "bad", MODEL)
    )

    assert status.status == "auth"


def test_connection_refused_is_unreachable(monkeypatch):
    """No connection at all (DNS / network / host down) — `unreachable`, a
    different fix from a hung model."""
    _install(monkeypatch, models=httpx.ConnectError("refused"), chat=CHAT_OK)

    status = asyncio.run(
        diagnostics.probe_translator("https://gw.example/v1", "key", MODEL)
    )

    assert status.status == "unreachable"


def test_model_not_listed_is_model_missing(monkeypatch):
    """The control plane is healthy but does not list the configured model
    (renamed / unloaded / wrong name) — `model_missing`, distinct from a hung
    model. The chat probe is not even attempted."""
    other = FakeResponse(200, {"data": [{"id": "some-other-model"}]})
    client = _install(monkeypatch, models=other, chat=CHAT_OK)

    status = asyncio.run(
        diagnostics.probe_translator("https://gw.example/v1", "key", MODEL)
    )

    assert status.status == "model_missing"
    assert ("POST", "https://gw.example/v1/chat/completions") not in client.calls


def test_slow_chat_is_slow(monkeypatch):
    """The model answers but far too slowly (degraded / overloaded) — `slow`,
    a warning short of a timeout. Latency is controlled deterministically: 5s
    elapsed is over the 3s slow threshold."""
    _install(monkeypatch, models=MODELS_OK, chat=CHAT_OK)
    # 4 time reads: control start/end (0.0→0.1 = 100ms) then chat start/end (0.1→5.1 = 5s).
    ticks = iter([0.0, 0.1, 0.1, 5.1])
    monkeypatch.setattr(diagnostics.time, "time", lambda: next(ticks))

    status = asyncio.run(
        diagnostics.probe_translator("https://gw.example/v1", "key", MODEL)
    )

    assert status.status == "slow"
    assert status.latency_ms == 5000
    assert status.control_ms == 100


def test_control_plane_timeout_is_gateway_timeout(monkeypatch):
    """If even `/models` hangs, the gateway control plane itself is down — a
    `timeout` whose detail points at the gateway, not the model (contrast the
    2026-06-14 incident, where `/models` answered and the model hung)."""
    _install(monkeypatch, models=httpx.ReadTimeout("hung"), chat=CHAT_OK)

    status = asyncio.run(
        diagnostics.probe_translator("https://gw.example/v1", "key", MODEL)
    )

    assert status.status == "timeout"
    assert "control plane" in status.detail.lower()
