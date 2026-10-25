"""Per-request state for batch slots inside one worker (#1123), pure and torch-free.

With ``MIT_WORKER_SLOTS`` > 1 one worker runs several pages at once on its event loop. Two pieces of state used to be
shared and would mix pages: the cached translator (``parse_args`` stores each request's config on it) and the progress
hooks. Inside ``request_scope()`` the translator registry hands out an instance per request (see
``DispatchRegistry(scoped=...)``) and ``request_hooks()`` returns only this request's hooks. Outside a scope nothing
changes. asyncio copies the context into every task a request creates, so the scope follows the request.
"""
import contextlib
import contextvars

_instances = contextvars.ContextVar("mit_request_instances", default=None)
_hooks = contextvars.ContextVar("mit_request_hooks", default=())


def scoped_instances():
    """This request's instance dict, or None outside a scope."""
    return _instances.get()


def request_hooks():
    return _hooks.get()


@contextlib.asynccontextmanager
async def request_scope(hooks=()):
    instances = {}
    t_inst, t_hooks = _instances.set(instances), _hooks.set(tuple(hooks))
    try:
        yield
    finally:
        _instances.reset(t_inst)
        _hooks.reset(t_hooks)
        for inst in instances.values():   # close per-request HTTP clients (AsyncOpenAI and friends)
            close = getattr(inst, "aclose_clients", None) or getattr(getattr(inst, "client", None), "close", None)
            if callable(close):
                try:
                    result = close()
                    if hasattr(result, "__await__"):
                        await result
                except Exception:
                    pass
