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
_stage_lock = contextvars.ContextVar("mit_request_stage_lock", default=None)


def scoped_instances():
    """This request's instance dict, or None outside a scope."""
    return _instances.get()


def request_hooks():
    return _hooks.get()


def front_stage_lock():
    """The worker's FIFO lock around the pre-translation stages (detection, OCR, merge), or a no-op.

    Without it, N pages in one worker round-robin through those stages on the event loop and all reach the LLM
    together (measured: first translation started at ~12 s for 5 pages). One page at a time lets page 1's LLM call
    overlap page 2's OCR - Strata runs prefill per request while earlier requests decode.
    """
    lock = _stage_lock.get()
    return lock if lock is not None else contextlib.nullcontext()


@contextlib.asynccontextmanager
async def request_scope(hooks=(), stage_lock=None):
    instances = {}
    t_inst, t_hooks = _instances.set(instances), _hooks.set(tuple(hooks))
    t_lock = _stage_lock.set(stage_lock)
    try:
        yield
    finally:
        _instances.reset(t_inst)
        _hooks.reset(t_hooks)
        _stage_lock.reset(t_lock)
        for inst in instances.values():   # close per-request HTTP clients (AsyncOpenAI and friends)
            close = getattr(inst, "aclose_clients", None) or getattr(getattr(inst, "client", None), "close", None)
            if callable(close):
                try:
                    result = close()
                    if hasattr(result, "__await__"):
                        await result
                except Exception:
                    pass
