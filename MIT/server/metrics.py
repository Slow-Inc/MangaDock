"""GPU/host metrics for the Dev console (PRD #279, slice 1d, ADR 016).

The production "window into the box": detailed telemetry sampled from the host
running MIT. Zero new dependency — `nvidia-smi` parsing (GPU) + `psutil` (host),
both already available. The pure `parse_nvidia_smi` carries the logic; `collect`
degrades to host-only when no GPU / `nvidia-smi` is present.
"""
import os
import subprocess

_GPU_FIELDS = ["util_pct", "temp_c", "power_w", "fan_pct", "vram_used_mb", "vram_total_mb"]


def _num(value: str):
    s = value.strip()
    if not s or "n/a" in s.lower():
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return None


def parse_nvidia_smi(output: str) -> list[dict]:
    """Parse `nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,power.draw,
    fan.speed,memory.used,memory.total --format=csv,noheader,nounits` — one dict
    per GPU row."""
    gpus = []
    for line in output.strip().splitlines():
        if not line.strip():
            continue
        parts = [p.strip() for p in line.split(",")]
        gpus.append(dict(zip(_GPU_FIELDS, [_num(p) for p in parts])))
    return gpus


def host_metrics() -> dict:
    """CPU / RAM / disk of the host running this service (psutil)."""
    import psutil

    vm = psutil.virtual_memory()
    disk = psutil.disk_usage(os.getcwd())
    return {
        "cpu_pct": psutil.cpu_percent(interval=None),
        "ram_used_mb": vm.used // (1024 * 1024),
        "ram_total_mb": vm.total // (1024 * 1024),
        "disk_used_pct": disk.percent,
    }


def gpu_metrics() -> list[dict]:
    """Device GPU telemetry via nvidia-smi; `[]` if no GPU / nvidia-smi missing."""
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=utilization.gpu,temperature.gpu,power.draw,fan.speed,memory.used,memory.total",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return []
        return parse_nvidia_smi(result.stdout)
    except Exception:
        return []


def collect() -> dict:
    """A metrics snapshot for the host running this service: always host, GPUs
    when available (host stays observable even with no GPU)."""
    return {"host": host_metrics(), "gpus": gpu_metrics()}
