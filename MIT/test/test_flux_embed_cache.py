"""Disk-backed cache for the fixed removal prompt's embedding (Flux Klein inpainter, ADR 003 / #273).

The removal instruction is constant, so its embedding is computed ONCE by the heavy VLM text-encoder
and reused forever — the lever that keeps the optional Flux inpainter VRAM-neutral (the encoder never
reloads in the per-page loop). Pure: numpy + hashlib + os only, so these run with a fake encoder and
no GPU / no diffusers import.
"""
import numpy as np

from manga_translator.flux_embed_cache import get_embed


class _FakeEncoder:
    """Stand-in for the VLM text-encoder: records how many times it was actually invoked."""
    def __init__(self, arr):
        self.arr = arr
        self.calls = 0
        self.prompts = []

    def __call__(self, prompt):
        self.calls += 1
        self.prompts.append(prompt)
        return self.arr


def test_encodes_once_on_miss(tmp_path):
    enc = _FakeEncoder(np.arange(12, dtype=np.float32).reshape(1, 3, 4))
    out = get_embed(enc, "remove all text", str(tmp_path))
    assert enc.calls == 1                                  # encoder invoked exactly once
    np.testing.assert_array_equal(out, enc.arr)


def test_reuses_on_hit_without_re_encoding(tmp_path):
    enc = _FakeEncoder(np.ones((2, 2), dtype=np.float32))
    a = get_embed(enc, "p", str(tmp_path))
    b = get_embed(enc, "p", str(tmp_path))
    assert enc.calls == 1                                  # second call served from disk
    np.testing.assert_array_equal(a, b)


def test_persists_across_restart(tmp_path):
    arr = np.full((4,), 7.0, dtype=np.float32)
    get_embed(_FakeEncoder(arr), "p", str(tmp_path))       # first "process" encodes + persists
    fresh = _FakeEncoder(np.zeros((4,), dtype=np.float32))  # a new process whose encoder returns junk
    out = get_embed(fresh, "p", str(tmp_path))
    assert fresh.calls == 0                                # never called — loaded from disk
    np.testing.assert_array_equal(out, arr)                # got the ORIGINAL embed, not the junk


def test_changed_prompt_busts_and_keeps_old(tmp_path):
    enc_old = _FakeEncoder(np.array([1.0, 1.0], dtype=np.float32))
    get_embed(enc_old, "old prompt", str(tmp_path))
    enc_new = _FakeEncoder(np.array([2.0, 2.0], dtype=np.float32))
    out = get_embed(enc_new, "new prompt", str(tmp_path))
    assert enc_new.calls == 1                              # changed prompt → recompute
    np.testing.assert_array_equal(out, enc_new.arr)
    # the old prompt is still cached independently (keyed by prompt)
    enc_old2 = _FakeEncoder(np.array([9.0, 9.0], dtype=np.float32))
    old = get_embed(enc_old2, "old prompt", str(tmp_path))
    assert enc_old2.calls == 0
    np.testing.assert_array_equal(old, enc_old.arr)
