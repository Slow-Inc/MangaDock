"""Parent-side sink the worker reports pipeline telemetry into so the Dev-console
`/status` snapshot shows REAL data instead of mock (PRD #279):

  - per-stage durations (detect/ocr/translate/inpaint/render) → rolling average
  - a VRAM report: the worker's torch `allocated`/`reserved` (the bloat signal) plus
    per-model footprint & freed-on-unload + a leak flag — the exact thing the dev
    debugs by hand today when a model stops returning its VRAM.

The worker pushes these via `POST /internal/telemetry`. Pure / stdlib-only (no torch,
no httpx) so it unit-tests in <1s, same discipline as `server.metrics`.
"""

# Friendly labels for the known pipeline stages; unknown stages fall back to the id.
_STAGE_LABELS = {
    "detect": "Detection",
    "ocr": "OCR",
    "translate": "Translate",
    "inpaint": "Inpaint",
    "render": "Render",
}


class TelemetryStore:
    """In-memory, bounded. `keep` caps how many recent samples per stage feed the
    rolling average so a stale spike ages out."""

    def __init__(self, keep: int = 20):
        self._keep = keep
        self._stage_ms: dict[str, list[int]] = {}
        self._vram: dict | None = None  # latest {allocated_mb, reserved_mb, models:[...]}

    def record_stage(self, stage: str, ms) -> None:
        buf = self._stage_ms.setdefault(stage, [])
        buf.append(int(ms))
        if len(buf) > self._keep:
            buf.pop(0)

    def record_vram(self, report: dict) -> None:
        self._vram = dict(report)

    def snapshot(self) -> dict:
        stages = [
            {"id": s, "label": _STAGE_LABELS.get(s, s), "live_ms": round(sum(v) / len(v))}
            for s, v in self._stage_ms.items()
            if v
        ]
        return {"stages": stages, "vram": self._vram}

    def apply(self, payload: dict) -> dict | None:
        """Apply one worker telemetry message (the `POST /internal/telemetry` body) and
        return a status_hub event to publish, or None. Malformed messages are ignored —
        the worker channel must never be able to crash the parent.

        kind: "stage" {stage, ms} · "vram" {allocated_mb, reserved_mb, models}."""
        kind = payload.get("kind")
        if kind == "stage":
            stage, ms = payload.get("stage"), payload.get("ms")
            if stage is None or ms is None:
                return None
            self.record_stage(stage, ms)
            return {"type": "event", "service": "mit", "kind": "stage",
                    "detail": f"{_STAGE_LABELS.get(stage, stage)} {int(ms)}ms"}
        if kind == "vram":
            self.record_vram({k: payload[k] for k in ("allocated_mb", "reserved_mb", "models") if k in payload})
            return None  # VRAM updates refresh the snapshot, not the log feed
        return None


# Parent-process singleton (the SSE route + the /internal/telemetry endpoint share it).
telemetry_store = TelemetryStore()
