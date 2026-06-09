"""Memory-release cleanup (#187 seam S5).

The ``gc.collect()`` + ``if torch.cuda.is_available(): torch.cuda.empty_cache()`` block
was repeated verbatim in four MangaTranslator spots (the >85% pre-processing guard, the
MemoryError fallback, the per-page individual-mode cleanup, and the per-batch tail).
``release_memory`` folds them into one place; ``cuda_available`` / ``empty_cache`` are
injected so it carries no torch dependency of its own. The single psutil pressure check
is left inline at its one call site — there is no duplication there to collapse.
"""
import gc
from typing import Callable


def release_memory(cuda_available: Callable[[], bool], empty_cache: Callable[[], None]) -> None:
    """Run a garbage collection, then empty the CUDA cache when it is available —
    verbatim the repeated cleanup, in the same order."""
    gc.collect()
    if cuda_available():
        empty_cache()
