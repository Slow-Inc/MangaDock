"""#460 — per-model readiness state machine + request-gating decision.

Import-light (stdlib only), same discipline as ``server/readiness.py`` /
``server/webhook.py``, so it unit-tests in <1s without the ML stack.

``/ready`` today reports worker *liveness*, not *model readiness*: a heavy
on-demand inpainter (Flux Klein) can be un-loaded while ``/ready`` still says
200, and a request then triggers a 300s+ inline model download under the open
request ("the health check lies"). This module gives the worker an honest,
pure decision:

- track per-inpainter :class:`ModelState` (``missing → downloading → embedding →
  loaded → ready``; plus ``degraded`` / ``failed``);
- for an inpaint request, :func:`gate_inpainter_request` returns *allow*,
  *fallback* (only if the fallback is itself usable and the caller opted in), or
  *reject* (fast 503 with an actionable reason). It **never** resolves to a
  download — fetching weights is prepare-models' job (#459), off the request path.
"""
from enum import Enum
from typing import Mapping, NamedTuple, Optional


class ModelState(str, Enum):
    MISSING = "missing"          # weights not on disk
    DOWNLOADING = "downloading"  # fetching weights
    EMBEDDING = "embedding"      # one-time prompt-embed encode (Flux)
    LOADED = "loaded"            # weights in VRAM, warming
    READY = "ready"              # usable now
    DEGRADED = "degraded"        # usable, reduced quality
    FAILED = "failed"            # load errored


# States in which a model can serve a request right now.
USABLE = frozenset({ModelState.READY, ModelState.LOADED, ModelState.DEGRADED})
# Transient states that resolve on their own — retry later, don't fall back forever.
TRANSIENT = frozenset({ModelState.DOWNLOADING, ModelState.EMBEDDING})

# Heavy on-demand inpainters that must never be inline-downloaded under a request.
# Everything else (lama_*) loads in ~seconds on prepare, not a 300s spike, so it
# stays on the fast default path and is never gated.
HEAVY_INPAINTERS = frozenset({"flux_klein"})
DEFAULT_FALLBACK = "lama_large"


def is_usable(state: ModelState) -> bool:
    return _coerce(state) in USABLE


def is_transient(state: ModelState) -> bool:
    return _coerce(state) in TRANSIENT


def _val(x) -> str:
    """Normalize an enum-or-str inpainter identifier to its str value."""
    return getattr(x, "value", x)


def _coerce(state) -> ModelState:
    return state if isinstance(state, ModelState) else ModelState(state)


class GateDecision(NamedTuple):
    action: str                 # "allow" | "fallback" | "reject"
    inpainter: Optional[str]    # the inpainter to actually run (None on reject)
    http_status: Optional[int]  # 503 on reject, else None
    reason: str


def gate_inpainter_request(
    requested,
    states: Mapping,
    *,
    allow_degraded_fallback: bool = False,
    fallback=DEFAULT_FALLBACK,
    heavy=HEAVY_INPAINTERS,
) -> GateDecision:
    """Decide how to serve an inpaint request WITHOUT ever triggering a download.

    ``states``: mapping ``{inpainter_name: ModelState|str}``; an absent model is
    treated as :attr:`ModelState.MISSING`. The caller enforces the returned
    :class:`GateDecision` (dispatch / substitute / return 503).
    """
    req = _val(requested)

    def state_of(name) -> ModelState:
        return _coerce(states.get(_val(name), ModelState.MISSING))

    # Non-heavy inpainters are the fast default path — never gated.
    if req not in heavy:
        return GateDecision("allow", req, None, f"{req} is not gated (fast path)")

    if state_of(req) in USABLE:
        return GateDecision("allow", req, None, f"{req} is ready")

    # Heavy model not usable → fall back only if the caller opted in AND the
    # fallback is itself usable; otherwise reject fast. Never download.
    fb = _val(fallback)
    st = state_of(req)
    if allow_degraded_fallback and fb and state_of(fb) in USABLE:
        return GateDecision(
            "fallback", fb, None,
            f"{req} is {st.value}; serving {fb} instead (degraded, config-allowed)")

    if st is ModelState.MISSING:
        why = (f"{req} weights are not present — run prepare-models (#459); "
               f"refusing to download under an open request")
    elif st in TRANSIENT:
        why = f"{req} is {st.value} — not ready yet, retry shortly"
    elif st is ModelState.FAILED:
        why = f"{req} failed to load"
    else:
        why = f"{req} is not ready ({st.value})"
    return GateDecision("reject", None, 503, why)


class ModelReadiness:
    """Mutable per-inpainter state the worker updates as models load/unload.

    Import-light and thread-unaware by design — the worker mutates it on its own
    load path; ``/ready`` reads :meth:`snapshot`. Unknown models read as MISSING.
    """

    def __init__(self):
        self._states = {}

    def set(self, name, state) -> "ModelReadiness":
        self._states[_val(name)] = _coerce(state)
        return self

    def state(self, name) -> ModelState:
        return self._states.get(_val(name), ModelState.MISSING)

    def is_model_ready(self, name) -> bool:
        return self.state(name) in USABLE

    def snapshot(self) -> dict:
        return {k: v.value for k, v in self._states.items()}
