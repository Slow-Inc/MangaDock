"""Memory-release cleanup (#187 seam S5).

The `gc.collect()` + `if torch.cuda.is_available(): torch.cuda.empty_cache()` block was
repeated verbatim in four MangaTranslator spots (the >85% pre-processing guard, the
MemoryError fallback, the per-page individual-mode cleanup, and the per-batch tail).
Extracted to `memory_guard.release_memory` with `cuda_available` / `empty_cache`
injected so it tests with no torch. The psutil pressure check is single-use and left
inline (nothing to de-duplicate).
"""
from types import SimpleNamespace

import manga_translator.memory_guard as mg


def test_release_memory_collects_then_empties_cache_when_cuda_available(monkeypatch):
    calls = []
    monkeypatch.setattr(mg, 'gc', SimpleNamespace(collect=lambda: calls.append('gc')))
    mg.release_memory(cuda_available=lambda: True, empty_cache=lambda: calls.append('empty'))
    assert calls == ['gc', 'empty']  # order: collect first, then empty_cache


def test_release_memory_skips_cache_when_cuda_unavailable(monkeypatch):
    calls = []
    monkeypatch.setattr(mg, 'gc', SimpleNamespace(collect=lambda: calls.append('gc')))
    mg.release_memory(cuda_available=lambda: False, empty_cache=lambda: calls.append('empty'))
    assert calls == ['gc']  # gc.collect always runs; empty_cache gated on cuda
