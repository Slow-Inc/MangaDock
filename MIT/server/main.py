import base64
import io
import json
import os
import secrets
import shutil
import signal
import subprocess
import sys
from argparse import Namespace
import asyncio

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


from fastapi import FastAPI, Request, HTTPException, Header, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from manga_translator import Config
from server.instance import ExecutorInstance, executor_instances
from server.myqueue import task_queue
from server.request_extraction import get_ctx, get_patch_ctx, while_streaming, TranslateRequest
from server.to_json import to_translation, TranslationResponse
from server.webhook import send_webhook
from server.cancellation import is_cancelled, mark_cancelled, discard
from server.path_utils import safe_result_folder

app = FastAPI(
    title="Manga Image Translator",
    description=(
        "HTTP microservice for manga/image translation.\n\n"
        "Accepts image input, runs a full translation pipeline "
        "(detection → OCR → translation → inpainting → rendering), "
        "and returns results in multiple formats: full image, JSON, byte stream, or per-region patches.\n\n"
        "Interactive test UIs are available at `/` (web UI) and `/manual` (API test harness)."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
nonce = None

BASE_DIR = Path(__file__).resolve().parent
RESULT_ROOT = (BASE_DIR.parent / "result").resolve()
RESULT_ROOT.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加result文件夹静态文件服务
if RESULT_ROOT.exists():
    app.mount("/result", StaticFiles(directory=str(RESULT_ROOT)), name="result")

@app.get("/health", tags=["api"], summary="Health check")
async def health():
    """Returns service status. Use this for liveness/readiness probes."""
    worker_count = len(executor_instances.list)
    free_worker_count = executor_instances.free_executors()
    return {
        "status": "ok" if worker_count > 0 else "starting",
        "workers": worker_count,
        "free_workers": free_worker_count,
        "busy_workers": worker_count - free_worker_count,
        "queue_size": len(task_queue.queue),
    }

@app.get("/ready", tags=["api"], summary="Readiness check")
async def ready():
    """Returns 200 only when at least one worker is registered and ready to translate.
    Returns 503 during model loading / startup. Use this instead of /health for
    translation-readiness probes."""
    from fastapi.responses import JSONResponse
    worker_count = len(executor_instances.list)
    if worker_count > 0:
        return {"ready": True, "workers": worker_count}
    return JSONResponse(status_code=503, content={"ready": False, "status": "starting"})

@app.post("/register", response_description="no response", tags=["internal-api"])
async def register_instance(instance: ExecutorInstance, req: Request, req_nonce: str = Header(alias="X-Nonce")):
    if req_nonce != nonce:
        raise HTTPException(401, detail="Invalid nonce")
    instance.ip = req.client.host
    executor_instances.register(instance)

def transform_to_image(ctx):
    # 检查是否使用占位符（在web模式下final.png保存后会设置此标记）
    if hasattr(ctx, 'use_placeholder') and ctx.use_placeholder:
        # ctx.result已经是1x1占位符图片，快速传输
        img_byte_arr = io.BytesIO()
        ctx.result.save(img_byte_arr, format="PNG")
        return img_byte_arr.getvalue()

    # 返回完整的翻译结果
    img_byte_arr = io.BytesIO()
    ctx.result.save(img_byte_arr, format="PNG")
    return img_byte_arr.getvalue()

def transform_to_json(ctx):
    return to_translation(ctx).model_dump_json().encode("utf-8")

def transform_to_bytes(ctx):
    return to_translation(ctx).to_bytes()

@app.post("/translate/json", response_model=TranslationResponse, tags=["api", "json"],response_description="json strucure inspired by the ichigo translator extension")
async def translate_json(req: Request, data: TranslateRequest):
    ctx = await get_ctx(req, data.config, data.image)
    return to_translation(ctx)

@app.post("/translate/bytes", response_class=StreamingResponse, tags=["api", "json"],response_description="custom byte structure for decoding look at examples in 'examples/response.*'")
async def translate_bytes(req: Request, data: TranslateRequest):
    ctx = await get_ctx(req, data.config, data.image)
    return StreamingResponse(content=to_translation(ctx).to_bytes())

@app.post("/translate/image", response_description="the result image", tags=["api", "json"],response_class=StreamingResponse)
async def image(req: Request, data: TranslateRequest) -> StreamingResponse:
    ctx = await get_ctx(req, data.config, data.image)
    img_byte_arr = io.BytesIO()
    ctx.result.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    return StreamingResponse(img_byte_arr, media_type="image/png")

@app.post("/translate/json/stream", response_class=StreamingResponse,tags=["api", "json"], response_description="A stream over elements with strucure(1byte status, 4 byte size, n byte data) status code are 0,1,2,3,4 0 is result data, 1 is progress report, 2 is error, 3 is waiting queue position, 4 is waiting for translator instance")
async def stream_json(req: Request, data: TranslateRequest) -> StreamingResponse:
    return await while_streaming(req, transform_to_json, data.config, data.image)

@app.post("/translate/bytes/stream", response_class=StreamingResponse, tags=["api", "json"],response_description="A stream over elements with strucure(1byte status, 4 byte size, n byte data) status code are 0,1,2,3,4 0 is result data, 1 is progress report, 2 is error, 3 is waiting queue position, 4 is waiting for translator instance")
async def stream_bytes(req: Request, data: TranslateRequest)-> StreamingResponse:
    return await while_streaming(req, transform_to_bytes,data.config, data.image)

@app.post("/translate/image/stream", response_class=StreamingResponse, tags=["api", "json"], response_description="A stream over elements with strucure(1byte status, 4 byte size, n byte data) status code are 0,1,2,3,4 0 is result data, 1 is progress report, 2 is error, 3 is waiting queue position, 4 is waiting for translator instance")
async def stream_image(req: Request, data: TranslateRequest) -> StreamingResponse:
    return await while_streaming(req, transform_to_image, data.config, data.image)

@app.post("/translate/with-form/json", response_model=TranslationResponse, tags=["api", "form"],response_description="json strucure inspired by the ichigo translator extension")
async def json_form(req: Request, image: UploadFile = File(...), config: str = Form("{}")):
    img = await image.read()
    conf = Config.parse_raw(config)
    ctx = await get_ctx(req, conf, img)
    return to_translation(ctx)

@app.post("/translate/with-form/bytes", response_class=StreamingResponse, tags=["api", "form"],response_description="custom byte structure for decoding look at examples in 'examples/response.*'")
async def bytes_form(req: Request, image: UploadFile = File(...), config: str = Form("{}")):
    img = await image.read()
    conf = Config.parse_raw(config)
    ctx = await get_ctx(req, conf, img)
    return StreamingResponse(content=to_translation(ctx).to_bytes())

@app.post("/translate/with-form/image", response_description="the result image", tags=["api", "form"],response_class=StreamingResponse)
async def image_form(req: Request, image: UploadFile = File(...), config: str = Form("{}")) -> StreamingResponse:
    img = await image.read()
    conf = Config.parse_raw(config)
    ctx = await get_ctx(req, conf, img)
    img_byte_arr = io.BytesIO()
    ctx.result.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    return StreamingResponse(img_byte_arr, media_type="image/png")


@app.post("/translate/with-form/patches", response_description="JSON with per-region patch data", tags=["api", "form"])
async def patches_form(req: Request, image: UploadFile = File(...), config: str = Form("{}")) -> dict:
    """Translate image and return per-region PNG patch data for client-side overlay rendering.

    Each patch covers one translated text region (bounding box + padding).
    The client overlays them on the original image using absolute % positioning.
    """
    import base64

    img_bytes = await image.read()
    conf = Config.parse_raw(config)
    patch_result = await get_patch_ctx(req, conf, img_bytes)

    normalized_patches = []
    for patch in patch_result.get("patches", []):
        png_bytes = patch.get("img_png", b"")
        normalized_patches.append({
            "x": patch.get("x", 0),
            "y": patch.get("y", 0),
            "w": patch.get("w", 0),
            "h": patch.get("h", 0),
            "img_b64": base64.b64encode(png_bytes).decode("utf-8"),
        })

    return {
        "img_width": patch_result.get("img_width", 0),
        "img_height": patch_result.get("img_height", 0),
        "patches": normalized_patches,
    }

async def run_batch_with_callbacks(
    index_list: list[int],
    images_data: list[bytes],
    config_str: str,
    taskId: str,
    callback_url: str,
    callback_secret: str,
):
    """Background task to process images and send webhooks.

    Polls the cancellation registry between pages: a cancelled Batch Job stops
    starting new pages, and a page that finished after the cancellation arrived
    is not delivered. The taskId is discarded on exit so the registry stays small.
    """
    # Dummy request mock for internal pipeline compatibility
    class DummyRequest:
        async def is_disconnected(self): return False

    dummy_req = DummyRequest()

    try:
        for img_bytes, page_idx in zip(images_data, index_list):
            # Stop before starting a new page if the Batch Job was cancelled.
            if is_cancelled(taskId):
                print(f"[batch] task {taskId} cancelled - stopping before page {page_idx}")
                break
            try:
                # Re-parse config per page to avoid any state mutation
                page_conf = Config.parse_raw(config_str)
                patch_result = await get_patch_ctx(dummy_req, page_conf, img_bytes)
                patches_out = []
                for patch in patch_result.get("patches", []):
                    png_bytes = patch.get("img_png", b"")
                    patches_out.append({
                        "x": patch.get("x", 0),
                        "y": patch.get("y", 0),
                        "w": patch.get("w", 0),
                        "h": patch.get("h", 0),
                        "img_b64": base64.b64encode(png_bytes).decode("utf-8"),
                    })
                payload = {
                    "taskId": taskId,
                    "pageIndex": page_idx,
                    "imgWidth": patch_result.get("img_width", 0),
                    "imgHeight": patch_result.get("img_height", 0),
                    "patches": patches_out,
                    "error": None,
                }
            except Exception as exc:
                payload = {
                    "taskId": taskId,
                    "pageIndex": page_idx,
                    "imgWidth": 0,
                    "imgHeight": 0,
                    "patches": [],
                    "error": str(exc),
                }

            # If cancelled while this page was translating, drop its now-unwanted result.
            if is_cancelled(taskId):
                print(f"[batch] task {taskId} cancelled - dropping page {page_idx} result")
                break
            await send_webhook(callback_url, callback_secret, payload)
    finally:
        discard(taskId)

@app.post("/cancel/{taskId}", tags=["api", "form"])
async def cancel_batch(taskId: str):
    """Signal that a running Batch Job should stop. Best-effort and idempotent:
    a no-op for an unknown/finished taskId. The background batch loop stops before
    its next page (and drops a page that finished after this arrived)."""
    mark_cancelled(taskId)
    return {"status": "cancelling", "taskId": taskId}


@app.post("/translate/with-form/patches/batch", tags=["api", "form"])
async def patches_batch_stream(
    req: Request,
    background_tasks: BackgroundTasks,
    images: list[UploadFile] = File(...),
    config: str = Form("{}"),
    page_indices: str = Form(""),
    taskId: str = Form(None),
    callback_url: str = Form(None),
    callback_secret: str = Form(None),
):
    """Process a batch of manga pages and return results either via streaming NDJSON or webhooks.

    If ``callback_url`` is provided, the task runs in the background and returns 202 immediately.
    Otherwise, it streams NDJSON patch results as each page completes.

    Webhook payload:
      {"taskId": taskId, "pageIndex": N, "imgWidth": W, "imgHeight": H, "patches": [...], "error": null}
    """
    conf = Config.parse_raw(config)
    index_list: list[int]
    if page_indices.strip():
        index_list = [int(x) for x in page_indices.split(",") if x.strip()]
    else:
        index_list = list(range(len(images)))

    if callback_url:
        # Fire-and-forget background task
        # We need to read images into memory because UploadFile objects might be closed
        # after this function returns.
        images_data = []
        for img_file in images:
            images_data.append(await img_file.read())
        
        background_tasks.add_task(
            run_batch_with_callbacks,
            index_list,
            images_data,
            config,
            taskId,
            callback_url,
            callback_secret,
        )
        return {"status": "accepted", "taskId": taskId}

    async def generate():
        for image_file, page_idx in zip(images, index_list):
            # Early exit if client already disconnected (e.g. batch cancelled)
            if await req.is_disconnected():
                break
            img_bytes = await image_file.read()
            try:
                # Re-parse config per page to avoid any state mutation
                page_conf = Config.parse_raw(config)
                patch_result = await get_patch_ctx(req, page_conf, img_bytes)
                patches_out = []
                for patch in patch_result.get("patches", []):
                    png_bytes = patch.get("img_png", b"")
                    patches_out.append({
                        "x": patch.get("x", 0),
                        "y": patch.get("y", 0),
                        "w": patch.get("w", 0),
                        "h": patch.get("h", 0),
                        "img_b64": base64.b64encode(png_bytes).decode("utf-8"),
                    })
                payload = {
                    "pageIndex": page_idx,
                    "imgWidth": patch_result.get("img_width", 0),
                    "imgHeight": patch_result.get("img_height", 0),
                    "patches": patches_out,
                    "error": None,
                }
            except Exception as exc:
                payload = {
                    "pageIndex": page_idx,
                    "imgWidth": 0,
                    "imgHeight": 0,
                    "patches": [],
                    "error": str(exc),
                }
            yield (json.dumps(payload) + "\n").encode("utf-8")

    async def generate_with_sentinel():
        async for chunk in generate():
            yield chunk
        # Explicit termination sentinel — lets the client break without waiting
        # for TCP keep-alive timeout
        yield (json.dumps({"done": True}) + "\n").encode("utf-8")

    return StreamingResponse(generate_with_sentinel(), media_type="application/x-ndjson")

@app.post("/translate/with-form/json/stream", response_class=StreamingResponse, tags=["api", "form"], response_description="A stream over elements with strucure(1byte status, 4 byte size, n byte data) status code are 0,1,2,3,4 0 is result data, 1 is progress report, 2 is error, 3 is waiting queue position, 4 is waiting for translator instance")
async def stream_json_form(req: Request, image: UploadFile = File(...), config: str = Form("{}")) -> StreamingResponse:
    img = await image.read()
    conf = Config.parse_raw(config)
    # 标记这是Web前端调用，用于占位符优化
    conf._is_web_frontend = True
    return await while_streaming(req, transform_to_json, conf, img)



@app.post("/translate/with-form/bytes/stream", response_class=StreamingResponse,tags=["api", "form"], response_description="A stream over elements with strucure(1byte status, 4 byte size, n byte data) status code are 0,1,2,3,4 0 is result data, 1 is progress report, 2 is error, 3 is waiting queue position, 4 is waiting for translator instance")
async def stream_bytes_form(req: Request, image: UploadFile = File(...), config: str = Form("{}"))-> StreamingResponse:
    img = await image.read()
    conf = Config.parse_raw(config)
    return await while_streaming(req, transform_to_bytes, conf, img)

@app.post("/translate/with-form/image/stream", response_class=StreamingResponse, tags=["api", "form"], response_description="Standard streaming endpoint - returns complete image data. Suitable for API calls and scripts.")
async def stream_image_form(req: Request, image: UploadFile = File(...), config: str = Form("{}")) -> StreamingResponse:
    """通用流式端点：返回完整图片数据，适用于API调用和comicread脚本"""
    img = await image.read()
    conf = Config.parse_raw(config)
    # 标记为通用模式，不使用占位符优化
    conf._web_frontend_optimized = False
    return await while_streaming(req, transform_to_image, conf, img)

@app.post("/translate/with-form/image/stream/web", response_class=StreamingResponse, tags=["api", "form"], response_description="Web frontend optimized streaming endpoint - uses placeholder optimization for faster response.")
async def stream_image_form_web(req: Request, image: UploadFile = File(...), config: str = Form("{}")) -> StreamingResponse:
    """Web前端专用端点：使用占位符优化，提供极速体验"""
    img = await image.read()
    conf = Config.parse_raw(config)
    # 标记为Web前端优化模式，使用占位符优化
    conf._web_frontend_optimized = True
    return await while_streaming(req, transform_to_image, conf, img)

@app.post("/queue-size", response_model=int, tags=["api", "json"])
async def queue_size() -> int:
    return len(task_queue.queue)


@app.api_route("/result/{folder_name}/final.png", methods=["GET", "HEAD"], tags=["api", "file"])
async def get_result_by_folder(folder_name: str):
    """根据文件夹名称获取翻译结果图片"""
    try:
        folder_path = safe_result_folder(RESULT_ROOT, folder_name)
    except ValueError:
        raise HTTPException(400, detail="Invalid folder name")

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(404, detail=f"Folder {folder_name} not found")

    final_png_path = folder_path / "final.png"
    if not final_png_path.exists():
        raise HTTPException(404, detail="final.png not found in folder")

    async def file_iterator():
        with open(final_png_path, "rb") as f:
            yield f.read()

    return StreamingResponse(
        file_iterator(),
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=final.png"}
    )


@app.get("/", response_class=HTMLResponse,tags=["ui"])
async def index() -> HTMLResponse:
    script_directory = Path(__file__).parent
    html_file = script_directory / "index.html"
    html_content = html_file.read_text(encoding="utf-8")
    return HTMLResponse(content=html_content)

@app.get("/manual", response_class=HTMLResponse, tags=["ui"])
async def manual():
    script_directory = Path(__file__).parent
    html_file = script_directory / "manual.html"
    html_content = html_file.read_text(encoding="utf-8")
    return HTMLResponse(content=html_content)

def generate_nonce():
    return secrets.token_hex(16)

def _build_worker_cmd(params: Namespace, port: int, nonce: str) -> list:
    """Build the subprocess argv for the worker process.

    The worker always binds 127.0.0.1 (loopback) regardless of the front
    server's public bind host. The worker receives pickle-deserialised payloads
    from the web server; exposing it to the network would be arbitrary code
    execution (Issue #103).
    """
    cmds = [
        sys.executable,
        '-m', 'manga_translator',
        'shared',
        '--host', '127.0.0.1',
        '--port', str(port),
        '--nonce', nonce,
    ]
    if params.use_gpu:
        cmds.append('--use-gpu')
    if params.use_gpu_limited:
        cmds.append('--use-gpu-limited')
    if params.ignore_errors:
        cmds.append('--ignore-errors')
    if params.verbose:
        cmds.append('--verbose')
    if params.models_ttl:
        cmds.append('--models-ttl=%s' % params.models_ttl)
    if getattr(params, 'pre_dict', None):
        cmds.extend(['--pre-dict', params.pre_dict])
    if getattr(params, 'post_dict', None):
        cmds.extend(['--post-dict', params.post_dict])
    return cmds


def start_translator_client_proc(host: str, port: int, nonce: str, params: Namespace):
    cmds = _build_worker_cmd(params, port, nonce)
    base_path = os.path.dirname(os.path.abspath(__file__))
    parent = os.path.dirname(base_path)
    proc = subprocess.Popen(cmds, cwd=parent)
    executor_instances.register(ExecutorInstance(ip='127.0.0.1', port=port))

    def handle_exit_signals(signal, frame):
        proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit_signals)
    signal.signal(signal.SIGTERM, handle_exit_signals)

    return proc

def prepare(args):
    global nonce
    if args.nonce is None:
        nonce = os.getenv('MT_WEB_NONCE', generate_nonce())
    else:
        nonce = args.nonce
    if args.start_instance:
        return start_translator_client_proc(args.host, args.port + 1, nonce, args)
    folder_name= "upload-cache"
    if os.path.exists(folder_name):
        shutil.rmtree(folder_name)
    os.makedirs(folder_name)


@app.get("/results/list", tags=["api"])
async def list_results():
    """List all result directories"""
    result_dir = RESULT_ROOT
    if not result_dir.exists():
        return {"directories": []}
    
    try:
        directories = []
        for item_path in result_dir.iterdir():
            if item_path.is_dir():
                # Check if final.png exists in this directory
                final_png_path = item_path / "final.png"
                if final_png_path.exists():
                    directories.append(item_path.name)
        return {"directories": directories}
    except Exception as e:
        raise HTTPException(500, detail=f"Error listing results: {str(e)}")

@app.delete("/results/clear", tags=["api"])
async def clear_results():
    """Delete all result directories.

    Decision (#102): MIT is an internal service (Backend → MIT only). The
    /results/clear endpoint has no path-traversal risk (it iterates RESULT_ROOT
    directly) but is unauthenticated and bulk-destructive. It is disabled by
    default via MIT_ENABLE_RESULT_CLEAR=0. Set MIT_ENABLE_RESULT_CLEAR=1 to
    enable (e.g. for a standalone dev instance with the web UI).
    """
    if os.environ.get("MIT_ENABLE_RESULT_CLEAR", "0") != "1":
        raise HTTPException(403, detail="Result clear is disabled on this instance")

    result_dir = RESULT_ROOT
    if not result_dir.exists():
        return {"message": "No results directory found"}
    
    try:
        deleted_count = 0
        for item_path in result_dir.iterdir():
            if item_path.is_dir():
                # Check if final.png exists in this directory
                final_png_path = item_path / "final.png"
                if final_png_path.exists():
                    shutil.rmtree(item_path)
                    deleted_count += 1
        
        return {"message": f"Deleted {deleted_count} result directories"}
    except Exception as e:
        raise HTTPException(500, detail=f"Error clearing results: {str(e)}")

@app.delete("/results/{folder_name}", tags=["api"])
async def delete_result(folder_name: str):
    """Delete a specific result directory"""
    try:
        folder_path = safe_result_folder(RESULT_ROOT, folder_name)
    except ValueError:
        raise HTTPException(400, detail="Invalid folder name")

    if not folder_path.exists():
        raise HTTPException(404, detail="Result directory not found")

    try:
        final_png_path = folder_path / "final.png"
        if not final_png_path.exists():
            raise HTTPException(404, detail="Result file not found")

        shutil.rmtree(folder_path)
        return {"message": f"Deleted result directory: {folder_name}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Error deleting result: {str(e)}")

#todo: restart if crash
#todo: cache results
#todo: cleanup cache

if __name__ == '__main__':
    import uvicorn
    from args import parse_arguments

    args = parse_arguments()
    proc = prepare(args)
    print("Nonce: "+nonce)
    try:
        uvicorn.run(app, host=args.host, port=args.port)
    except Exception:
        if proc:
            proc.terminate()
