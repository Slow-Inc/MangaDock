"""Unit tests for translate-failure classification (PRD #279, slice 1e, #281).

Pure-logic tests: plain exceptions are classified by type/message, no network
and no ML imports (lives in the import-light `server` package), so the module
imports in <1s. Turns the bubbled-up `'ollama servers did not respond quickly
enough'` into a structured failure that names stage + translator + endpoint +
model + cause + hint — for the worker log, the backend error response, and an
`error` event on the dev console (1f).
"""
from server import translate_error


def _classify(exc):
    return translate_error.classify_translate_error(
        exc,
        translator="custom_openai",
        endpoint="gateway.9arm.co",
        model="qwen3.6-35b-a3b",
    )


def test_timeout_message_is_timeout():
    """The 2026-06-14 bubbled exception (`did not respond quickly enough`) is a
    model timeout, not a generic failure."""
    failure = _classify(Exception("ollama servers did not respond quickly enough."))

    assert failure.cause == "timeout"


def test_auth_error_is_auth():
    """A rejected key (e.g. openai.AuthenticationError / 401) → `auth`, so the
    dev fixes the credential not the model."""
    failure = _classify(Exception("Error code: 401 — invalid api key"))

    assert failure.cause == "auth"


def test_connection_error_is_unreachable():
    """No connection to the gateway (DNS / network) → `unreachable`."""
    failure = _classify(ConnectionError("Connection refused"))

    assert failure.cause == "unreachable"


def test_each_cause_carries_an_actionable_hint_and_structured_message():
    """Every classified failure surfaces an actionable hint and a structured
    message naming stage + translator + endpoint + model — never a bare 500."""
    timeout = _classify(Exception("did not respond quickly enough"))
    auth = _classify(Exception("Error code: 401"))
    unreachable = _classify(ConnectionError("refused"))

    assert "/staff/system" in timeout.hint
    assert "key" in auth.hint.lower()
    assert "endpoint" in unreachable.hint.lower() or "network" in unreachable.hint.lower()

    msg = timeout.message()
    assert "translation stage" in msg
    assert "custom_openai" in msg and "gateway.9arm.co" in msg and "qwen3.6-35b-a3b" in msg
