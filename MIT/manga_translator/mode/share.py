"""
Shared mode – runs as a standalone translation worker.

The web server (server/main.py) spawns this process, which:
  1. Starts a FastAPI/uvicorn HTTP server on the given --port.
  2. Registers itself with the parent web server via POST /register.
  3. Exposes /simple_execute/translate  (single image, pickled I/O)
     and    /execute/translate          (single image, streamed response)
     so that the parent can forward translation work to this worker.
"""

import asyncio
import io
import logging
import os
import pickle
import struct
import traceback

import aiohttp
import numpy as np
from PIL import Image
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse

from manga_translator import Config, Context, MangaTranslator

logger = logging.getLogger('shared')

app = FastAPI()

# Will be set in start()
_translator: MangaTranslator | None = None


# ────────────────────────────────────────────────────────
#  Internal endpoints consumed by the parent web-server
# ────────────────────────────────────────────────────────

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
        ctx = await _translator.translate(image, config)
        return StreamingResponse(
            io.BytesIO(pickle.dumps(ctx)),
            media_type="application/octet-stream",
        )
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

    if image is None:
        raise HTTPException(422, detail="Missing 'image' in payload")

    try:
        patches = await _translator.translate_patches(image, config)
        return StreamingResponse(
            io.BytesIO(pickle.dumps(patches)),
            media_type="application/octet-stream",
        )
    except Exception as e:
        logger.error(f"Patch translation error: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, detail=str(e))


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
        results = await _translator.translate_batch(images_with_configs, batch_size)
        return StreamingResponse(
            io.BytesIO(pickle.dumps(results)),
            media_type="application/octet-stream",
        )
    except Exception as e:
        logger.error(f"Batch translation error: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, detail=str(e))


# ────────────────────────────────────────────────────────
#  Lifecycle helpers
# ────────────────────────────────────────────────────────

async def _register_with_parent(parent_url: str, host: str, port: int, nonce: str):
    """Tell the parent web-server that this worker is ready."""
    url = f"{parent_url}/register"
    payload = {"ip": host, "port": port}
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
        import uvicorn

        global _translator

        host = self.params.get("host", "127.0.0.1")
        port = self.params.get("port", 5003)
        nonce = self.params.get("nonce", "")
        report = self.params.get("report")

        # Inject Prompt-Bold font for Thai rendering if not already specified
        params = dict(self.params)
        if not params.get("font_path"):
            _candidate = os.path.normpath(
                os.path.join(os.path.dirname(__file__), "..", "..", "fonts", "Prompt-Bold.ttf")
            )
            if os.path.isfile(_candidate):
                params["font_path"] = _candidate
                logger.info(f"[share] Using font: {_candidate}")

        # Create the translator engine
        _translator = MangaTranslator(params)

        # Register with parent if a report URL was given
        if report:
            await _register_with_parent(report, host, port, nonce)

        # Run uvicorn in-process
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()
