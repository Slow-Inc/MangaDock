"""#459: prepare-models — pre-download optional heavy inpainters (flux) OUT of the
request path so the first flux request never triggers a 300s inline HF download.

These are deterministic, dependency-light unit tests of the PURE decision core
(`manga_translator.model_prepare`): which inpainters to prepare, and whether the
one-time VRAM-spike encode is safe to run. The actual download/encode reuses the
existing `prepare(inpainter, device)` path (idempotent HF download + embed cache),
so it is exercised by running the CLI, not mocked here.
"""
from manga_translator.model_prepare import preflight, resolve_inpainters

_GB = 1024 ** 3


def test_resolve_inpainters_uses_explicit_list_when_given():
    # An operator naming the inpainters wins over everything else.
    assert resolve_inpainters(['flux_klein', 'lama_large'], None) == ['flux_klein', 'lama_large']


def test_resolve_inpainters_falls_back_to_env_when_no_explicit_list():
    # No CLI list → prepare whatever the deployment's MIT_INPAINTER selects, so
    # `prepare-models` warms exactly what the worker will actually serve.
    assert resolve_inpainters(None, 'flux_klein') == ['flux_klein']
    assert resolve_inpainters([], 'flux_klein') == ['flux_klein']


def test_preflight_blocks_the_one_time_encode_when_free_vram_is_below_threshold():
    # The one-time text-encoder encode is an ~8-9 GB VRAM spike; on a 12 GB shared
    # GPU it OOMs if desktop apps hold VRAM. Fail fast with a reason, don't OOM.
    ok, reason = preflight(free_vram_bytes=4 * _GB, min_free_vram_bytes=9 * _GB, needs_encode=True)
    assert ok is False
    assert 'vram' in reason.lower()


def test_preflight_passes_the_encode_when_free_vram_meets_the_threshold():
    ok, reason = preflight(free_vram_bytes=10 * _GB, min_free_vram_bytes=9 * _GB, needs_encode=True)
    assert ok is True
    assert reason == ''


def test_preflight_never_blocks_when_no_encode_is_needed():
    # Embedding already cached (or a non-flux inpainter) → no VRAM spike, so a
    # starved GPU must NOT block the prepare (e.g. re-running to fetch weights).
    ok, _ = preflight(free_vram_bytes=0, min_free_vram_bytes=9 * _GB, needs_encode=False)
    assert ok is True
