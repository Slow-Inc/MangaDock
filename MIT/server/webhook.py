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
import time

import httpx

# Per-attempt HTTP timeout (seconds). The webhook target is the co-located
# Backend, so a healthy call returns quickly; keep this tight so a retry chain
# does not stall the batch translation loop.
_TIMEOUT_S = 20.0


def _sign(secret: str, data: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), data, hashlib.sha256).hexdigest()


def _int_env(name: str, default: int) -> int:
    """Parse a non-negative int env var; empty/garbage values fall back to the
    default instead of crashing the batch loop mid-delivery."""
    try:
        return max(0, int(os.environ.get(name, default)))
    except (TypeError, ValueError):
        return default


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

    max_retries = _int_env("MIT_WEBHOOK_MAX_RETRIES", 3)
    backoff_ms = _int_env("MIT_WEBHOOK_RETRY_BACKOFF_MS", 500)

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


# ── Live progress events (UX) ────────────────────────────────────────────────
# Per-stage updates so the Reader can show what the 20-60s per-page wait is
# actually doing. Informational fire-and-forget: one attempt, short timeout,
# never raises — unlike Patch Sets, a lost progress event costs nothing.

_PROGRESS_TIMEOUT_S = 2.0

# Pipeline stages worth showing to a user; bookkeeping states are filtered out.
_PROGRESS_STAGES = {
    'detection', 'ocr', 'textline_merge', 'translating',
    'mask-generation', 'inpainting', 'rendering',
}


async def send_progress(url: str, secret: str, payload: dict) -> None:
    """POST a signed progress event. Single attempt; all failures swallowed."""
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["x-mit-signature"] = _sign(secret, data)
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, content=data, headers=headers, timeout=_PROGRESS_TIMEOUT_S)
    except Exception:
        pass  # informational only — never disturb the translation pipeline


def make_progress_hook(meta: dict):
    """Build a MangaTranslator progress hook that forwards user-facing pipeline
    stages to the Backend webhook. `meta` = {url, secret, taskId, pageIndex}."""
    async def hook(state, finished=False):
        if state in _PROGRESS_STAGES:
            await send_progress(meta["url"], meta["secret"], {
                "taskId": meta["taskId"],
                "pageIndex": meta["pageIndex"],
                "stage": state,
            })
    return hook


# ── Dev-console pipeline telemetry (worker → parent) ─────────────────────────
# Per-stage durations the worker reports to the PARENT's /internal/telemetry so the
# Dev console shows real stage timing instead of mock (#279). Fire-and-forget, same
# discipline as send_progress — telemetry must never disturb the translation pipeline.

# MangaTranslator stage name → the snapshot's canonical stage id (Dashboard StageTiming).
_TELEMETRY_STAGE_ID = {
    "detection": "detect", "ocr": "ocr", "translating": "translate",
    "inpainting": "inpaint", "rendering": "render",
}


async def send_telemetry(parent_url: str, nonce: str, payload: dict) -> None:
    """POST one telemetry message to the parent's /internal/telemetry. Single attempt,
    short timeout, all failures swallowed."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"{parent_url.rstrip('/')}/internal/telemetry", json=payload,
                              headers={"X-Nonce": nonce}, timeout=_PROGRESS_TIMEOUT_S)
    except Exception:
        pass  # informational only — never disturb the translation pipeline


def make_telemetry_hook(parent_url: str, nonce: str, clock=time.monotonic):
    """Build a progress hook that times each pipeline stage (duration = the gap between
    consecutive stage starts) and reports it to the parent. Stateful closure over the
    in-flight stage. No-op when `parent_url` is empty (a standalone worker with no parent).
    `clock` is injectable for deterministic tests."""
    if not parent_url:
        async def _noop(state, finished=False):
            pass
        return _noop

    last = {"id": None, "at": None}

    async def hook(state, finished=False):
        sid = _TELEMETRY_STAGE_ID.get(state)
        now = clock()
        # A new known stage — or the pipeline finishing — closes out the prior stage.
        if last["id"] is not None and (sid is not None or finished):
            await send_telemetry(parent_url, nonce,
                                 {"kind": "stage", "stage": last["id"], "ms": (now - last["at"]) * 1000})
            last["id"] = None
        if sid is not None:
            last["id"], last["at"] = sid, now

    return hook
