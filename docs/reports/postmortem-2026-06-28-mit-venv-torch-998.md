# Post-mortem — MIT `.venv` torch import fails `WinError 998` after Windows reinstall

**Date:** 2026-06-28 · **Severity:** blocker (no MIT server, no MIT pytest — whole MIT line dead)
**Status:** fixed · **Area:** MIT dev environment (`MIT/.venv`)

## Symptom

`python -c "import torch"` in `MIT/.venv` →
`OSError: [WinError 998] Invalid access to memory location. Error loading "…/torch/lib/c10.dll" or one of its dependencies.`
torch's own compiled DLLs (`c10`, `c10_cuda`, `cudart64_12`, `shm`, `torch`, `torch_cpu`, `torch_cuda`, `torch_python`) fail under torch's loader flags (`LoadLibraryExW 0x1100`); bundled third-party deps (cuDNN/cuBLAS/fbgemm/asmjit) load. This blocked `manga_translator/__init__` (eager `import torch`) → **every** MIT pytest collection + the server.

## Root cause

The `MIT/.venv` **torch install itself was broken by its provenance**, not the machine:
- venv was created by **gamin's Windows-Store Python 3.11** under a **OneDrive** path (`C:\Users\gamin\OneDrive\…\MangaDock Phase 2\…\MIT\.venv`),
- the project was moved **C: → D:** (OneDrive sync can corrupt large binaries),
- `pyvenv.cfg` was then repointed to **xenod's python.org Python 3.11** (a different build).

torch's own DLLs, installed against the original Python/OneDrive environment, no longer loaded cleanly. A **fresh venv (python.org Python) + `pip install torch`** imported fine on the same machine — proving the host was never the problem.

## Fix

`pip install --force-reinstall --no-cache-dir torch==2.5.1+cu121 --index-url https://download.pytorch.org/whl/cu121`
→ `import torch` OK, `CUDA available: True`, `RTX 4070 SUPER`. (Also overwrote a dead `torch/__init__.py` patch — see below.)

## How it slipped / what misled us

**The error code anchored us on the wrong hypothesis.** `WinError 998` ("invalid access to memory location") reads as an executable-memory / JIT block, so we anchored on **HVCI / Memory Integrity** and chased Windows security features for several rounds. We disproved, in order: HVCI (Memory Integrity), Smart App Control, Intel CET / shadow-stack, VC++ redistributable age, broad venv corruption, "torch not installed", PowerShell ExecutionPolicy, the C:→D: drive move. **The reboot (HVCI off) was the decisive disproof that killed the HVCI hypothesis** — torch still failed with Memory Integrity off.

## Lessons (debug-mantra)

1. **`998 ≠ HVCI`.** Don't anchor a root cause on an error code's "feel". `126` = missing module, `193` = bad image, `998` = access-violation during load (many causes incl. a broken install). Get the **fail path**, don't infer from the code.
2. **Run the disproof, not the proof.** Each ruled-out security feature was cheap to check; the single decisive experiment (fresh clean venv → torch imports) settled it faster than the whole security chase.
3. **A venv carried across users / Python builds / OneDrive / drives is suspect** — even when `numpy`/`cv2` still import (simpler C-extensions mask a torch-specific break). When a venv's provenance is messy, **recreate or force-reinstall before deep-debugging the host.**
4. **Never claim a fix works without the decisive test.** The earlier `torch/__init__.py` `with_load_library_flags=False` patch was applied but **never verified** (the run was denied at the time) — it did nothing and added noise.

## Follow-ups

- If `torchvision` / `torchaudio` are used by MIT, force-reinstall them to matching versions (same provenance risk).
- #359 (lazy-import torch) would let MIT **logic** tests run torch-free, decoupling pure helpers (`patch_geometry`) from this class of failure.
