"""det_batch_forward_default threads the model explicitly (#188 — kill global MODEL).

The default detector's batch-forward was a module-level fn reaching the loaded
net via a module-global `MODEL` (set in `_load`, read in the forward) — a
concurrency hazard if two detectors load. This pins the forward's transform
(normalize + n h w c → n c h w + to-device, then `model(x)` → `db.sigmoid()`,
`mask`) with the model passed as an explicit argument, so the global can go.
Uses real torch with a fake net.
"""
import importlib

import numpy as np
import pytest
import torch


class FakeNet:
    """Records the tensor it receives; returns fixed (db, mask)."""
    def __init__(self):
        self.received = None

    def __call__(self, x):
        self.received = x
        n = x.shape[0]
        return torch.zeros((n, 1, 4, 4)), torch.ones((n, 1, 4, 4))


# default + dbnet_convnext both carry the (now model-threaded) det_batch_forward_default
@pytest.mark.parametrize('module', [
    'manga_translator.detection.default',
    'manga_translator.detection.dbnet_convnext',
])
def test_forward_threads_model_and_preserves_transform(module):
    forward = importlib.import_module(module).det_batch_forward_default
    net = FakeNet()
    batch = np.zeros((1, 8, 8, 3), dtype=np.uint8)        # n h w c, all 0

    db, mask = forward(batch, 'cpu', net)

    # the net got a normalized, channel-first, float32 tensor — no global needed
    assert net.received is not None
    assert net.received.shape == (1, 3, 8, 8)             # n h w c -> n c h w
    assert net.received.dtype == torch.float32
    assert torch.allclose(net.received, torch.full((1, 3, 8, 8), -1.0))  # 0/127.5 - 1.0

    # outputs: sigmoid(db) then numpy; mask passthrough to numpy
    assert np.allclose(db, np.full((1, 1, 4, 4), 0.5))    # sigmoid(0) = 0.5
    assert np.allclose(mask, np.ones((1, 1, 4, 4)))
