"""Pure decision core for the ``prepare-models`` CLI (#459).

Pre-download / warm the optional heavy inpainters (notably ``flux_klein``, a
~10-13 GB HF model) OUTSIDE the request path, so the first flux request never
triggers a 300 s inline download. This module holds only the pure decisions
(which inpainters to prepare, whether the one-time VRAM-spike encode is safe);
the actual download+encode reuses the existing ``prepare(inpainter, device)``.
"""
from __future__ import annotations


def resolve_inpainters(explicit, env_value, default: str = 'lama_large'):
    """Return the ordered list of inpainter keys to prepare.

    Precedence: an explicit operator list wins; else the deployment's
    ``MIT_INPAINTER`` env value; else the built-in default (``lama_large``).
    """
    if explicit:
        return list(explicit)
    if env_value:
        return [env_value]
    return [default]


def preflight(free_vram_bytes, min_free_vram_bytes, needs_encode):
    """Decide whether the one-time flux prompt-encode is safe to run now.

    Returns ``(ok, reason)``. The encode briefly loads the ~8 GB text-encoder — a
    VRAM spike that OOMs a busy 12 GB shared GPU. When ``needs_encode`` is False
    (the embedding is already cached, or the inpainter has no such step) there is
    no spike, so it always passes.
    """
    if not needs_encode:
        return True, ''
    if free_vram_bytes < min_free_vram_bytes:
        need_gb = min_free_vram_bytes / 1024 ** 3
        free_gb = free_vram_bytes / 1024 ** 3
        return False, (
            f'insufficient free VRAM for the one-time flux encode: '
            f'{free_gb:.1f} GB free < {need_gb:.1f} GB needed. '
            f'Close GPU-heavy apps (games, Discord, browser) and retry.'
        )
    return True, ''
