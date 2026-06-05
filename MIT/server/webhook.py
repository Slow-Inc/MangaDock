"""Webhook delivery from MIT to the Backend.

Sends a signed Patch Set for one Page back to the Backend after MIT finishes
translating it, with bounded retry + exponential backoff on transient failures
(Issue #100). Extracted from server.main so the delivery logic can be unit
tested in isolation (no ML / torch imports).

Re-sending is safe: the Backend de-duplicates webhooks by pageIndex
(T4-STANDARD Pillar 1: Idempotent Pipelines), so retrying a webhook whose
response was lost cannot double-apply a Patch Set.
"""
import asyncio
import hashlib
import hmac
import json
import os

import httpx

# Per-attempt HTTP timeout (seconds). The webhook target is the co-located
# Backend, so a healthy call returns quickly; keep this tight so a retry chain
# does not stall the batch translation loop.
_TIMEOUT_S = 20.0


def _sign(secret: str, data: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), data, hashlib.sha256).hexdigest()


def _is_retryable_status(status_code: int) -> bool:
    """Transient HTTP failures worth retrying: 5xx (server error / restart /
    overload) and 429 (rate limit). Other 4xx (e.g. 400, 401, 413) are
    deterministic — retrying produces the same result — so they are not retried.
    """
    return status_code >= 500 or status_code == 429


def _dead_letter(payload: dict, reason: str) -> None:
    """A Patch Set that could not be delivered after all attempts. Emitted as a
    single structured JSON line so a dropped result is observable
    (T4-STANDARD Pillar 6) instead of vanishing silently."""
    print(json.dumps({
        "event": "webhook_dead_letter",
        "taskId": payload.get("taskId"),
        "pageIndex": payload.get("pageIndex"),
        "reason": reason,
    }, ensure_ascii=False))


async def send_webhook(url: str, secret: str, payload: dict) -> None:
    """POST a signed Patch Set to the callback URL, retrying transient failures
    with exponential backoff. On a non-retryable failure, or after the retry
    budget is exhausted, the result is dead-lettered (logged) rather than lost
    silently."""
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["x-mit-signature"] = _sign(secret, data)

    max_retries = int(os.environ.get("MIT_WEBHOOK_MAX_RETRIES", "3"))
    backoff_ms = int(os.environ.get("MIT_WEBHOOK_RETRY_BACKOFF_MS", "500"))

    last_reason = "unknown"
    async with httpx.AsyncClient() as client:
        for attempt in range(max_retries + 1):
            try:
                resp = await client.post(url, content=data, headers=headers, timeout=_TIMEOUT_S)
                if resp.status_code < 300:
                    return  # delivered
                if not _is_retryable_status(resp.status_code):
                    _dead_letter(payload, f"HTTP {resp.status_code} (non-retryable)")
                    return
                last_reason = f"HTTP {resp.status_code}"
            except Exception as e:  # connection error / timeout — transient
                last_reason = f"{type(e).__name__}: {e}"

            # Back off before the next attempt (no sleep after the final attempt).
            if attempt < max_retries:
                await asyncio.sleep((backoff_ms / 1000.0) * (2 ** attempt))

    _dead_letter(payload, f"exhausted {max_retries + 1} attempts; last={last_reason}")
