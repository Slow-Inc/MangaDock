"""Translate-failure classification for the Dev console (PRD #279, slice 1e).

Import-light (stdlib only) so it unit-tests in <1s. Turns a raised translator
exception into a structured failure naming stage + translator + endpoint +
model + cause + hint, replacing the opaque bubbled-up
`'ollama servers did not respond quickly enough'`. The `cause` vocabulary lines
up with `server.diagnostics` (timeout / auth / unreachable) so the dev console
reads one language across the live probe and the failure.
"""
from dataclasses import dataclass

_HINTS = {
    "timeout": "model not responding — check /staff/system",
    "auth": "check the API key",
    "unreachable": "gateway unreachable — check the endpoint / network",
}


@dataclass
class TranslateFailure:
    stage: str
    translator: str
    endpoint: str
    model: str
    cause: str          # timeout | auth | unreachable | error
    hint: str

    def message(self) -> str:
        return (
            f"Translate failed at {self.stage} stage: {self.translator} "
            f"({self.endpoint} / {self.model}) — {self.cause}. {self.hint}"
        )


def classify_translate_error(exc: BaseException, *, translator: str, endpoint: str, model: str, stage: str = "translation") -> TranslateFailure:
    """Classify a raised translator exception by its type name and message."""
    text = f"{type(exc).__name__} {exc}".lower()
    if "timeout" in text or "did not respond" in text or "quickly enough" in text:
        cause = "timeout"
    elif "auth" in text or "401" in text or "403" in text or "unauthorized" in text or "permission" in text:
        cause = "auth"
    elif "connect" in text or "unreachable" in text or "refused" in text:
        cause = "unreachable"
    else:
        cause = "error"
    return TranslateFailure(
        stage=stage,
        translator=translator,
        endpoint=endpoint,
        model=model,
        cause=cause,
        hint=_HINTS.get(cause, "see the worker log"),
    )
