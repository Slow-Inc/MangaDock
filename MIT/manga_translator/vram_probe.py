"""Thin torch.cuda VRAM reader (worker-side) — the ONE spot that touches torch for
Dev-console VRAM telemetry (#279), so VramTracker / the snapshot stay torch-free and
testable. Every reader returns None when CUDA is unavailable (CPU worker / no GPU).

These read the CURRENT PROCESS's torch allocator (the worker), which is why VRAM
telemetry is worker-reported — the parent process never loads models, so its
`memory_allocated` is ~0. nvidia-smi total (server.metrics, parent) covers the
whole GPU including non-torch (onnx) allocations.
"""


def read_allocated_mb():
    """The worker's current torch CUDA allocated VRAM in MB, or None without CUDA.
    Used to measure the freed delta around a model unload."""
    try:
        import torch
        if not torch.cuda.is_available():
            return None
        return round(torch.cuda.memory_allocated() / (1024 * 1024))
    except Exception:
        return None


def read_vram():
    """{allocated_mb, reserved_mb} for the global bloat signal, or None without CUDA.
    `reserved` climbing while `allocated` is flat is the fragmentation/non-release leak."""
    try:
        import torch
        if not torch.cuda.is_available():
            return None
        return {
            "allocated_mb": round(torch.cuda.memory_allocated() / (1024 * 1024)),
            "reserved_mb": round(torch.cuda.memory_reserved() / (1024 * 1024)),
        }
    except Exception:
        return None
