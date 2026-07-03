"""Unit tests for GPU/host metrics collection (PRD #279, slice 1d, #284).

The pure `parse_nvidia_smi` is tested directly (no GPU needed); `collect`'s
graceful degradation (host always, GPUs empty when nvidia-smi is unavailable)
is tested by faking the gpu probe. Import-light (`server` package), <1s.
"""
from server import metrics


def test_parse_single_gpu_line():
    """One CSV row from `nvidia-smi --query-gpu=...,--format=csv,noheader,nounits`
    parses into the expected numeric fields."""
    out = "45, 67, 120.5, 55, 5800, 12288\n"

    gpus = metrics.parse_nvidia_smi(out)

    assert len(gpus) == 1
    g = gpus[0]
    assert g["util_pct"] == 45
    assert g["temp_c"] == 67
    assert g["vram_used_mb"] == 5800
    assert g["vram_total_mb"] == 12288


def test_na_fields_become_none():
    """nvidia-smi prints [N/A] for unsupported sensors (e.g. fan on a passively
    cooled card) — those become None, not a crash."""
    g = metrics.parse_nvidia_smi("30, 50, [N/A], [N/A], 1000, 8192")[0]

    assert g["util_pct"] == 30
    assert g["fan_pct"] is None
    assert g["power_w"] is None


def test_multiple_gpus_parse_to_a_list():
    """A multi-GPU host yields one dict per row."""
    out = "10, 40, 80, 30, 1000, 8192\n90, 70, 200, 60, 7000, 8192"

    gpus = metrics.parse_nvidia_smi(out)

    assert [g["util_pct"] for g in gpus] == [10, 90]


def test_collect_degrades_to_host_when_no_gpu(monkeypatch):
    """No GPU / nvidia-smi unavailable → collect() still returns host metrics
    and an empty gpus list, never a crash (the box must stay observable)."""
    monkeypatch.setattr(metrics, "gpu_metrics", lambda: [])

    snap = metrics.collect()

    assert snap["gpus"] == []
    assert "cpu_pct" in snap["host"]
    assert "ram_total_mb" in snap["host"]


def test_collect_surfaces_gpu_metrics_when_present(monkeypatch):
    """When the GPU probe returns data, collect() carries it through."""
    monkeypatch.setattr(metrics, "gpu_metrics", lambda: [{"util_pct": 50, "vram_used_mb": 5800}])

    snap = metrics.collect()

    assert snap["gpus"][0]["util_pct"] == 50
