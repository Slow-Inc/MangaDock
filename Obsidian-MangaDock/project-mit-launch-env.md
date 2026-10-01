---
name: project-mit-launch-env
tags: ["project"]
description: MIT inference server must launch on MIT/.venv (cu121 CUDA torch), NOT the Store python (cpu torch) — restart recipe
metadata:
  type: project
---

The MIT server's GPU worker only initializes on **`MIT/.venv/Scripts/python.exe`** (`torch 2.5.1+cu121`, `torch.cuda.is_available() == True`). The Windows-Store Python (`...WindowsApps\PythonSoftwareFoundation.Python.3.11...python.exe`) has `torch 2.10.0+cpu` — launching with `--use-gpu` there fails with `Exception: CUDA or Metal compatible device could not be found in torch`, and the worker hangs at `/ready` → **503** (while `/health` still returns 200 — `/health` = main server up, `/ready` = worker ready, so always poll **`/ready`**).

**Gotcha:** `Get-CimInstance Win32_Process.CommandLine` of a *running* MIT main can show the Store-python path and still be misleading — copy the cmdline blindly and you'll restart onto cpu-torch and break the worker. Always launch MIT with the `.venv` python.

**Restart recipe (verified 2026-06-10):**
```
# stop main+worker
Get-NetTCPConnection -LocalPort 5003,5004 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
# start on .venv (CUDA), from MIT/
C:\Github\MangaDock\MIT\.venv\Scripts\python.exe -u server/main.py --host 0.0.0.0 --port 5003 --use-gpu --start-instance
# poll http://127.0.0.1:5003/ready until {"ready":true,...,"translator":"custom_openai"}  (~1-2 min GPU load)
```
Worker ready ⇒ `/ready` 200 `{"ready":true,"workers":1,"translator":"custom_openai"}` (custom_openai = the 9arm gateway, see [[project-mit-translator-env]]).

**Direct render E2E without the auth-gated frontend:** `POST /translate/with-form/image` with `-F image=@page.png -F config={...}` returns the fully-rendered translated image — bypasses AuthGuard/HWID. Production config shape lives in `Backend/src/books/books-mit-config.spec.ts` (detector default 2048 + det_bubble_seg, ocr 48px prob 0.05, translator custom_openai THA←JPN, inpainter lama_large 1536, render supersampling 4 + bubble_area_fit). Used to validate #189/#190 render dedup (74s, clean Thai render). See [[feedback-clear-cache-before-test]] for the cache-reset-before-test rule.
