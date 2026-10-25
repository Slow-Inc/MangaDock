"""HTTP clients share one TLS context (#1119), torch-free.

Building an httpx/OpenAI client loads the CA bundle into a new SSLContext: ~140 ms of CPU on this PC, on the event
loop. A worker built one per progress event (7 per page), per result webhook, per telemetry event and two per
translator (one per page with worker slots) - over a second of blocked loop per page. With a shared context a client
costs ~0.8 ms.
"""
import asyncio
import ssl

import httpx

import manga_translator.tls as tls
import server.webhook as webhook


def test_the_context_is_built_once_and_verifies():
    ctx = tls.ssl_context()
    assert isinstance(ctx, ssl.SSLContext) and ctx is tls.ssl_context()
    assert ctx.verify_mode == ssl.CERT_REQUIRED and ctx.check_hostname


def test_every_webhook_client_uses_the_shared_context(monkeypatch):
    seen = []
    real = httpx.AsyncClient

    def client(*a, **k):
        seen.append(k.get("verify"))
        return real(*a, **k)

    monkeypatch.setattr(webhook.httpx, "AsyncClient", client)
    url = "http://127.0.0.1:9/unreachable"   # refused at once; every send swallows the failure
    monkeypatch.setenv("MIT_WEBHOOK_MAX_RETRIES", "0")

    async def main():
        await webhook.send_progress(url, "s", {"a": 1})
        await webhook.send_webhook(url, "s", {"a": 1})
        await webhook.send_telemetry(url, "n", {"a": 1})

    asyncio.run(main())
    assert len(seen) == 3 and all(v is tls.ssl_context() for v in seen)
