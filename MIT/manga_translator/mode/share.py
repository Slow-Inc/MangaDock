"""
Shared mode – runs as a standalone translation worker.

The web server (server/main.py) spawns this process, which:
  1. Starts a FastAPI/uvicorn HTTP server on the given --port.
  2. Registers itself with the parent web server via POST /register.
  3. Exposes /simple_execute/translate  (single image, pickled I/O)
     and    /execute/translate          (single image, streamed response)
     so that the parent can forward translation work to this worker.
"""

import contextlib
import asyncio
import logging
import os
import pickle
import struct
import traceback

import aiohttp
import numpy as np
from PIL import Image
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response, StreamingResponse

from manga_translator import Config, Context, MangaTranslator
from manga_translator.request_scope import request_scope
from server.worker_slots import SlotGate, effective_slots, slots_from_env

logger = logging.getLogger('shared')

app = FastAPI()

# Will be set in start()
_translator: MangaTranslator | None = None

# Parent web-server coordinates (url + nonce), set in start(). Used to report
# per-stage pipeline timing to the parent's /internal/telemetry for the Dev console
# (#279) — empty until a worker is started with a --report parent (standalone → no-op).
_PARENT = {"url": None, "nonce": None}


# ────────────────────────────────────────────────────────
#  Internal endpoints consumed by the parent web-server
# ────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Liveness probe used by the parent server's /ready — detects a worker
    that registered and later died (e.g. crashed loading the translator)."""
    return {"ok": True}


_SLOTS = slots_from_env()
_GATE = SlotGate()
_FRONT_STAGES = asyncio.Lock()   # #1123: FIFO through detect/OCR so the first pages reach the LLM early


@contextlib.asynccontextmanager
async def _page_slot(config, hooks=()):
    """#1123: with MIT_WORKER_SLOTS > 1 a page runs in its own request scope (translator instance + progress hooks)
    behind the slot gate - exclusive when it enables selective-Flux, which unloads shared models. One slot keeps the
    previous behaviour: hooks are added to the shared translator for the duration of the request."""
    if _SLOTS == 1:
        for h in hooks:
            _translator.add_progress_hook(h)
        try:
            yield
        finally:
            for h in hooks:
                if h in _translator._progress_hooks:
                    _translator._progress_hooks.remove(h)
        return
    exclusive = bool(getattr(getattr(config, 'inpainter', None), 'selective_flux', False))
    async with _GATE.hold(exclusive=exclusive), request_scope(hooks=hooks, stage_lock=_FRONT_STAGES):
        yield


def _whole_worker():
    """#1123: the batch/stream endpoints keep using the shared translator and its hooks, so with slots they run
    exclusively (alone on the worker); with one slot this is a no-op."""
    return _GATE.hold(exclusive=True) if _SLOTS > 1 else contextlib.nullcontext()


@app.post("/simple_execute/translate")
async def simple_execute_translate(request: Request):
    """Accept a pickled {image, config} payload, translate, return pickled Context."""
    body = await request.body()
    try:
        data = pickle.loads(body)
    except Exception as e:
        raise HTTPException(422, detail=f"Cannot unpickle request body: {e}")

    image: Image.Image = data.get("image")
    config: Config = data.get("config", Config())

    if image is None:
        raise HTTPException(422, detail="Missing 'image' in payload")

    try:
        async with _page_slot(config):
            ctx = await _translator.translate(image, config)
        return Response(content=pickle.dumps(ctx), media_type="application/octet-stream")
    except Exception as e:
        logger.error(f"Translation error: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, detail=str(e))


@app.post("/simple_execute/translate_patches")
async def simple_execute_translate_patches(request: Request):
    """Accept a pickled {image, config} payload, translate, return pickled patch payload."""
    body = await request.body()
    try:
        data = pickle.loads(body)
    except Exception as e:
        raise HTTPException(422, detail=f"Cannot unpickle request body: {e}")

    image: Image.Image = data.get("image")
    config: Config = data.get("config", Config())
    progress_meta = data.get("progress_meta")

    if image is None:
        raise HTTPException(422, detail="Missing 'image' in payload")

    # Forward live pipeline-stage events to the Backend webhook (UX), per request
    # (see _page_slot: on the shared translator with one slot, in the request scope with more).
    hooks = []
    if progress_meta:
        from server.webhook import make_progress_hook
        hooks.append(make_progress_hook(progress_meta))
    # Dev-console stage timing (#279): report each stage's duration to the parent,
    # independent of the Backend progress webhook. No-op without a --report parent.
    if _PARENT["url"]:
        from server.webhook import make_telemetry_hook
        hooks.append(make_telemetry_hook(_PARENT["url"], _PARENT["nonce"]))

    try:
        async with _page_slot(config, hooks):
            patches = await _translator.translate_patches(image, config)
        # Dev console (#279): report the worker's VRAM (global torch alloc/reserved +
        # per-model footprint & leak flags) to the parent after each page — this is when
        # a non-releasing model shows up as bloat. Fire-and-forget.
        if _PARENT["url"]:
            from server.webhook import send_telemetry
            report = _translator.vram_report()
            if report:
                await send_telemetry(_PARENT["url"], _PARENT["nonce"], {"kind": "vram", **report})
        return Response(content=pickle.dumps(patches), media_type="application/octet-stream")
    except Exception as e:
        logger.error(f"Patch translation error: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, detail=str(e))




@app.post("/simple_execute/translate_batch_pipeline")
async def simple_execute_translate_batch_pipeline(request: Request):
    """#905: run a whole page batch on this worker, front/back phases overlapped across pages."""
    body = await request.body()
    try:
        data = pickle.loads(body)
    except Exception as e:
        raise HTTPException(422, detail=f"Cannot unpickle request body: {e}")

    images = data.get("images") or []
    config: Config = data.get("config", Config())
    if not images:
        raise HTTPException(422, detail="Missing 'images' in payload")

    # Dev-console stage timings (#279) still apply; per-page progress webhooks are not
    # forwarded on this path (the batch runner sends the per-page webhooks once the
    # batch returns) — documented limitation of the opt-in pipeline path.
    telemetry_hook = None
    if _PARENT["url"]:
        from server.webhook import make_telemetry_hook
        telemetry_hook = make_telemetry_hook(_PARENT["url"], _PARENT["nonce"])
        _translator.add_progress_hook(telemetry_hook)

    try:
        async with _whole_worker():
            results = await _translator.translate_batch_pipelined(images, config)
        if _PARENT["url"]:
            from server.webhook import send_telemetry
            report = _translator.vram_report()
            if report:
                await send_telemetry(_PARENT["url"], _PARENT["nonce"], {"kind": "vram", **report})
        return Response(content=pickle.dumps(results), media_type="application/octet-stream")
    except Exception as e:
        logger.error(f"Batch pipeline translation error: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, detail=str(e))
    finally:
        if telemetry_hook is not None and telemetry_hook in _translator._progress_hooks:
            _translator._progress_hooks.remove(telemetry_hook)

@app.post("/execute/translate")
async def execute_translate(request: Request):
    """Streaming variant – sends progress frames then the final result."""
    body = await request.body()
    try:
        data = pickle.loads(body)
    except Exception as e:
        raise HTTPException(422, detail=f"Cannot unpickle request body: {e}")

    image: Image.Image = data.get("image")
    config: Config = data.get("config", Config())

    if image is None:
        raise HTTPException(422, detail="Missing 'image' in payload")

    async def generate():
        try:
            async with _whole_worker():
                ctx = await _translator.translate(image, config)
            result_bytes = pickle.dumps(ctx)
            # status 0 = result data
            header = struct.pack(">BI", 0, len(result_bytes))
            yield header + result_bytes
        except Exception as e:
            error_bytes = str(e).encode("utf-8")
            # status 2 = error
            header = struct.pack(">BI", 2, len(error_bytes))
            yield header + error_bytes

    return StreamingResponse(generate(), media_type="application/octet-stream")


@app.post("/simple_execute/translate_batch")
async def simple_execute_translate_batch(request: Request):
    """Accept a pickled batch payload, translate all images, return pickled list[Context]."""
    body = await request.body()
    try:
        data = pickle.loads(body)
    except Exception as e:
        raise HTTPException(422, detail=f"Cannot unpickle request body: {e}")

    images = data.get("images", [])
    config: Config = data.get("config", Config())
    batch_size: int = data.get("batch_size", 4)

    if not images:
        raise HTTPException(422, detail="Missing 'images' in payload")

    try:
        images_with_configs = [(img, config) for img in images]
        async with _whole_worker():
            results = await _translator.translate_batch(images_with_configs, batch_size)
        return Response(content=pickle.dumps(results), media_type="application/octet-stream")
    except Exception as e:
        logger.error(f"Batch translation error: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, detail=str(e))


# ────────────────────────────────────────────────────────
#  Lifecycle helpers
# ────────────────────────────────────────────────────────

async def _register_with_parent(parent_url: str, host: str, port: int, nonce: str):
    """Tell the parent web-server that this worker is ready."""
    url = f"{parent_url}/register"
    payload = {"ip": host, "port": port, "pid": os.getpid(), "slots": _SLOTS,  # pid → Dev-console worker detail (#279)
               "device": os.environ.get("CUDA_VISIBLE_DEVICES")}  # #1119: GPU-aware dispatch
    headers = {"X-Nonce": nonce}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    logger.info(f"Registered with parent at {parent_url}")
                else:
                    logger.warning(f"Registration returned {resp.status}: {await resp.text()}")
    except Exception as e:
        logger.warning(f"Could not register with parent: {e}")


class MangaTranslatorShared:
    """Thin wrapper that boots the worker."""

    def __init__(self, params: dict):
        self.params = params

    async def start(self):
        # #1119 (Strata-xeno serve/winjob.py): the worker opts itself out of EcoQoS; a hidden-window process on a
        # hybrid CPU may otherwise be scheduled on the E-cores.
        from server.win_process import no_throttle
        no_throttle()
        import uvicorn

        global _translator

        host = self.params.get("host", "127.0.0.1")
        port = self.params.get("port", 5003)
        nonce = self.params.get("nonce", "")
        report = self.params.get("report")
        # Expose to the request handlers for Dev-console stage-timing telemetry (#279).
        _PARENT["url"], _PARENT["nonce"] = report, nonce

        # Inject the default Thai render font if not already specified. Prompt-Regular (weight 400,
        # same body height as Bold ~0.64em, lighter strokes) — user preference: less-bold Thai.
        params = dict(self.params)
        if not params.get("font_path"):
            _candidate = os.path.normpath(
                os.path.join(os.path.dirname(__file__), "..", "..", "fonts", "Prompt-Regular.ttf")
            )
            if os.path.isfile(_candidate):
                params["font_path"] = _candidate
                logger.info(f"[share] Using font: {_candidate}")

        # Create the translator engine
        _translator = MangaTranslator(params)
        global _SLOTS   # #1123: a worker that keeps rolling page context runs one page at a time
        _SLOTS = effective_slots(os.environ, _translator.context_size)

        # #1047 (opt-in MIT_PRELOAD=1): load the heavy models while uvicorn boots so the first page does not
        # pay the model-load time. Off by default (costs GPU/RAM while idle, slows boot).
        try:
            from server.readiness import preload_enabled
            if preload_enabled():
                async def _warm_models():
                    import time as _time
                    _t0 = _time.perf_counter()
                    try:
                        await _translator._model_lifecycle.preload(Config(), _translator.device, 0)
                        # The bubble/SFX YOLOs are lazy globals outside the lifecycle table; warm them too so no
                        # pipeline stage pays a first-page load. Best-effort, never a boot failure.
                        try:
                            from ..bubble_detector import preload as _preload_bubbles
                            from ..sfx_detector import preload as _preload_sfx
                            await asyncio.to_thread(_preload_bubbles, _translator.device)
                            await asyncio.to_thread(_preload_sfx, _translator.device)
                        except Exception as exc:
                            print(f"[share] detector preload skipped: {exc}", flush=True)
                        print(f"[share] models preloaded in {(_time.perf_counter() - _t0) * 1000:.0f} ms", flush=True)
                    except Exception as exc:  # preload is an optimisation, never a boot failure
                        print(f"[share] model preload skipped: {exc}", flush=True)
                asyncio.create_task(_warm_models())
        except Exception as exc:
            print(f"[share] preload hook skipped: {exc}", flush=True)

        # Register with parent if a report URL was given
        if report:
            await _register_with_parent(report, host, port, nonce)

        # Run uvicorn in-process
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()
