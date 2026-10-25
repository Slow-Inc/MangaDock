"""One TLS context for every outgoing HTTP client (#1119), pure and torch-free.

httpx (and the OpenAI SDK on top of it) loads the CA bundle into a fresh SSLContext for each client it builds: ~140 ms
of CPU on this PC, on the event loop. The worker built clients per progress event, per result webhook, per telemetry
event and per translator, which with worker slots is per page. A shared context makes a client ~0.8 ms. It is built
by httpx's own ``create_ssl_context()`` - the call each client made - so verification is unchanged.
"""
import functools
import ssl

import httpx


@functools.lru_cache(maxsize=None)
def ssl_context() -> ssl.SSLContext:
    return httpx.create_ssl_context()
