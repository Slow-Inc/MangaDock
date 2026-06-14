"""Disk-backed cache for the fixed removal prompt's text-embedding (Flux Klein inpainter, ADR 003).

The optional Flux.2 Klein inpainter erases text with a CONSTANT instruction ("remove all text, keep
art"). Its embedding is produced by an ~8 GB VLM text-encoder — far too big to keep resident next to
the per-page transformer on a 12 GB card. So we encode the prompt ONCE, persist the embedding to disk,
and reuse it forever; the encoder is then dropped from the steady loop. This disk cache is exactly the
lever that makes Flux VRAM-neutral.

Pure on purpose: only ``numpy`` + ``hashlib`` + ``os`` (no torch / diffusers), so it unit-tests with a
fake encoder and no GPU. The caller (the inpainter) converts its torch embedding to a numpy array for
``encoder_fn`` and back to a tensor on load; this module never touches the ML stack.
"""
import hashlib
import os

import numpy as np


def _key(prompt: str) -> str:
    """Stable per-prompt cache key — a changed prompt yields a different key (auto-bust)."""
    return hashlib.sha1(prompt.encode("utf-8")).hexdigest()[:16]


def get_embed(encoder_fn, prompt: str, cache_dir: str) -> np.ndarray:
    """Return the embedding for ``prompt``, encoding once and caching to ``cache_dir`` on disk.

    On a miss, calls ``encoder_fn(prompt)`` (expected to return a numpy array), persists it, and
    returns it. On a hit, loads from disk and does NOT call ``encoder_fn`` — so a restarted process
    reuses the embedding instead of reloading the 8 GB encoder. Keyed by the prompt, so a changed
    prompt recomputes while older entries stay cached.
    """
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, _key(prompt) + ".npy")
    if os.path.exists(path):
        return np.load(path)

    emb = np.ascontiguousarray(encoder_fn(prompt))
    # Write to a temp file then atomically replace, so a crash mid-write can't leave a torn cache
    # entry that would later fail to load. Pass a file object to np.save so it doesn't munge the name.
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        np.save(f, emb)
    os.replace(tmp, path)
    return emb
