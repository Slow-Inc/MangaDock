# MIT — Architecture Blueprint

> **Manga Image Translator** — the Python ML service that powers MangaDock's image (patch) translation.
> This document is the map for the ~46,000-LOC codebase: read it before touching MIT so you (human or agent)
> understand the structure and the request flow without spelunking. Pair it with the root
> `UBIQUITOUS_LANGUAGE.md`, `CONTEXT.md`, and `Roadmap.md`.
> For the inside of `manga_translator/` — per-stage pipeline contracts (detect → OCR → merge →
> translate → inpaint → render) and the exact file-level divergence from upstream — see
> **`PIPELINE.md`**. Check its §5 provenance table before editing any MIT file.

**Last updated:** 2026-06-06 · **Scope:** server + orchestration + translator subsystem (model internals summarised, not detailed)

---

## 1. What MIT is (and is not)

MIT takes a manga **Page** image and returns **Patches** — cropped PNGs of translated text regions with
normalized coordinates — which MangaDock's Backend caches and the Frontend overlays on the original page.

- **Origin:** a customised fork of the open-source `manga-image-translator`. Most of `manga_translator/`
  (detection / OCR / inpainting / rendering / diffusion models) is **upstream** and rarely changed.
- **MangaDock-specific code** lives mostly in `server/` and the **patch** + **webhook** paths. That is where
  bugs relevant to the product concentrate — model files are not where reliability issues for this feature live.
- MIT does **not** do text/dialogue translation for the catalog — that is Gemini called directly from the
  Backend (NestJS). MIT only does **image (patch) translation**.

```
Browser ──/api/proxy──▶ Frontend (Next.js :4000) ──▶ Backend (NestJS :4001) ──HTTP+webhook──▶ MIT (:5003)
```

---

## 2. The two-process model

MIT runs as **two processes** so heavy ML work is delegated out of the HTTP layer
(T4-STANDARD Pillar 4: Worker Memory Contract).

```
┌─ WEB SERVER ─ server/main.py ─ :5003 ──────────────────────────────┐
│  • FastAPI app: all public HTTP endpoints                          │
│  • Task queue (server/myqueue.py) + executor registry              │
│  • Batch background task + webhook sender (server/webhook.py)       │
│  • Holds NO ML models itself                                        │
└───────────────┬────────────────────────────────────────────────────┘
                │  pickle over HTTP  (localhost only — see §9 security)
┌───────────────▼─ WORKER ─ manga_translator/mode/share.py ─ :5004 ──┐
│  • Spawned by the web server as `-m manga_translator shared`        │
│  • Registers back via POST /register (nonce-authenticated)          │
│  • Loads ML models lazily on first request (GPU)                    │
│  • Exposes /simple_execute/* and /execute/* (pickled I/O)           │
│  • Runs the real pipeline: translate() / translate_patches()        │
└─────────────────────────────────────────────────────────────────────┘
```

- The web server spawns the worker in `start_translator_client_proc()` (server/main.py). The worker
  always **binds `127.0.0.1`** (loopback) regardless of the front server's public bind host — the
  worker's pickle-accepting endpoints must never be reachable from the network (#103, fixed).
- Start everything with `run-server.bat` (Windows). Env knobs: `MIT_HOST`, `MIT_PORT` (5003),
  `MIT_USE_GPU`, `MIT_START_INSTANCE`.

---

## 3. Directory map

| Path | Responsibility |
|------|----------------|
| `server/main.py` | FastAPI app, **all HTTP endpoints**, batch orchestration, worker spawn |
| `server/myqueue.py` | `TaskQueue`, `QueueElement` / `BatchQueueElement` — FIFO work queue |
| `server/instance.py` | `ExecutorInstance` (a worker) + `Executors` registry; `find_executor`/`free_executor` |
| `server/request_extraction.py` | Turn HTTP input → `QueueElement` → `wait_in_queue`; `get_patch_ctx` etc. |
| `server/sent_data_internal.py` | Web↔worker transport: `fetch_data` / `fetch_data_stream` (**pickle over HTTP**) |
| `server/streaming.py` | NDJSON/byte-stream framing helpers for streaming endpoints |
| `server/webhook.py` | **Batch webhook delivery** — signed POST + retry + dead-letter (Issue #100) |
| `server/to_json.py` | Response serialisation for the public JSON shapes |
| `manga_translator/manga_translator.py` | The engine: `translate()`, **`translate_patches()`**, pipeline glue |
| `manga_translator/config.py` | Pydantic `Config`, `Translator`/`Detector`/... enums, `TranslatorChain` |
| `manga_translator/mode/share.py` | The **worker** process: `/simple_execute/*`, model bootstrap |
| `manga_translator/mode/local.py`, `mode/ws.py` | CLI / WebSocket modes — **not used by MangaDock** |
| `manga_translator/translators/` | Translator subsystem — see §7 |
| `manga_translator/detection/` | Text detection (model + `__init__.py` dispatch) |
| `manga_translator/ocr/` | OCR models (`model_32px`, `model_48px`, `mocr`, ...) |
| `manga_translator/textline_merge/` | Merge OCR textlines into `TextBlock` regions (union-find/MST) |
| `manga_translator/mask_refinement/` | Build the inpaint mask from regions |
| `manga_translator/inpainting/` | Remove original text (lama / aot / sd / ...) |
| `manga_translator/rendering/` | Draw translated text back onto the page |
| `manga_translator/upscaling/`, `colorization/` | Optional pre-steps (off by default) |
| `manga_translator/utils/` | `generic.py` (`Quadrilateral`, image ops), `textblock.py` (`TextBlock`), `sort.py`, `inference.py`, `bubble.py` |

**Pattern:** every pipeline stage folder exposes an `async def dispatch(...)` in its `__init__.py` plus a
`get_*` cache (`detector_cache`, `ocr_cache`, ...). `dispatch` resolves the configured key → class → cached
instance → calls it. The translator subsystem follows the same shape.

---

## 4. HTTP API surface

Grouped by how MangaDock uses them. **Bold = the production path MangaDock depends on.**

### Public (web server :5003)
| Endpoint | Purpose | Used by MangaDock |
|----------|---------|-------------------|
| **`POST /translate/with-form/patches`** | Single page → Patch Set (JSON) | **Yes — single-page translate** |
| **`POST /translate/with-form/patches/batch`** | Batch of pages → webhook **or** NDJSON stream | **Yes — batch translate** |
| `POST /translate/with-form/{json,bytes,image}` | Single page, full-image output | No (catalog uses Backend Gemini) |
| `POST /translate/with-form/{...}/stream` | Streaming full-image | No |
| `GET /health`, `GET /ready` | Liveness / readiness (worker count) | Yes — health checks |
| `GET/DELETE /result(s)/...` | Result-file management | No · **path-traversal risk #102** |
| `POST /translate/batch/{json,images}` | Old batch APIs | No · **broken #104** |
| `POST /simple_execute/translate_batch`, `/execute/translate_batch` | Stubs | No · **broken #104** |

### Internal (worker :5004, pickled I/O — never expose)
`POST /register`, `POST /simple_execute/translate`, **`POST /simple_execute/translate_patches`**,
`POST /execute/translate`. These accept `pickle` bytes — loopback-trusted only (#103).

---

## 5. The production patch path (end-to-end)

This is the single most important flow to understand. Both single-page and batch funnel through
`translate_patches()`.

```
Backend ─POST /translate/with-form/patches[/batch]──▶ server/main.py
  └─ get_patch_ctx(req, config, image)                        # request_extraction.py
       └─ QueueElement(..., task_type="translate_patches")
            └─ task_queue.add_task() → wait_in_queue()        # myqueue.py
                 └─ find_executor() → instance.sent_patches() # instance.py
                      └─ POST worker /simple_execute/translate_patches  (pickle)
                           └─ MangaTranslator.translate_patches(image, config)   # manga_translator.py
```

Inside `translate_patches()`:

```
_translate_until_translation(image, config)        # shared detect→ocr front half
  ├─ (colorize)              if enabled
  ├─ (upscale)               if enabled
  ├─ detection.dispatch      → textlines + mask
  ├─ ocr.dispatch            → recognise text per line
  └─ textline_merge.dispatch → group lines into TextBlock regions   [bug #111: prob denom]
_run_text_translation(config, ctx)                 # translate region texts
  └─ translators.dispatch(translator_gen, texts)   → Gemini / Qwen3 [bugs #107 #108]
_check_target_language_ratio(...)                  # post-translation QA  [bug #109]
for each region-group (proximity-merged, PATCH_CONCURRENCY-gated):
  ├─ mask_refinement → text-only mask
  ├─ inpainting.dispatch     → erase original text
  ├─ rendering.dispatch      → draw translation    [bug #110]
  └─ encode PNG patch
return { img_width, img_height, patches: [ {x,y,w,h,img_b64}, ... ] }
```

The core `translate_patches()` and its region helpers are **well-guarded** (per-stage try/except +
`ignore_errors`, per-group try/except). Reliability bugs cluster in the **translator** and **delivery**
layers, not here.

---

## 6. Queue & executor concurrency model

- One global `TaskQueue` (`server/myqueue.py`). Requests become `QueueElement`s and `await wait_in_queue()`.
- `Executors` registry (`server/instance.py`) tracks worker instances; default is **one** executor
  (`MIT_START_INSTANCE=1`), so pages are processed **sequentially**.
- `wait_in_queue()`: when the task's queue position is within the free-executor count, it acquires an
  executor, sends the work, frees the executor in `finally` (survives cancellation).
- **Cancellation:** a queued task is dropped if `req.is_disconnected()` (streaming requests). The batch
  webhook background task uses a stub request, so it instead polls a cancellation registry
  (`server/cancellation.py`): the Backend calls `POST /cancel/{taskId}` when its last SSE listener leaves,
  and the batch loop (`server/batch_runner.py`) stops before the next page (Issue #101). taskIds are
  deterministic per chapter+language pair, so each run **discards any stale cancel flag on start** — a
  cancel that lands after a run already finished must not poison the next run of the same taskId (#128).
- **ADR — cancellation granularity (#129, decided 2026-06-05): page-boundary only, by design.**
  An in-flight page cannot be interrupted: the worker is a separate process mid-inference, and killing
  its connection has crashed the BLAS runtime before (`forrtl error 200`). Checkpointing cancellation
  into the worker pipeline means plumbing taskIds across processes; a second worker doubles VRAM.
  Accepted trade-off: cancel latency is **up to one page (~60–100 s)**, during which the single worker
  is still busy and new requests (single-page or batch) queue behind it. The Frontend communicates this
  on cancel ("หน้าที่กำลังประมวลผลอยู่จะหยุดเมื่อจบหน้านั้น"). Revisit only if multi-GPU or a worker
  pool lands (then prefer a dedicated short-job worker over mid-page interruption).
- **Gotcha:** `find_executor()` holds an `asyncio.Lock` across an `await` (#106); translator instances are
  cached globally and mutated per-request (safe only because of the single-executor serialisation, #108).

---

## 7. Translator subsystem

```
config.translator.translator_gen → TranslatorChain        # config.py
translators.dispatch(chain, queries, translator_config)   # translators/__init__.py
  └─ get_translator(key) → cached instance                # TRANSLATORS registry
       ├─ GeminiTranslator      (translators/gemini.py)        ← MangaDock default (API)
       ├─ Qwen3Translator       (translators/qwen3.py)         ← MangaDock default (local)
       ├─ chatgpt / deepseek / sakura / nllb / sugoi / ...     ← available, not default
       └─ ...
```

- **Selection:** `config.py::_default_translator()` reads `TRANSLATOR_TYPE` (`api`|`local`) then
  `DEFAULT_API_TRANSLATOR` (default `gemini`) / `DEFAULT_LOCAL_TRANSLATOR` (default `qwen3`).
- **GPT-family** translators (Gemini, ChatGPT, ...) inherit:
  - `ConfigGPT` (`config_gpt.py`) — system prompt template, few-shot **chat/JSON samples** per language,
    `temperature`, `top_p`, language-closest sample matching.
  - `CommonGPTTranslator` (`common_gpt.py`) — prompt assembly, token chunking, response parsing.
- **Base contract** (`common.py::CommonTranslator.translate`): filters non-text queries, calls `_translate`,
  cleans output, merges back. `OfflineTranslator` adds model `load`/`unload`.
- **Samples** live in `config_gpt.py::_CHAT_SAMPLE` / `_JSON_SAMPLE` (includes Thai). Qwen3 indexes
  `chat_sample[to_lang]` directly; Gemini goes through `_closest_sample_match` (langcodes) — **cache bug #108**.

### 7.1 Context-aware translation (page context) — present but dormant

Upstream ships a rolling-context engine: `MangaTranslator.all_page_translations` accumulates every
translated page and `_build_prev_context()` (manga_translator.py) renders the last `context_size`
non-empty pages as a numbered reference block for the prompt. In MangaDock it is effectively OFF,
for three stacked reasons:

1. **`context_size` defaults to 0** — nothing is injected unless a request opts in.
2. **Context is wiped per request** (#136): the worker's `MangaTranslator` is a process-lifetime
   singleton while pages arrive as *independent* pickled requests with no job identity
   (`sent_patches(image, config)` — no taskId crosses the worker boundary). Accumulating state
   therefore meant unbounded RAM growth and pages from unrelated jobs/users bleeding into prompts,
   so `translate_patches` now calls `reset_page_context()` first (guarded by
   `test/test_page_context.py`). Upstream never hit this: it was built as a single-user CLI that
   processes one chapter per process, not a multi-tenant server.
3. **Injection is wired only for `chatgpt` / `chatgpt_2stage`** (`_dispatch_with_context`):
   MangaDock's actual translators (Gemini, Qwen3) never receive `prev_ctx` even when
   `context_size > 0`.

The execution path context was *designed for* still exists but is never called:
`MangaTranslator.translate_batch` + `_concurrent_translate_contexts` translate many pages in one
call, accumulating context internally (concurrent mode even feeds the *original text* of
not-yet-translated batch pages as forward context — the proven recipe if forward context is ever
wanted). MangaDock's `batch_runner` bypasses it with per-page `translate_patches` calls to keep
per-page webhooks/cancellation (the web-server batch endpoints are broken stubs, #104). The
injection seam upstream uses is `translator.set_prev_context(prev_ctx)` with the numbered `<|n|>`
block — reuse it rather than inventing a new prompt format.

The real fix is the **Translation Session** design (#140, open): a per-Batch-Job session owning
page context, the translator singleton reduced to a stateless engine — context must ride the
pickle boundary (e.g. a session id inside `config`) because the web server, not the worker, knows
the taskId. A related quality lever that needs **no** session: GPT-family translators already read
`chat_system_template` overrides from the per-request `chatgpt_config`
(`config_gpt.py::_config_get`), so series-level context (title / synopsis / glossary) can be
injected per request today via the Backend's `buildMitConfig`.

---

## 8. Batch translation & webhook delivery

The flow MangaDock's "translate whole chapter" uses.

```
POST /translate/with-form/patches/batch  (taskId, callback_url, callback_secret, images, page_indices)
  ├─ if callback_url present → 202 Accepted + BackgroundTask: run_batch_with_callbacks(...)   # fire-and-forget
  │     for each page:
  │       patch_result = await get_patch_ctx(dummy_req, ...)        # translate
  │       payload = { taskId, pageIndex, imgWidth, imgHeight, patches, error }   # FLAT shape
  │       await send_webhook(callback_url, callback_secret, payload)             # server/webhook.py
  └─ else → StreamingResponse of NDJSON (one flat object per page + {"done": true} sentinel)
```

- **Payload shape is FLAT** — `imgWidth`/`imgHeight`/`patches` at top level, **not** nested under `result`.
  The Backend controller must read it flat (this mismatch was the original 500 crash; now fixed Backend-side).
- **`send_webhook` (server/webhook.py)** — extracted for testability (imports only httpx/json/hmac):
  - Signs with HMAC-SHA256 (`x-mit-signature`) when a secret is provided.
  - **Retries transient failures** (5xx / 429 / connection-error) with exponential backoff; **does not** retry
    other 4xx (deterministic). On exhaustion or non-retryable failure → **structured-JSON dead-letter log**.
  - Bounds via `MIT_WEBHOOK_MAX_RETRIES` (default 3 → 4 attempts) and `MIT_WEBHOOK_RETRY_BACKOFF_MS`
    (default 500 → 0.5s, 1s, 2s). Per-attempt timeout 20s.
  - **Idempotent-safe:** the Backend de-duplicates by `pageIndex`, so re-sending a lost-but-applied webhook
    cannot double-apply (T4-STANDARD Pillar 1).
- **No single-page reconciliation exists** — if a webhook is permanently lost the page stays missing until the
  whole batch is re-triggered. The webhook retry is the only delivery defense.

---

## 9. Configuration (env)

Copy `.env.example` → `.env`. Key variables:

| Var | Default | Meaning |
|-----|---------|---------|
| `TRANSLATOR_TYPE` | `api` | `api` or `local` |
| `DEFAULT_API_TRANSLATOR` | `gemini` | API translator key |
| `DEFAULT_LOCAL_TRANSLATOR` | `qwen3` | local translator key |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — / `gemini-2.5-flash-lite` | Gemini auth + model |
| `QWEN3_MODEL` / `QWEN3_PRECISION` | `Qwen/Qwen3.5-4B` / `bf16` | local model |
| `PATCH_CONCURRENCY` | `3` | parallel GPU groups in `translate_patches` |
| `MIT_HOST` / `MIT_PORT` | `0.0.0.0` / `5003` | bind (run-server.bat) |
| `MIT_WEBHOOK_MAX_RETRIES` | `3` | webhook retry budget (§8) |
| `MIT_WEBHOOK_RETRY_BACKOFF_MS` | `500` | webhook backoff base (§8) |
| `MT_WEB_NONCE` | random | worker `/register` auth nonce |

> `MIT_WEBHOOK_SECRET` is a **Backend** variable; the secret reaches MIT as the `callback_secret` form field,
> not via MIT's own env.

**Security note (#103, fixed):** the worker accepts `pickle` over HTTP. It is always started on `127.0.0.1` (loopback) regardless of `MIT_HOST` — never expose worker port externally.
Treat its port as loopback-only and never expose it publicly.

---

## 10. Conventions & gotchas

- **`Config` is Pydantic, evaluated at import** — some defaults (e.g. `_default_translator()`) read env at
  import time; set env before importing.
- **Translator chain `dispatch` has two branches** keyed on `chain.target_lang`. MangaDock's normal path
  (`translator:target_lang`) leaves `target_lang=None` → the second branch. The first branch only runs for
  `selective_translation`/`translator_chain` configs (unused here).
- **`Context` (ctx)** is a loose attribute bag passed through the pipeline; missing attributes default to
  `None`, so `if not ctx.text_regions` is safe even when never set.
- **Patch coordinates** returned to the Backend are **pixels** (`x,y,w,h`); the Backend converts to the
  normalized `xPct/yPct/wPct/hPct` fractions the Frontend overlays.
- **`findHomography` can return `None`** for degenerate quads — `textblock.py` guards it; `rendering` and
  `generic.py` do not (#110).

---

## 11. Testing

- Config: `pytest.ini` (`pythonpath = .`) + `pyproject.toml` (`testpaths = ["test"]`). `pytest.ini` wins.
- Existing `test/` tests (`test_render`, `test_translation`, `test_textline_merge`) exercise the **real ML
  stack** and are heavy/slow (≈20s import).
- **Fast unit tests** are possible by isolating logic from the ML imports — e.g. `test/test_send_webhook.py`
  imports only `server/webhook.py` (httpx/json/hmac, <1s) and fakes `httpx`, driving async with
  `asyncio.run()` (no `pytest-asyncio` needed). Prefer this pattern for new logic.
- Run: `.venv/Scripts/python.exe -m pytest test/test_send_webhook.py -p no:cacheprovider -q`

---

## 12. Known issues & hardening (GitHub `Slow-Inc/MangaDock`)

From a full logic scrutiny (model internals excluded). Filed #100–#111.

| # | Severity | Area | Status |
|---|----------|------|--------|
| #100 | Critical | Webhook had no retry → Patch Sets lost ("0/20") | **Done** (server/webhook.py) |
| #101 | Critical | Batch cancellation not propagated → zombie GPU jobs | **Done** (`server/cancellation.py` + `/cancel`) |
| #102 | Security | Path traversal in `/result(s)/...` | Open |
| #103 | Security | Worker pickle-over-HTTP + binds 0.0.0.0 (RCE risk) | **Fixed** |
| #104 | Major | Broken/stub batch endpoints | Open |
| #105 | Cleanup | Dead code / duplicate imports | Open (partly cleaned with #100) |
| #106 | Major | Event-loop blocking + unbounded waits | Open |
| #107 | Major | `GeminiTranslator` retry `UnboundLocalError` (+3) | Open |
| #108 | Major | GPT few-shot sample cache stale across languages | Open |
| #109 | Major | Page-level language check rejects valid pages | Open |
| #110 | Major | Rendering direction/padding mismatch + homography | Open |
| #111 | Major | Textline-merge prob denominator + `TextBlock` defaults | Open |

> **Reading order for a new agent:** §2 (processes) → §5 (patch path) → §8 (webhook) → §7 (translators).
> That covers everything MangaDock actually runs. The model folders (§3) are upstream and can be treated as
> black boxes behind their `dispatch()` interface.
