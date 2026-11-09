"""#460 — per-model readiness state machine + request-gating decision.

Import-light (no ML stack) like test_readiness.py, so it runs in <1s. Covers the
two things #460's acceptance requires unit tests for: the readiness state machine
and the request-gating decision (heavy inpainter requested before it is loaded
must fail-fast/fallback, NEVER trigger an inline download).
"""
from server.model_readiness import (
    ModelState,
    ModelReadiness,
    gate_inpainter_request,
    is_usable,
    is_transient,
)


def test_ready_flux_request_is_allowed():
    d = gate_inpainter_request("flux_klein", {"flux_klein": ModelState.READY})
    assert d.action == "allow"
    assert d.inpainter == "flux_klein"
    assert d.http_status is None


def test_loaded_counts_as_usable():
    d = gate_inpainter_request("flux_klein", {"flux_klein": ModelState.LOADED})
    assert d.action == "allow"


def test_non_heavy_inpainter_never_gated_even_if_flux_missing():
    d = gate_inpainter_request("lama_large", {"flux_klein": ModelState.MISSING})
    assert d.action == "allow"
    assert d.inpainter == "lama_large"


def test_flux_missing_no_fallback_rejects_503_and_points_at_prepare_models():
    d = gate_inpainter_request("flux_klein", {"flux_klein": ModelState.MISSING})
    assert d.action == "reject"
    assert d.http_status == 503
    assert "prepare-models" in d.reason
    # the whole point: the gate must never resolve to a download
    assert d.action in {"allow", "fallback", "reject"}


def test_flux_missing_with_fallback_and_ready_lama_falls_back():
    states = {"flux_klein": ModelState.MISSING, "lama_large": ModelState.READY}
    d = gate_inpainter_request("flux_klein", states, allow_degraded_fallback=True)
    assert d.action == "fallback"
    assert d.inpainter == "lama_large"
    assert d.http_status is None


def test_flux_downloading_no_fallback_rejects_with_retry_hint():
    d = gate_inpainter_request("flux_klein", {"flux_klein": ModelState.DOWNLOADING})
    assert d.action == "reject"
    assert d.http_status == 503
    assert "retry" in d.reason.lower()


def test_flux_downloading_with_fallback_falls_back():
    states = {"flux_klein": ModelState.DOWNLOADING, "lama_large": ModelState.READY}
    d = gate_inpainter_request("flux_klein", states, allow_degraded_fallback=True)
    assert d.action == "fallback"
    assert d.inpainter == "lama_large"


def test_fallback_allowed_but_fallback_not_ready_rejects():
    # allow_degraded_fallback set, but lama itself is missing → cannot fabricate
    # readiness; must reject, not substitute a non-usable model.
    states = {"flux_klein": ModelState.FAILED, "lama_large": ModelState.MISSING}
    d = gate_inpainter_request("flux_klein", states, allow_degraded_fallback=True)
    assert d.action == "reject"
    assert d.http_status == 503


def test_flux_failed_no_fallback_rejects_mentions_failed():
    d = gate_inpainter_request("flux_klein", {"flux_klein": ModelState.FAILED})
    assert d.action == "reject"
    assert "failed" in d.reason.lower()


def test_string_state_in_mapping_is_coerced():
    d = gate_inpainter_request("flux_klein", {"flux_klein": "missing"})
    assert d.action == "reject"


def test_unknown_model_defaults_to_missing():
    d = gate_inpainter_request("flux_klein", {})
    assert d.action == "reject"
    assert d.http_status == 503


def test_state_predicates():
    assert is_usable(ModelState.READY)
    assert is_usable(ModelState.LOADED)
    assert not is_usable(ModelState.DOWNLOADING)
    assert is_transient(ModelState.DOWNLOADING)
    assert is_transient(ModelState.EMBEDDING)
    assert not is_transient(ModelState.READY)


def test_model_readiness_tracker_defaults_missing_and_snapshots():
    r = ModelReadiness()
    assert r.state("flux_klein") == ModelState.MISSING
    r.set("flux_klein", ModelState.DOWNLOADING).set("lama_large", ModelState.READY)
    assert r.state("flux_klein") == ModelState.DOWNLOADING
    assert r.is_model_ready("lama_large")
    assert not r.is_model_ready("flux_klein")
    assert r.snapshot() == {"flux_klein": "downloading", "lama_large": "ready"}
