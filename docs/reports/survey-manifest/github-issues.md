# Survey Fragment — GitHub Issues (Slow-Inc/MangaDock)

> Read via `gh issue list`/`gh issue view` on 2026-07-04. Scope: skim all closed (292) + open (63)
> issue titles for thematic patterns, then full-body read of the 20 most substantial/interesting
> (18 closed + 2 open) for genuinely new narrative not already in `bug-case-catalog.md`,
> `system-impact-report.md`, or `docs/adr/`. See `README.md` in this folder for the manifest schema
> and what's already been surveyed elsewhere.

## Summary table

| Metric | Count |
|---|---|
| Total closed issues | 292 |
| Total open issues | 63 |
| Total (closed+open) | 355 |

**Top 5 labels by frequency (closed issues, `gh issue list --state closed --json labels`):**

| Label | Count |
|---|---|
| `ready-for-agent` | 159 |
| `Backend` | 74 |
| `model:opus-4.8` | 56 |
| `MIT` | 54 |
| `task` | 50 |

(Runners-up: `effort:high` 36, `bug` 34, `HIGH` 26, `Frontend` 24, `tech-debt` 22, `story` 21, `model:sonnet-5` 20, `Feature` 17, `enhancement` 15.)

**Open-issue themes (for a "future work" slide):** the open backlog is dominated by two live
initiatives — **Master Plan 2** (#528 epic: translation-quality human-eval, RollingContext
cache-safety, polygon-spill metric, Knuth-Plass wiring, vertical text, SFX) and a **Multi-Provider
LLM Translation** epic (#507, #508-521: abstract `LlmService` behind Gemini/OpenAI/custom) — plus
scattered `[Task]`/`[Story]`/`[Epic]` decomposition tickets for Studio/Community UI polish and a
dashboardv2 health-status feature. Several open MIT issues (#420 non-determinism, #436 OCR
double-detection, #437 glyph fade) are known defects tracked in personal/team memory already.

---

## Issues read in full (18 closed + 2 open)

### Issue #332: Wallet security hardening — verified-payment coin minting + atomic unlock (V1–V9)
- **state:** closed
- **updated_at:** 2026-07-03T03:20:10Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog (catalog's B3 "Payment webhook forgery" is a short summary of a narrower, earlier fix). This is the full V1–V9 audit-to-remediation arc: (1) **V1 critical** — the Xendit webhook trusted its own payload with *optional* HMAC and no callback to Xendit to confirm settlement or reconcile amount, so a self-created pending topup + forged `payment.succeeded` minted unlimited free coins; fixed by making `processXenditWebhook` re-fetch authoritative state via `XenditService.getPaymentRequest` and reconcile amount before crediting, reverting the claim to `pending` (not failing) on any mismatch so genuine retries still work. (2) Boot fail-closed mirrors the existing Turnstile boot assertion (`resolveXenditWebhookConfig`, same pattern as `resolveTurnstileConfig`). (3) Dev/test mint endpoints flip from a negative `NODE_ENV!=production` check to a positive opt-in `XENDIT_ALLOW_SIMULATE` flag. (4) New `SECURITY DEFINER` Postgres function `purchase_unlock_atomic` folds unlock-insert + buyer-debit + creator-credit into one transaction, replacing an insert-then-two-RPC split — explicitly chosen over Jest-against-real-Postgres integration tests (mocked-RPC unit + one live smoke test instead). (5) A partial UNIQUE index on `wallet_transactions(reference_id) WHERE type='topup'` backstops double-credit at the ledger level even if future code bypasses the status-claim. (6) `TopupThrottleGuard` rate-limits topup creation 5/60s per uid, **fail-open** when Redis is down. Good thesis material: defense-in-depth money-flow hardening with an explicit "what becomes impossible" framing and a documented severity ranking (V1 critical → V9 low).

### Issue #198: [tracking] Cloudflare R2 /v1/list cost amplification — hotfix #197 + hardening backlog
- **state:** closed
- **updated_at:** 2026-06-11T03:34:19Z
- **read_date:** 2026-07-04
- **findings:** Largely already covered in bug-case-catalog.md (A3) and system-impact-report.md 2026-06-10 — same root cause (`attachLocalStatus` doing one ungated R2 `/v1/list` per chapter on every load, including cache hits) and same hotfix (#197, gate on `imageCache.enabled && (forceLocal || isOfflineFallback)`). New detail not in the catalog: this issue is the **tracking hub** and names the full 4-item hardening backlog with issue numbers — #199 (route chapter-list fetch through `apiCache`), #200 (Redis-cache the `readerAvailable` set + in-flight dedup), #201 (`CloudflareR2StorageProvider.list` outbound logging/metric + failure backoff so this class of cost bug becomes visible), #202 (restructure the flat `_chapters` namespace to per-manga, N→1 list calls, requiring a `cache:reset` migration) — all four shipped. Useful for a thesis "incident → hotfix → systemic hardening" narrative arc.

### Issue #101: Batch Job cancellation does not propagate to MIT — zombie jobs keep burning GPU
- **state:** closed
- **updated_at:** 2026-06-05T18:57:06Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog. Defect: when a user navigates away mid-translation (all SSE listeners disconnect), the Backend stopped consuming webhook results but MIT kept running the *entire* remaining batch on GPU, POSTing results nobody would read. Fix is a minimal cooperative-cancellation design, explicitly grilled against the CLAUDE.md "simplest construct" principle: a process-global `set()` registry (not `asyncio.Event`) since the web server is one process and the loop only *polls* the flag; a dedicated `POST /cancel/{taskId}` endpoint (idempotent, no-op for unknown/finished tasks) rather than disconnect-polling; cancellation checked at **page-boundary granularity** (before each page, again before each webhook send) rather than mid-pipeline, because mid-pipeline would have to cross the worker's pickle-serialization process boundary. Backend fires the cancel fire-and-forget (errors swallowed) when the last SSE listener for a job leaves. Good concrete example of "pick the simplest construct that suffices" from the North Star principle, with the actual design-review reasoning preserved in the issue.

### Issue #106: Event-loop blocking & unbounded waits in queue/streaming layer
- **state:** closed
- **updated_at:** 2026-06-05T19:06:39Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog (distinct from the catalog's E-series async bugs). Three compounding async-correctness defects found via `/debug-mantra` + scrutinize, all orchestration bugs not model code: (1) executor acquisition held an `asyncio.Lock` across an **unbounded await** for "a free executor becomes available" — every other acquirer blocked on the *lock*, not just on availability, serializing more than intended once >1 executor exists; fixed by releasing the lock before `event.wait()` and re-acquiring only to mark busy. (2) URL image fetch used synchronous `requests.get()` inside an `async def`, blocking the *entire event loop* for the whole download — replaced with `httpx.AsyncClient`. (3) The streaming consumer awaited the next worker frame with **no timeout**, so a dead/stalled worker could hang the SSE response forever — fixed with `asyncio.wait_for(timeout=300s)` emitting a clean error frame on timeout. A follow-up comment flagged a **fourth, still-latent** instance: `gemini_2stage.py` constructs synchronous `OpenAI(...)` clients (not `AsyncOpenAI`) inside async methods — same defect class, scoped as low-risk because `Gemini2StageTranslator` isn't in MangaDock's default path (default is `gemini` + `qwen3`), contrasted against `chatgpt.py`/`custom_openai.py`/`deepseek.py` which correctly use `AsyncOpenAI`. Good "one bug class, four sites, one latent" case study.

### Issue #103: Worker accepts pickled payloads over HTTP — bind worker to loopback only
- **state:** closed
- **updated_at:** 2026-06-05T19:04:41Z
- **read_date:** 2026-07-04
- **findings:** New — a genuine **remote code execution** finding not in bug-case-catalog's security section (B1–B4). MIT's web server forwards translation work to a worker process by `pickle`-serializing the request and POSTing it; the worker does `pickle.loads()` on the request body (arbitrary code execution on attacker-controlled bytes is the textbook pickle-deserialization vulnerability). Root cause: `start_translator_client_proc` passed `--host <front-server-host>` straight through to the worker subprocess, so when the front server bound `0.0.0.0` (the default run config), the worker's pickle-accepting endpoints (`/simple_execute/*`, `/execute/*`) were also reachable from the network — turning a local IPC mechanism into an RCE exposure. Fix: `_build_worker_cmd` hard-codes the worker's `--host` to `127.0.0.1` regardless of the front server's bind host, independent of the public-facing bind. Documented as an explicit trust-boundary ADR note in `ARCHITECTURE.md` ("worker's pickle-accepting endpoints are loopback-trusted only, must never be exposed externally"). Strong candidate for the security slide — pickle RCE + accidental network exposure via bind-host propagation is a distinct vulnerability class from the MIME-spoofing (B1) and webhook-forgery (B3) cases already documented.

### Issue #102: Path traversal + unauthenticated result file endpoints allow arbitrary read/delete
- **state:** closed
- **updated_at:** 2026-06-05T18:57:27Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog. `GET /result/{folder_name}/final.png` and `DELETE /results/{folder_name}` built filesystem paths from an unvalidated `folder_name`; a name like `../etc` resolved outside the intended result directory, giving arbitrary file read (GET) and arbitrary directory deletion (DELETE) with no auth. Fix is a pure, dependency-light helper `safe_result_folder(root, folder_name)` in `server/path_utils.py` (no HTTP/ML imports — same testability-extraction pattern as `server/webhook.py`) that (1) rejects empty names or names containing `..`, `/`, `\` as a first cheap filter, then (2) resolves the path and calls `resolved.relative_to(root)` to also catch symlink attacks and encoded variants that slip past the string check — two-layer validation, not just a regex. Separately, the unauthenticated bulk-destructive `DELETE /results/clear` endpoint (no traversal risk itself, but destroys everything) was gated behind `MIT_ENABLE_RESULT_CLEAR=0` default-off, opt-in for standalone dev instances only.

### Issue #100: MIT Webhook delivery has no retry and swallows errors — computed Patch Sets lost permanently
- **state:** closed
- **updated_at:** 2026-06-05T18:56:20Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog. MIT fired webhooks with a single attempt; if the Backend was briefly unavailable (restart, overload), the webhook silently vanished and a chapter page's GPU-computed translation was lost with no record. Fix: `send_webhook` extracted to `MIT/server/webhook.py` — deliberately importing only `httpx`/`json`/`hmac` (no ML stack) so it unit-tests in <1s, the same "extract for testability" pattern called out in CLAUDE.md's North Star for `server/webhook.py`. Behavior: exponential-backoff retry only on transient failures (5xx/429/connection errors); non-retryable 4xx (e.g. 401/413) give up immediately; on final failure, emits a **structured JSON dead-letter log** (`event/taskId/pageIndex/reason`) instead of a silent drop — explicitly scoped out persisting dead-letters for replay as separate future work. Good concrete example of the CLAUDE.md-documented extraction principle traced back to its origin issue.

### Issue #75: MIT webhook HMAC signature never matches NestJS verification
- **state:** closed
- **updated_at:** 2026-06-05T20:02:44Z
- **read_date:** 2026-07-04
- **findings:** New — a cross-language interop bug not in bug-case-catalog. Three compounding problems in the MIT (Python) → Backend (NestJS) webhook HMAC scheme: (1) Python's default `json.dumps` inserts spaces (`{"a": 1}`) while Node's `JSON.stringify` doesn't (`{"a":1}`) — the HMAC bytes differ, so **every** webhook was rejected 401 whenever `MIT_WEBHOOK_SECRET` was set. (2) Python's `ensure_ascii=True` default encodes Japanese/Thai manga titles as `\uXXXX` escapes while JS doesn't, breaking signatures on any non-Latin content. (3) `crypto.timingSafeEqual` **throws** (not returns false) if the two buffers differ in length, so a malformed `x-mit-signature` header could crash the endpoint — a DoS vector. Fix: Python signs `json.dumps(payload, separators=(',',':'), ensure_ascii=False).encode('utf-8')` to byte-match JS's canonical form; NestJS compares buffer lengths before calling `timingSafeEqual`. A textbook "two languages' 'obviously equivalent' JSON serializers are not byte-identical" lesson — worth a slide alongside the ICC-profile color-pipeline case (catalog C3) as another instance of "the whole pipeline matters, not just the algorithm."

### Issue #74: handleMitCallback stores raw pixel coords as percentages
- **state:** closed
- **updated_at:** 2026-06-05T20:03:03Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog. `handleMitCallback` (the webhook-consuming path) stored `xPct: p.x` / `yPct: p.y` directly — i.e., raw pixel coordinates mislabeled and persisted as if they were already percentages — while `imgWidth`/`imgHeight` were present in the payload but never used to normalize. The already-working streaming path did this correctly, so the two code paths for the same conceptual operation had silently diverged (same class of bug as the catalog's C4 glyph-dedup case: copy-pasted/parallel logic drifting apart). Fixed with a `>0` guard against division by zero/NaN when `imgWidth`/`imgHeight` are 0, and switched the patch URL from a relative path to `backendOrigin`-prefixed absolute.

### Issue #78: TOCTOU race in startOrAttachBatchJob creates duplicate MIT batch jobs
- **state:** closed
- **updated_at:** 2026-06-05T20:02:48Z
- **read_date:** 2026-07-04
- **findings:** New — a second, distinct TOCTOU case not in bug-case-catalog (catalog's A1 TOCTOU is about wallet balance checks, a different subsystem). Two concurrent requests for the same `chapterId` both observed `activeBatchJobs.get(jobKey) === undefined`, then both `await`ed `cache.get()` *before* either called `activeBatchJobs.set()` — classic check-then-act race — resulting in duplicate GPU batch jobs for the same chapter. Fix: set a placeholder in `activeBatchJobs` **synchronously**, immediately after the `undefined` check and before any `await`, closing the race window entirely (no lock needed — just reordering the synchronous set ahead of the first yield point). Good second illustration of the TOCTOU pattern in a completely different subsystem (in-memory job registry vs. financial ledger), useful for a "this pattern recurs across the codebase" slide.

### Issue #187: refactor(MIT): decompose the MangaTranslator god object — stage orchestrators + explicit Context
- **state:** closed
- **updated_at:** 2026-06-11T07:57:52Z
- **read_date:** 2026-07-04
- **findings:** Mostly already covered — ADR 008 (`mit-god-object-characterization-byte-identical-seams.md`) and personal memory `feedback_decomposition_method`/`project_mit_refactor_resume` document the byte-identical/characterization-first/1-seam-1-commit method and the measured result (god object 3040→2235 LOC, −26.5%, 21 modules, tests +77%). New detail from the issue body itself not necessarily in those docs: the *specific* pre-refactor pathologies that motivated the work — `manga_translator.py` was ~3,200 LOC with `_run_text_translation` at ~296 lines (1097–1392) and `_run_textline_merge` at ~148 lines (810–957); detection/dispatch/retry logic was duplicated across two `_run_detection` call sites (~481 and ~1765) and ~3 dispatch sites; hidden instance state (`_current_image_context`, `all_page_translations`, MD5-based restore at ~1694) coupled pipeline stages and was **unsafe under concurrent batch runs** — a concrete example of why the decomposition mattered beyond "the file is long" (shared mutable instance state across concurrent requests, the same class of bug as catalog A4/E2).

### Issue #191: refactor(MIT): trim/replace vendored LDM (~3000 LOC) + YOLOv5 — license + maintenance debt
- **state:** closed
- **updated_at:** 2026-06-11T06:05:27Z
- **read_date:** 2026-07-04
- **findings:** New — a license/maintenance-debt decision not covered elsewhere (no ADR specifically documents vendored-code license auditing). Two large third-party codebases were vendored (copied in, not depended-on): `inpainting/ldm/**` (~3000 LOC, CompVis/StabilityAI Latent Diffusion Model, ~40% of it unused training/logging infra at inference time, requiring hand-diffed CUDA/PyTorch upgrades with no upstream fix flow-back) and `detection/ctd_utils/yolov5/**` (vendored Ultralytics YOLOv5, **GPL-licensed**, deprecated vs v8/v11, used internally by ComicTextDetector). The issue explicitly frames this as a license-compatibility audit question (GPL vendored code vs. project license), not just a code-quality one — the kind of "vendoring an old GPL dependency creates silent legal debt" story that's a good non-obvious addition to a tech-debt/architecture-decisions slide. (Comment thread was empty at read time — resolution/decision not confirmed in this issue; worth checking `docs/adr/` for whether SD/LDM inpaint was ultimately removed or kept-and-trimmed, since PRD #178 mentions the legacy SD/LDM code "is still present" as of 2026-06-13, i.e., a full removal did not happen.)

### Issue #178: PRD: Render Parity with MangaTranslator — manga-grade output (narrow-column layout, supersampling, vertical, safe-area, SFX, inpaint fidelity)
- **state:** open
- **updated_at:** 2026-07-03T03:10:15Z
- **read_date:** 2026-07-04
- **findings:** Largely covered by ADR 007 and memory `project_render_parity_direction`/`mit-refactor-progress.md` (the decided aesthetic: narrow-column mask-aware wrap, 4× supersampling, real vertical, SFX detection on). New/useful detail from the comment thread not necessarily elsewhere: a dated **status table** (2026-06-13) showing which of the 10 parity sub-features were done vs. remaining at that point (comic font #176 ✅, supersampling #181 ✅, bubble segmentation #170 ✅, bubble-fit #175 ✅, narrow-column #179 + clean_layout #264 ✅, font-size fidelity #166+#168+#263 ✅, render-layout #263 ✅, line-breaks-reference-source #264 ✅, inpaint fidelity #265/#266 ✅, SFX #168 ✅ — leaving only real-vertical #182, Knuth-Plass #180, flat-fill #174, and full OCR-rescue-ladder #172 open). A later comment (2026-07-02) documents a **regression discovered by the new deterministic-replay harness** (#462): "a Thai fill-the-balloon change oversized the English One-Punch narration" — i.e., a parity change for one target language silently regressed another, which is exactly the reason PRD #178 was resequenced to depend on the harness PRD (#462) before any further parity flag is flipped. As of PR #433 (latest comment), production render is judged in good shape on audited pages; remaining defects are reclassified as translation (LLM garble, romaji) and detection (SFX), not render — separate workstreams under Master Plan 2 (#528).

### Issue #167: bug(MIT): original-language text survives translation — detector misses white-on-black / busy-background regions
- **state:** closed
- **updated_at:** 2026-06-07T14:21:45Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog, and a genuinely good scientific-method case study. The hypothesis going in (from the issue body) was that the **detector** misses light-on-dark text and needs rescue knobs (`det_invert`, `det_gamma_correct`, lower `text_threshold`) that upstream ships but MangaDock's Backend never enables. The diagnosis (a live measurement session, not speculation) **rejected that hypothesis**: on the worst annotated page, detection found all 8/8 textlines under every knob variant tested — the rescue knobs changed nothing. The real cause was the 48px **OCR model's confidence threshold**: default `ocr.prob` kept only 5/8 lines; re-running at `prob=0.01` recovered all 8, and the "lost" lines OCR'd nearly correctly, revealing the model is systematically **underconfident on long, thin textlines** (aspect ratio ≈35:1). Fix: expose `MIT_OCR_PROB` as the primary deployment knob (shipped at 0.03, tuned to the specific worst-measured line at 0.035), with the originally-suspected detector knobs kept as secondary/opt-in since they're not useless on other page classes, just not the cause here. Live E2E re-verification after cache-clearing confirmed 8/8 lines now translate. Excellent example of "measure before fixing" overturning the initial hypothesis — a strong candidate for a debugging-methodology slide.

### Issue #154: fix(translate): batch translation reports dead-worker failures as success across all layers
- **state:** closed
- **updated_at:** 2026-06-06T11:58:12Z
- **read_date:** 2026-07-04
- **findings:** Partially covered — the OSError 1455 (commit-memory exhaustion) root cause is already in personal memory `project_dev_commit_memory.md`, but the **fix architecture** here is new and not documented elsewhere. Incident: the MIT worker crashed loading Qwen3.5-4B (host RAM+pagefile exhausted, VRAM 11GB→1-2GB in one second) and every layer above it then lied about success: the dead worker stayed registered so `/ready` kept returning 200; the batch loop turned every page's connection-refused into a per-page `error` webhook; the Backend counted errored pages as "completed" and logged `fully completed via webhooks`; the Reader counted every error event as a translated page. A 20-page batch "completed" in 40s with **zero** translations and no visible error — discoverable only by reading server logs. The fix is three independent truthfulness layers, each separately verifiable: (1) MIT's `/ready` now actively probes each registered worker's new `GET /health` and returns 503 `workers_unreachable` if none respond (a busy worker still counts alive without probing, since mid-inference can block its own event loop); (2) Frontend passes per-page errors through, excludes them from the "completed" set so re-translating retries only the failed pages, and shows a `✕N` failed counter + toast; (3) Backend's completion log says `completed via webhooks with N/total page errors (first: <error>)` instead of an unconditional success message. Good example of a single failure cascading through 4 layers, each silently converting failure into apparent success, and a symmetric 3-layer fix.

### Issue #164: bug(reader): switching page view ⇄ continuous strip hides every "translating" indicator while a translation is running
- **state:** closed
- **updated_at:** 2026-06-07T12:40:36Z
- **read_date:** 2026-07-04
- **findings:** New — not in bug-case-catalog, and another good methodology example: static code reading could not localize the cause (both paged/continuous render paths read the same shared hook state), so the issue explicitly called for a **live reproduction** step before attempting a fix. The live repro (real batch translation, Playwright against production tunnel) found that **no state was actually lost** in either view-switch direction — the bug was a pure UX gap: the floating status pill (progress/ETA/stage) was only ever rendered in the paged-mode branch, never in continuous mode, so when the viewport sat on already-finished pages the user had no visible signal a background translation was still running. Fix: hoist the pill to the Reader root so it renders above both view modes. A clean illustration of "don't fix a hypothesis, reproduce first" — the initial suspicion (shared state being reset somewhere) was wrong; the actual defect was in render-path asymmetry, not state management.

### Issue #129: perf(MIT): page-granular cancellation + single-worker starvation — decide interruption strategy
- **state:** closed
- **updated_at:** 2026-06-05T17:33:12Z
- **read_date:** 2026-07-04
- **findings:** New — an explicit HITL (human-in-the-loop) architecture-decision issue, useful for a "how we make architecture trade-off calls" slide. Problem: MIT only polls `is_cancelled` at page boundaries (~60-100s per page), so a single-page translate request submitted right after a cancel can appear to "not work" because the one worker process is still finishing the old batch's current page — and the single-page endpoint didn't check `is_cancelled` at all, confirmed in code. Three options were laid out with explicit trade-offs: (a) accept the page-level latency and just improve Frontend UX messaging — cheapest, no worker changes; (b) checkpoint cancellation into pipeline sub-stages (detect→ocr→inpaint→render) for faster cooperative interrupt — more invasive; (c) add a second worker or preemption to stop batch jobs from blocking short single-page jobs — highest VRAM/complexity cost. The issue explicitly notes *why* mid-inference interruption is risky: a prior real incident of `forrtl error 200` crashing the worker when a TCP connection was killed mid-BLAS-computation. (Comment thread was empty at read time, so which option (a/b/c) was ultimately chosen isn't recorded in this issue — worth checking `MIT/ARCHITECTURE.md` for the resulting ADR note.)

### Issue #146: fix(books): patch cache v4 entries outlive the legacy files PatchStore sweeps — overlays 404
- **state:** closed
- **updated_at:** 2026-06-07T06:32:13Z
- **read_date:** 2026-07-04
- **findings:** New — a distinct cache-coherency case from bug-case-catalog's A2 (stale L1 replay) and A5 (dead pub/sub); this one is about **sweep/cache incoherence across a migration boundary**. When PatchStore (#137/#144) introduced deterministic patch filenames, its `sweepLegacy()` cleanup deleted 140 old legacy-named files on disk — but Redis patch-cache v4 entries still pointed at those now-deleted filenames for up to 7 days (their TTL), so cache replay served 404s while the Reader still showed "แปลแล้ว" (translated) with blank overlays, and re-translating hit the same stale cache entry with no way out for the user. Root cause explicitly framed as "sweep and cache are not coherent" — `sweepLegacy()` reasons only about filenames on disk, blind to the cache entries referencing them. Fix considered and rejected an alternative (stat the file on every cache hit — "adds an fs stat to the hot path forever to solve a one-time migration problem") in favor of the actually-shipped one-line fix: bump the cache-key version `v4`→`v5` (mirroring an identical v3→v4 precedent from #87), instantly invalidating every stale entry with old ones expiring naturally via TTL — a "self-healing on upgrade" migration pattern worth noting alongside catalog A2's ordering lesson.

### Issue #528: epic(MIT): Master Plan 2 — toward human-level translation quality
- **state:** open
- **updated_at:** 2026-07-03T19:51:39Z
- **read_date:** 2026-07-04
- **findings:** New — the current active roadmap epic, best material for a thesis "future work" slide. Framed as a comprehensive defect-driven campaign (render + detection + translation + layout + OCR) constrained to a single 12GB GPU, with SAM/Flux deliberately excluded as out of budget. Reviewed by 4 independent reviewers (fable-5, clink, codex, agy) who unanimously recommended "fix-then-ship." 12 numbered clusters map to specific issues with explicit priority/gating relationships — notably cluster P3 (promote `reference_layout`) is explicitly **gated on** cluster P4's polygon-spill keystone metric (#525) going green across a corpus before the flag can be flipped, and P2 (RollingContext) is blocked on a cache-safety fix (#524) landing first. The PRD encodes a hard-gate checklist for every cluster (benchmark tied to the specific defect described in its own markdown; before=symptom, after=confirmed-gone; patch endpoint not image endpoint; deterministic replay; full-res + user-confirm on any render-visible change; ADR + impact report required) — this is the operationalized form of several standing team-memory rules (`feedback_benchmark_confirms_md_defect_fixed`, `feedback_benchmark_patch_not_image_endpoint`, `feedback_impact_report`) baked directly into a PRD's acceptance gate. Execution-progress comment (2026-07-04) shows P1 (readable-floor) and P4's keystone metric and P8 (Knuth-Plass, flag-gated) already shipped behind default-OFF Backend flags, with production enable pending an operator decision once #525 is green.

### Issue #420: fix(MIT): translate pipeline is non-deterministic — boxes drop out randomly (OCR/detect sampling)
- **state:** open
- **updated_at:** 2026-06-28T19:02:50Z
- **read_date:** 2026-07-04
- **findings:** Already covered in personal memory `project_mit_translate_nondeterministic.md` (same core finding: re-running translate on identical input/config produces different box counts/wording). New precise measurement from the issue body not necessarily in that memory note: on Kouchuugun ch1 p0 (Thai target), POSTing identical config to `/translate/with-form/patches` repeatedly produced **4/7/7** patches with a background-reground fix OFF and **7/6/4** with it ON — i.e. the non-determinism is independent of the render-stage knob being tested, isolating the root cause to the **OCR-VLM rescue and/or LLM translate/cluster sampling steps**, not rendering. This directly explains why in-app A/B testing of render-stage changes is confounded (patches don't correspond 1:1 between runs) and motivates the team's standing practice of using offline deterministic dumps for render A/B instead of live in-app toggling. Proposed (not yet scoped) direction: pin temperature/greedy-decode for OCR-VLM rescue and translation, make detection→cluster ordering stable, and add an N-run determinism regression test.

---

## Additional issues recorded for provenance (already fully covered elsewhere, no new fetch needed)

These appeared as candidates during the title skim but their substance is already fully documented in
`bug-case-catalog.md` / ADRs, so their full bodies were not re-fetched — recorded here only so a
future pass knows they were considered and doesn't re-investigate them.

### Issue #303: fix(Backend): upload path skips file-type magic-byte validation — trusts client Content-Type
- **state:** closed
- **updated_at:** 2026-06-18T02:54:25Z
- **read_date:** 2026-07-04
- **findings:** already covered in bug-case-catalog.md (B1) + ADR 016 — MIME-spoofing bug, magic-byte fix via `fileTypeFromFile`, no new info.

### Issue #156: fix(Frontend): translated patches are generated from a different image derivative than the Reader displays — visible tone mismatch
- **state:** closed
- **updated_at:** 2026-06-07T06:32:10Z
- **read_date:** 2026-07-04
- **findings:** already covered in bug-case-catalog.md (C3, ICC profile patch darkening) — no new info.

### Issue #189 / #190: refactor(MIT): deduplicate glyph rendering / decompose resize_regions_to_font_size + render() box-padding
- **state:** closed
- **read_date:** 2026-07-04
- **findings:** already covered in bug-case-catalog.md (C4, glyph dedup exposing a latent vertical-stroke clip bug) — no new info.

### Issue #111: fix(MIT): Pipeline utils bugs — wrong prob-normalization denominator + broken TextBlock defaults
- **state:** closed
- **read_date:** 2026-07-04
- **findings:** already covered in bug-case-catalog.md (E3, merged-probability denominator typo: `textlines` count vs `txtlns` list) — no new info.

### Issue #193: refactor(MIT): harden --start-instance worker lifecycle (port offset, PID tracking, orphan cleanup)
- **state:** closed
- **read_date:** 2026-07-04
- **findings:** already covered in bug-case-catalog.md (D1) + personal memory `project_mit_worker_restart_gotcha.md` — no new info.

### Issue #197 (referenced by #198): critical hotfix for the R2 /v1/list cost bug
- **state:** closed (merged, not separately re-fetched — see #198 above)
- **read_date:** 2026-07-04
- **findings:** already covered in bug-case-catalog.md (A3) + system-impact-report.md — no new info beyond what #198's tracking summary already gives.
