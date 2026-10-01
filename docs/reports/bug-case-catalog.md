# MangaDock — Bug & Engineering Case Catalog (War Stories)

> Curated catalog of notable bugs and engineering cases hit during development, for the academic
> presentation/report. Each entry: **symptom → root cause → fix → the lesson**. Sourced from
> `DONE.md`, `docs/reports/system-impact-report.md`, `MIT/PIPELINE.md`, the `.claude/memory/` notes,
> and git history. Companion to `positioning-differentiation-legal.md`.

---

## ⭐ Top 8 for the slide deck (pick these)

These have the clearest "real CS concept" hook for a viva audience:

| # | Case | The CS concept it demonstrates |
|---|---|---|
| 1 | **Wallet double-spend → PostgreSQL RPC** | TOCTOU / atomicity / DB-level transactions |
| 2 | **3-layer cache stale replay** | Cache coherency & invalidation ordering |
| 3 | **Upload magic-byte MIME** | Input validation / defense-in-depth done wrong then right |
| 4 | **R2 list-call cost bleed** | Overfetching & invisible infra cost; guard on the hot path |
| 5 | **MIT worker orphan / stale code** | Process lifecycle, `atexit` vs signals, `.pyc` cache |
| 6 | **Translation context cross-page bleed** | Shared mutable state in an async multi-tenant server |
| 7 | **Node 26 × Jest 30 / `setTimeout` undefined** | Toolchain version incompatibility (found while adding CI) |
| 8 | **Global `MODEL` in detection forward** | Concurrency hazard from global mutable state |

---

## A. Cache & Distributed Systems

### A1. Wallet double-spend / TOCTOU → atomic PostgreSQL RPC
- **Symptom:** balance checks and debits done in application code could double-spend under concurrent unlock/topup.
- **Root cause:** check-then-act across the network (read balance → decide → write) — a classic **Time-Of-Check-To-Time-Of-Use** window.
- **Fix:** moved the money math into **PostgreSQL RPCs** (`add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic`) so check+debit is one atomic DB transaction; unlock is idempotent.
- **Lesson:** correctness-critical money logic belongs at the **database transaction** layer, not the app layer. *(SYSTEM_ARCHITECTURE_OVERVIEW §2.6)*

### A2. Three-layer cache stale replay (`cache:reset` ordering)
- **Symptom:** after fixing a bug + running `npm run cache:reset`, testers still saw the **old** translated pages — "the fix didn't work" false negative.
- **Root cause:** L1 (in-memory) survives if the process isn't killed; resetting L3/Redis while the backend lives lets L1 **re-flush stale data back into L3**.
- **Fix:** enforce ordering — **kill backend → `cache:reset` → relaunch**.
- **Lesson:** layered caches need **explicit invalidation ordering**; an invisible in-process cache is the trap. *(`project_cache_reset_ordering.md`)*

### A3. R2 list-call cost bleed (overfetching)
- **Symptom:** ~507 `GET /v1/list` calls in 46 min to Cloudflare R2 (expensive Class-A ops), invisible to logging — cost compounding with usage.
- **Root cause:** `attachLocalStatus` did one R2 list **per chapter on every chapter-list load**, including cache-hit paths, ungated.
- **Fix:** gate the fan-out — only probe when `imageCache.enabled && (forceLocal || offlineFallback)`; default browsing now fires **0** calls. RED→GREEN tested.
- **Lesson:** "feature works" ≠ "feature is economical"; guard expensive I/O on the hot path. *(impact-report 2026-06-10, #197)*

### A4. Translation context cross-page / cross-job bleed
- **Symptom:** translating manga A then B → A's context polluted B's translation.
- **Root cause:** cross-page lists lived on the long-lived worker `MangaTranslator` singleton and were never reset between jobs — **shared mutable state** across tenants.
- **Fix:** extracted `TranslationMemory`; `reset_page_context()` always runs first in `translate_patches`; per-job session is the planned full isolation (#140).
- **Lesson:** in async multi-tenant servers, make state boundaries **explicit** and reset them deterministically. *(#136/#140; PIPELINE.md L9)*

### A5. Dead Redis pub/sub limb
- **Symptom:** batch pub/sub code published to **no subscriber** — dead code accruing risk.
- **Root cause:** designed for multi-node, deployed single-node; the subscribe side was a no-op.
- **Fix:** removed the limb (decomposition seam S5a) + ADR documenting the single-node assumption.
- **Lesson:** don't anticipate scale; encode the assumption and remove dead paths. *(#234 S5a, ADR 002)*

---

## B. Security

### B1. Upload MIME spoofing (defense-in-depth done wrong)
- **Symptom:** a `<script>` payload sent as `Content-Type: image/png` passed **both** validation gates and was stored as `.png`.
- **Root cause:** both Multer's fileFilter and the service re-checked the **client-supplied** Content-Type — checking the same attacker-controlled value twice.
- **Fix:** read **magic bytes** off disk with `fileTypeFromFile`; detected MIME drives the stored type. TDD reject-test.
- **Lesson:** validating the same untrusted input twice ≠ defense-in-depth; trust the **bytes**, not the header. *(#303, ADR 016)*

### B2. Turnstile silent bypass (fail-open config)
- **Symptom:** missing `TURNSTILE_SECRET_KEY` in prod silently fell back to Cloudflare's **public test key** (always-pass) → CAPTCHA/zero-trust layer off.
- **Root cause:** inlined `process.env.X || '<public-test-key>'` default.
- **Fix:** `resolveTurnstileConfig` **fails at boot** if the secret is missing in prod; exact-origin allow-list (not substring).
- **Lesson:** security config should **fail-closed** — refuse to boot rather than silently degrade. *(#224–227)*

### B3. Payment webhook forgery (Xendit)
- **Symptom:** a forged "topup confirmed" webhook could mint coins if the HMAC secret was unset/known.
- **Root cause:** HMAC verified only when the token env was set (skippable).
- **Fix:** fail-closed on missing secret; `UNIQUE(payment_id)` idempotency guards double-credit on retry.
- **Lesson:** payment integrations need **mandatory** signature verification + idempotency. *(impact-report 2026-06-19)*

### B4. Image URL XSS
- **Symptom:** user image URLs could be `javascript:`/`data:` payloads in `<img src>`/`<a href>`.
- **Fix:** protocol-prefix regex → replace unsafe scheme with `#`.
- **Lesson:** sanitize URL **schemes** before sinking user input into the DOM. *(CLAUDE.md patterns)*

---

## C. Translation & Rendering

### C1. `findHomography` crash on degenerate quads
- **Symptom:** pages with near-collinear/zero-area text regions crashed the renderer.
- **Root cause:** `cv2.findHomography` returns `None` on degenerate input; the result was dereferenced unguarded.
- **Fix:** null-check → fall back to effective render direction.
- **Lesson:** ML outputs (region detection) produce edge cases; matrix ops need **null guards**. *(#110)*

### C2. Bubble overflow & tiny-font (a 3-layer geometry bug)
- **Symptom:** translated text overflowed balloons, stacked on co-occupants, or rendered ~3–4px.
- **Root cause:** three compounding issues — crop-derived font floor (#166), no anti-overlap clamp (#175), render box = AABB not bubble interior (#179).
- **Fix:** binary-search bubble-fit font; margin'd wrap + overfill cap; distance-transform **safe-area interior** (pole-of-inaccessibility) wrap. All knob-gated → byte-identical off.
- **Lesson:** a visible defect can be **several bugs in different layers**; golden-pixel tests + knobs make render experiments safe. *(#166/#175/#179)*

### C3. ICC profile patch darkening
- **Symptom:** every translated patch was ~10–16 grey-levels darker than the page.
- **Root cause:** scans embed a GRAY "Dot Gain 20%" ICC profile; the browser color-manages the page but renders the **untagged** patch as sRGB → darker.
- **Fix:** carry the source ICC into every patch encode; GRAY profile → encode mode `LA`.
- **Lesson:** pixel-perfect compositing requires the whole **color pipeline**, not just geometry. *(#156)*

### C4. Glyph dedup exposes a latent vertical-stroke clip bug
- **Symptom:** vertical strokes mis-aligned when clipping a top/left edge; horizontal path was correct.
- **Root cause:** two ~200-line near-duplicate functions diverged; the vertical paste clamped/sliced differently.
- **Fix:** extract shared `_render_glyph_stroke`/`_paste_bitmap` helpers; bug fixed as a byproduct; golden-pixel net (9 glyphs × 2 dirs × border).
- **Lesson:** copy-pasted code **will** diverge into bugs; dedup + golden tests on pixel-critical paths. *(#189/#190)*

### C5. Lang-ratio false "translation failed" on sparse pages
- **Symptom:** sparse pages (a title + 2 lines) falsely flagged as failed.
- **Root cause:** the script-ratio QC check fired below its intended region floor on sparse data.
- **Fix:** explicit per-script counting + ≥6-region gate; 7 unit cases.
- **Lesson:** validation heuristics need **explicit thresholds**; sparse-data edge cases inflate false-positive rates. *(#109)*

### C6. SFX & semantic-bubble detection limits (ensemble fix)
- **Symptom:** stylized onomatopoeia (ぬ〜, ゴゴゴ) and overlapping balloons mis-handled by the default DBNet detector.
- **Root cause:** DBNet detects pixel-level text lines, not **semantic** SFX/bubbles.
- **Fix:** opt-in second-stage detectors — YOLOv8-seg for bubbles (#170), AnimeText YOLO for SFX (#168), VLM-OCR rescue for unreadable large glyphs.
- **Lesson:** a single detector can't cover out-of-distribution inputs; **cascade/ensemble** when needed (and admit partial success). *(#168/#170)*

---

## D. Infrastructure & Process

### D1. MIT worker orphan + port collision + stale code
- **Symptom:** restarting the worker on a busy port hung `/register` forever; a leaked worker kept serving **old** code.
- **Root cause:** no port-free pre-check; uvicorn clobbers the signal handler registered before `run()`; `.pyc` module cache persists across a partial restart.
- **Fix:** `port_is_free`/`ensure_worker_port_free` (fail loud, name both ports); `atexit.register(terminate_process)` as the cleanup backstop; restart **both** ports.
- **Lesson:** signals aren't reliable when libraries override them — `atexit` is the backstop; process death ≠ clean slate in Python. *(#193; `project_mit_worker_restart_gotcha.md`)*

### D2. Node 26 × Jest 30 — `setTimeout is not defined`
- **Symptom:** the full backend Jest suite crashed mid-run with `ReferenceError: setTimeout is not defined`.
- **Root cause:** **Jest 30 doesn't support Node 26** (the dev box's version); its sandbox doesn't expose timers.
- **Fix:** pin CI + local to **Node 22 LTS** (nvm-windows); discovered while standing up CI.
- **Lesson:** "works on my machine" failures are often **toolchain version** mismatches; pin the runtime. *(CI work, 2026-06-28; ADR 020)*

### D3. `jest.spyOn(global,'fetch')` deletes the lazy global
- **Symptom:** the 2nd test in a suite threw "Property `fetch` does not exist".
- **Root cause:** Node exposes `fetch` as a lazy global; `spyOn` + `restoreAllMocks()` deletes it, so the next `spyOn` finds nothing.
- **Fix:** assign `global.fetch` directly + save/restore a reference (TDD RED→GREEN).
- **Lesson:** mocking lazy/host globals via `spyOn` is fragile; assign+restore. *(books-health, ADR 020)*

### D4. `npm ci` broken on a stale lockfile
- **Symptom:** CI failed at `npm ci` — "Missing … from lock file".
- **Root cause:** `Backend/package-lock.json` was stale vs `package.json`; the repo is actually built with **bun** (`bun.lock`).
- **Fix:** CI uses `bun install --frozen-lockfile` to match how the repo is built.
- **Lesson:** CI must mirror the **real** build tool; a second, unmaintained lockfile silently rots. *(ADR 020)*

### D5. Pydantic `parse_raw` deprecation across 11 sites
- **Symptom:** 11 call sites used a Pydantic-v1 API removed in v3.
- **Fix:** one `parse_and_validate_config` seam using `model_validate_json`; characterization test `new(j)==old(j)`.
- **Lesson:** centralize a parse path so a migration is **one** change, not eleven. *(#192)*

---

## E. Backend Architecture (async correctness)

### E1. Latecomer SSE-listener leak on job reject
- **Symptom:** on batch-job rejection, SSE listeners hung until timeout.
- **Root cause:** the error path deleted the listener after an `await` that could throw, skipping cleanup (no `try/finally`).
- **Fix:** `finally → finalize()` drains late listeners and marks complete.
- **Lesson:** `try/finally` cleanup is **non-negotiable** in async orchestrators. *(#234 S5d)*

### E2. Global `MODEL` on the detection forward path
- **Symptom:** concurrent detector loads could clobber a module-global model → wrong outputs.
- **Root cause:** `det_batch_forward_default` read a module-level `MODEL` instead of receiving it.
- **Fix:** thread the model explicitly via `DispatchRegistry` (S22); remove the global.
- **Lesson:** global mutable state on a hot path is a **concurrency hazard** even when it's "just a cache." *(S22)*

### E3. Merged-probability denominator typo
- **Symptom:** wrong confidence on every multi-line bubble.
- **Root cause:** summed `textlines` (a count) instead of `txtlns` (the list) — a one-token typo that looked "reasonable."
- **Fix:** one-char correction; carried as a documented fork patch.
- **Lesson:** plausible-but-wrong outputs hide bugs; test **aggregated values**, and document vendored-fork fixes. *(#111)*

---

## F. Frontend / UX

### F1. Spoiler-blur won't transition
- **Cause:** Tailwind `blur-sm`/`blur-0` use `--tw-blur` custom properties browsers don't transition reliably.
- **Fix:** inline `style={{ filter:'blur(4px)', transition:'filter .5s ease' }}`.
- **Lesson:** some critical animations need the raw CSS property, not a utility abstraction. *(CLAUDE.md)*

### F2. Modal enter-animation skips
- **Cause:** adding the animation class in the same tick as insertion lets the browser optimize the transition away.
- **Fix:** double `requestAnimationFrame` for enter; `setTimeout` for exit.
- **Lesson:** animation correctness requires understanding the browser **paint cycle**. *(CLAUDE.md)*

---

## Theme summary

| Theme | Cases | Headline lesson |
|---|---|---|
| Cache & Distributed | A1–A5 | atomicity, cache-coherency ordering, overfetch guards, explicit state boundaries |
| Security | B1–B4 | trust the bytes; fail-closed; mandatory signatures; sanitize schemes |
| Translation/Render | C1–C6 | null-guard ML outputs; multi-layer geometry bugs; full color pipeline; ensemble detectors |
| Infra/Process | D1–D5 | atexit backstop; pin toolchains; mirror the real build; centralize migrations |
| Async backend | E1–E3 | try/finally; no global mutable state on hot paths; test aggregates |
| Frontend/UX | F1–F2 | raw CSS for critical motion; respect the paint cycle |

> Raw, fuller catalog (with extra cases and exact commit refs) was produced during research and can be
> expanded from `DONE.md` + `system-impact-report.md` if the presentation needs more depth.
