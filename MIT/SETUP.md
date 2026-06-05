# MIT — Setup & Runbook

> How to install, run, test, and troubleshoot the Manga Image Translator service.
> For *how it works*, read `ARCHITECTURE.md` first. For the *wire format* with the Backend, see `CONTRACT.md`.

---

## 1. Prerequisites

- **Python 3.10–3.11** (`pyproject.toml` pins `>=3.10, <3.12`). The dev venv runs 3.11.
- **GPU (recommended):** NVIDIA with CUDA for real-time speed. CPU works but is slow.
  `fp8` precision needs PyTorch ≥ 2.1 + Ada Lovelace (RTX 40xx).
- **HuggingFace token** (`HF_TOKEN`) — only for **local** translators (Qwen) to download weights.
- **Gemini API key** (`GEMINI_API_KEY`) — for the default **api** translator.

---

## 2. Install

```bash
# from MIT/
python -m venv .venv
.venv\Scripts\activate           # Windows · (source .venv/bin/activate on *nix)
pip install -r requirements.txt
pip install -r requirements-dev.txt   # optional: lint/format tooling
pip install pytest                    # for the fast unit tests (not in requirements)
```

The first model download (detection / OCR / inpainting / translator) happens **lazily on the first
translation request**, not at install.

---

## 3. Configure

```bash
copy .env.example .env            # cp on *nix
```
Fill in at least:
- `TRANSLATOR_TYPE` (`api` or `local`)
- `GEMINI_API_KEY` + `GEMINI_MODEL`  (if api)  **or**  `HF_TOKEN` + `QWEN3_MODEL`  (if local)

See `.env.example` for every knob (webhook retry, precision, concurrency).

---

## 4. Run

```bash
run-server.bat                    # Windows launcher (recommended)
```
What it does / env knobs:

| Var | Default | Meaning |
|-----|---------|---------|
| `MIT_HOST` | `0.0.0.0` | bind host |
| `MIT_PORT` | `5003` | **web server** port (worker = port + 1 = 5004) |
| `MIT_USE_GPU` | `1` | use GPU |
| `MIT_START_INSTANCE` | `1` | spawn the worker process |

`run-server.bat` tees all output to `logs/server-YYYY-MM-DD.log`.

**Two processes start:** the web server (:5003) and a worker (:5004) it spawns. The worker registers back
via `POST /register`. See `ARCHITECTURE.md §2`.

---

## 5. Verify it is up

```bash
curl http://localhost:5003/health    # { status, workers, free_workers, queue_size }
curl http://localhost:5003/ready     # 200 only when a worker is registered; 503 while loading
```
Use **`/ready`** for translation-readiness (not `/health`). On a cold start the first request triggers model
loading and can take **~150s** — the Backend tolerates this (`translateMangaPagePatches` retries 30× / 5s).

---

## 6. Test

```bash
.venv\Scripts\python.exe -m pytest test/test_send_webhook.py -p no:cacheprovider -q
```
- `-p no:cacheprovider` avoids a Windows `.pytest_cache` permission warning.
- **Prefer fast unit tests** that isolate logic from the ML stack (e.g. `test/test_send_webhook.py` imports
  only `server/webhook.py`, fakes `httpx`, drives async with `asyncio.run()` — no `pytest-asyncio`, <1s).
- The legacy `test/test_render.py`, `test_translation.py`, `test_textline_merge.py` load the **real ML
  stack** (≈20s import, may need a GPU/models) — run those deliberately, not in a tight loop.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `forrtl: error (200): program aborting due to window-CLOSE event` | The Fortran/BLAS runtime crashed because the inbound TCP connection was killed mid-request (e.g. caller aborted a `fetch`), or the console window got a close event. | Don't pass an abort signal into the POST to MIT (fixed Backend-side). Don't close the console while a job runs. **Restart MIT after this crash** — it is no longer serving. |
| Warning: *"using the experimental Python version… switch to the Rust rewrite"* | Benign banner from upstream on every start. | Ignore. |
| `Model '<x>' was not found in the model list` | `GEMINI_MODEL` not a real model id for your key. | Set a valid id from the logged list (see #107 for the model-match bug). |
| First translation hangs ~150s | Lazy model load on first request. | Expected once per process. Hit `/ready`; the Backend retries during this window. |
| `CUDA out of memory` | Model + patch concurrency too large for VRAM. | Lower `PATCH_CONCURRENCY`, use a smaller `*_PRECISION` (int4), or a smaller model. |
| Webhook never reaches Backend | `callback_url` not reachable from MIT (e.g. a public/Cloudflare URL while MIT is localhost). | Backend must advertise a MIT-reachable origin (`MIT_CALLBACK_ORIGIN=http://localhost:4001`). |
| Pages translate but Frontend shows 0/N | Webhook delivery failing silently / Backend rejecting the body. | See `CONTRACT.md` (payload shape, size limits) + Issue #100. |
| Port already in use (5003/5004) | A previous MIT still running. | Kill the stale python processes, then relaunch. |

Logs: `logs/server-YYYY-MM-DD.log` (web + worker, tee'd by `run-server.bat`).

---

## 8. Where to look next

- **Understand the system:** `ARCHITECTURE.md`
- **Integrate / debug the Backend boundary:** `CONTRACT.md`
- **Open hardening work:** Issues #100–#111 (`Slow-Inc/MangaDock`)
