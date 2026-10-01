"""Per-model VRAM leak detector for the Dev console (PRD #279) — the worker-side
bookkeeping for the failure the dev hunts by hand: a model that is unloaded but does
NOT return its VRAM, so the GPU slowly bloats.

It learns each model slot's *normal* footprint from its clean unloads (the most VRAM it
ever freed) and flags any later unload that returns far less than that. No load-time
measurement is needed — the one clean unload seam (`ModelUnloader`) feeds it, so this
stays pure / stdlib (no torch) and unit-tests in <1s.
"""


class VramTracker:
    """`leak_ratio`: an unload that frees less than this fraction of the model's learned
    footprint is a leak. `min_footprint_mb`: footprints below this are allocator noise,
    never flagged."""

    def __init__(self, *, leak_ratio: float = 0.5, min_footprint_mb: int = 50):
        self._leak_ratio = leak_ratio
        self._min = min_footprint_mb
        self._models: dict[str, dict] = {}

    def on_unload(self, tool: str, freed_mb) -> None:
        """A model slot was unloaded and freed `freed_mb`. The footprint is the largest
        clean release seen for the slot; a release far below it = a leak."""
        freed = int(freed_mb)
        m = self._models.setdefault(tool, {"footprint_mb": 0, "freed_mb": None, "leaked": False})
        m["freed_mb"] = freed
        m["footprint_mb"] = max(m["footprint_mb"], freed)
        m["leaked"] = m["footprint_mb"] >= self._min and freed < m["footprint_mb"] * self._leak_ratio

    def models(self) -> list[dict]:
        """Per-model rows for the snapshot's `vram.models` (insertion order)."""
        return [{"model": k, **v} for k, v in self._models.items()]
