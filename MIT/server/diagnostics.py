"""Translator-gateway diagnostics for the Dev console (PRD #279, ADR 016).

Import-light (httpx only — same pattern as server/readiness.py and
server/webhook.py) so it unit-tests in <1s without the ML stack. A cheap,
bounded probe of the OpenAI-compatible translator gateway, decoupled from the
translate worker pool, that classifies *where* it is stuck: the 2026-06-14
incident showed the control plane (`/models`) answering in 0.19s while the
model's chat completion hung for 151s.
"""
import os
import time
from dataclasses import dataclass

import httpx


@dataclass
class GatewayStatus:
    status: str          # ok | slow | timeout | auth | unreachable | model_missing
    latency_ms: int | None
    detail: str


def _timeout_s() -> float:
    return float(os.environ.get("MIT_DIAG_PROBE_TIMEOUT_S", "5"))


def _slow_ms() -> int:
    return int(os.environ.get("MIT_DIAG_SLOW_MS", "3000"))


async def probe_translator(base_url: str, api_key: str, model: str, *, timeout: float | None = None) -> GatewayStatus:
    """Probe an OpenAI-compatible gateway and classify its health.

    A cheap `GET /models` (control plane) then a 1-token `POST /chat/completions`
    (inference); the latency and any error decide the status.
    """
    base = base_url.rstrip("/")
    headers = {"Authorization": f"Bearer {api_key}"}
    t = timeout if timeout is not None else _timeout_s()
    async with httpx.AsyncClient(timeout=t) as client:
        try:
            models_resp = await client.get(f"{base}/models", headers=headers)
        except httpx.ConnectError:
            return GatewayStatus(status="unreachable", latency_ms=None, detail="could not connect to the gateway")
        except httpx.TimeoutException:
            return GatewayStatus(status="timeout", latency_ms=None, detail="gateway control plane (/models) timed out")
        if models_resp.status_code in (401, 403):
            return GatewayStatus(status="auth", latency_ms=None, detail="gateway rejected the API key")
        listed = [m.get("id") for m in models_resp.json().get("data", [])]
        if model not in listed:
            return GatewayStatus(status="model_missing", latency_ms=None, detail=f"gateway does not list model '{model}'")
        # Control plane answered and lists the model; only the chat completion is left.
        started = time.time()
        try:
            await client.post(
                f"{base}/chat/completions",
                headers=headers,
                json={"model": model, "messages": [{"role": "user", "content": "."}], "max_tokens": 1},
            )
        except httpx.TimeoutException:
            return GatewayStatus(
                status="timeout",
                latency_ms=None,
                detail="gateway /models OK but chat completion timed out — model not responding",
            )
        latency_ms = int((time.time() - started) * 1000)
    if latency_ms > _slow_ms():
        return GatewayStatus(status="slow", latency_ms=latency_ms, detail="model responding but slowly")
    return GatewayStatus(status="ok", latency_ms=latency_ms, detail="gateway and model healthy")
