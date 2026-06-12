# MangaDock — System-Impact Change & Tech-Debt Report

> Curated, report-level record of changes that **affect the running system** plus the **tech-debt
> register**. Audience: team / stakeholders / status reports. The chronological dev log lives in
> `DONE.md` (and `MIT/PIPELINE.md §5` for MIT internals); this file is the higher-level summary you
> pull a report from. Append a dated section per significant batch; keep entries terse + linkable.
>
> **Required fields per system-affecting change** (write "not measured" / "N/A" honestly — never
> fabricate numbers): **What & where** (component / file:line) · **Why** (problem/goal) ·
> **Before → After** (concrete observable difference) · **Performance Δ** (latency / VRAM / tokens,
> if measured) · **Quality** (correctness / render-fidelity / UX vs the target) · **Validation**
> (tests / E2E / benchmark / golden) · **Risk / rollback** (opt-in? byte-identical? knob) · **Links**
> (issue #, commit). The summary table below is the index; the "Before → After" blocks carry the full
> detail for headline changes.

---

## 2026-06-13 — PRD#1: Backend security hardening (Turnstile/HWID guards) — #223 (#224–#227)

**Severity:** major (cost-bleed + information-disclosure on the expensive MIT surface) · **Branch:** `dept/backend` (off `origin/main`), 4 commits, not yet PR'd. Derived from the read-only Backend security audit in issue #223. **TDD throughout** (RED→GREEN per step); `/security-review` on the full diff returned **no findings ≥0.7**.

### Summary (index)
| Step | What & where | Before → After | Validation | Commit |
|---|---|---|---|---|
| #224 | Fail-closed Turnstile config — new `auth/turnstile.config.ts` (`resolveTurnstileConfig`), wired in `turnstile.guard.ts`, `books.controller.ts` (verify-captcha), boot check in `main.ts` | missing `TURNSTILE_SECRET_KEY` silently fell back to the public test key (always-pass siteverify + forgeable HMAC) → **prod now refuses to boot** on missing/test secret; `TURNSTILE_ENABLED=false` ignored in prod | 9 unit (fail-closed matrix, mirrors `storage.module.spec.ts`) | `21423bf` |
| #225 | Validate `X-Hardware-Id` shape — `common/middleware/hardware-id.middleware.ts` (`isValidHardwareId`) | presence-only check (any garbage passed zero-trust) → shape check `/^[A-Za-z0-9_+/=-]{8,128}$/`, rejects array/whitespace/control/injection with 401 | 42 unit (valid/empty/malformed/array/passthrough + pure fn) | `9527a35` |
| #226 | Sanitize `AllExceptionsFilter` — `common/filters/all-exceptions.filter.ts` + 2 controller catches in `books.controller.ts` | raw internal error message + MIT error leaked to client on 500 → generic `Internal server error` / `Translation failed`; real message+stack logged server-side; HttpException + Supabase-503 preserved | 3 filter unit (generic / passthrough / 503) | `9dadb57` |
| #227 | Guard 3 MIT endpoints + frontend clearance — `@UseGuards(TurnstileGuard)` on `translate/manga`, `…/translate-patches`, `…/batch-translate-patches`; `Frontend` global fetch interceptor (`SupabaseGuard.tsx`) attaches `x-captcha-clearance` via new pure `app/lib/zeroTrustHeaders.ts` | expensive ML/R2 pipeline reachable with only a non-empty HWID header → each requires valid HWID-bound clearance; cheap `GET translate` (description) stays open | 7 backend e2e (401-without / proceeds-with per endpoint) + 5 frontend bun (header helper) | `5a81942` |

### Before → After (headline, full fields)

**#224 · Fail-closed Turnstile (the headline security fix)** — *What/where:* `resolveTurnstileConfig(env)` (`auth/turnstile.config.ts`), consumed by `TurnstileGuard.canActivate` and the verify-captcha handler; boot enforcement in `main.ts:bootstrap` *before* `NestFactory.create`. *Why:* both call-sites inlined `process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'` (Cloudflare public test key) — a forgotten secret made siteverify always pass **and** signed the HMAC clearance with a publicly-known key, so the whole captcha/zero-trust layer was silently bypassable and the token forgeable. *Before → After:* missing/test secret in prod = silent always-pass → **loud crash at boot**; outside prod the test key + `TURNSTILE_ENABLED=false` still work (dev unblocked). The `|| <test-key>` fallback is gone from both sites (grep-verified: only the constant definition remains). *Performance Δ:* N/A (string resolution per request, negligible). *Quality:* invisible to a correctly-configured deploy; reader flow unchanged. *Validation:* 9 unit covering the full prod/non-prod × missing/test/real × enabled-flag matrix. *Risk/rollback:* fail-closed (a real prod secret was always required to function correctly); revert = 1 commit. *Links:* #224, `21423bf`.

**#227 · Captcha guard on the expensive surface + reused clearance** — *What/where:* `TurnstileGuard` applied to the three MIT-triggering endpoints in `books.controller.ts`; `Frontend/app/components/SupabaseGuard.tsx` global `window.fetch` interceptor now injects `x-captcha-clearance` (from `localStorage.cf_clearance_token`) alongside the existing `x-hardware-id`, via the extracted pure `withZeroTrustHeaders()` helper. *Why:* only the cached-page endpoint was guarded; single-page, batch, and manga-text translation ran the ML/LaMa + R2 pipeline for any caller with a non-empty HWID header — and the batch job keeps running after disconnect, amplifying cost (compounds the R2 concern in #197). *Before → After:* anonymous → **401** on all three; legitimate readers reuse the clearance they already obtained for page serving → **no UX change**; description translation on catalog cards stays open (pre-auth). *Performance Δ:* not measured (guard is a cheap HMAC verify). *Quality:* reader path preserved; defense matches the page endpoint. *Validation:* 7 backend e2e (focused TestingModule, mocked service) assert 401-without / 200-201-with per endpoint + description-open; 5 frontend bun on the header helper. **Live Playwright E2E deferred** (per owner decision — to be run before merge). *Risk/rollback:* a client missing/with-expired clearance gets 401 on translate (re-solve captcha re-issues it); revert = 1 commit. *Links:* #227, `5a81942`.

### Open follow-ups (not in this batch)
- Live Playwright/tunnel E2E of the reader+translation path (original↔translated) before PR — owner-deferred.
- `console.error` used for the new server-side error logging in `books.controller.ts` (matches existing file style); will fold into the `console.* → Logger` sweep in #240.
- `notify.ps1` toast errored on this run (`LoadXml` HRESULT `0xC00CE502`) — unrelated to this PRD; flag for the dev-notification script.

---

## 2026-06-10 — HOTFIX (critical): per-chapter Cloudflare Worker `/v1/list` cost-bleed

**Severity:** critical (unbounded Cloudflare R2 Class-A op spend) · **Branch:** `hotfix/r2-list-amplification` → `main` (PR #197, squash `01affd5`).

*Post-mortem (bug):*
- **Symptom.** The Cloudflare Worker (`mangadock-worker.akkanop2549.workers.dev`) was receiving a flood of `GET /v1/list?prefix=img-cache/_chapters/chapters/<chapterId>/`. Our backend log showed **507 `GET /books/manga/<id>/chapters` requests in 46 min** (~11/min, across the home-grid manga) — and the R2 provider does not log its outbound calls, so the spend was invisible on our side.
- **Root cause.** `MangaDexService.attachLocalStatus` (mangadex.service.ts) did `Promise.all(chapters.map(ch => imageCache.hasChapterCache('_chapters', ch.id)))` — **one R2 `/v1/list` per chapter** — and it ran on **every** chapter-list load, *including the Redis cache-HIT path* (line 99) and the fresh/stale paths (162/166/172). It was **not gated by `forceLocal`** (only `imageCache.enabled`, which is true on the R2 dev/prod config). So an **N-chapter manga cost N Class-A list ops per load**, multiplied by every (re)fetch (the home grid re-fetches per card, frontend uses raw `fetch()` bypassing the apiCache). Example: a 83-chapter manga × ~50 re-fetches ≈ 4,800 list ops; whole grid ≈ tens of thousands per session. **Unbounded** — grows with chapter count × open count.
- **Why it was safe to gate.** `readerAvailable` is consumed by the UI **only** when `forceLocal` (offline toggle) or `isOfflineFallback` (stale cache while MangaDex is down) is set — `HeroDetailButton.tsx:33` (`if (forceLocal || ch.isOfflineFallback) … else pageCount>0`) and `BookDetailModal` (`chapterNeedsBackup === ch.isOfflineFallback`). The frontend only sends `?forceLocal=true` when the toggle is on. So computing `readerAvailable` during default browsing was pure waste.
- **Fix (before → after).** Gate the fan-out: `attachLocalStatus(chapters, isOfflineFallback, forceLocal)` now computes `readerAvailable` (the per-chapter `/v1/list`) **only when `imageCache.enabled && (forceLocal || isOfflineFallback)`**; otherwise returns `readerAvailable:false` with **zero** worker calls. `forceLocal` is threaded into all 4 call sites. *Before:* every chapter-list load = N `/v1/list`. *After:* default browsing = **0**; offline/forceLocal flows unchanged (still compute it, exactly as the UI needs). **Mirrors the frontend's own consumption condition → zero UI regression.**
- **Validation.** `mangadex-reader-available.spec.ts` (3 cases, RED→GREEN): default browsing fires 0 `hasChapterCache`; `forceLocal=true` fires exactly N; disabled fires 0. Typecheck clean for `mangadex.service.ts` (the unrelated `.spec.ts` TS errors are pre-existing).
- **Part B (asked alongside):** main's Cloudflare R2/Worker storage **is fully merged** into the working branch (`git merge-base --is-ancestor origin/main HEAD` true; zero diff over `common/storage`). The bug is a pre-existing **design defect in the merged code**, not a merge gap — which is why this hotfix targets `main` directly.
- **Risk / rollback:** Low — one method + 4 call sites; behaviour preserved for the only paths that read `readerAvailable`; revert = single commit.
- **Follow-ups (backlog, not in this hotfix):** route the frontend chapter-list fetch through `apiCache` (kill the ~11/min re-fetch); Redis-cache the `readerAvailable` set; in-flight dedup on `storage.list`; `CloudflareR2Provider.list` outbound logging + failure backoff; the flat `_chapters` namespace → per-manga (enables N→1 list).

---

## 2026-06-10 — MIT god-object decomposition stack (S13–S18) + test-pollution fix + E2E

Branch: `refactor/mit-seam-s17-text-translation-dispatcher` (stacks S13/S16/S17/S19/S21/S18 on the
landed S1–S12 work). Every seam is a **byte-identical** extraction behind characterization tests —
**zero runtime behaviour change**; the value is tech-debt: the ~3000-line `manga_translator.py` god
object shedding internals into small, unit-tested modules. Per-seam detail: `MIT/PIPELINE.md §5`
(decomposition subsection), `docs/reports/mit-refactor-progress.md`, `DONE.md`.

### Shipped — decomposition seams (byte-identical, no behaviour change)
| Seam | Extracted to | System impact | Validation |
|---|---|---|---|
| S13 DetectionPostProcessor | `detection_postproc.py` | none (byte-identical) | unit + suite |
| S16 TranslationMemory | `translation_memory.py` | none | unit + suite |
| S17 TextTranslationDispatcher | `text_translation_dispatcher.py` | none | unit + E2E |
| S19 gather_per_context | `gather_per_context.py` | none | asyncio unit |
| S21 ModelLifecycle facade | `model_lifecycle.py` | none | unit + E2E |
| S18 PostTranslationProcessor | `post_translation.py` (4 fns) | none | unit + E2E |
| S14 VerboseDebugSink | `debug_sink.py` (9 fns/ctx-mgr) | none | unit + E2E |
| S15 Stage adapters | `stages.py` (6 leaf fns) | none | unit + E2E |

### Tech-debt outcome (measured) + why this approach

**Measured benefit (pre-decomposition `73251c5` → HEAD):**
| Metric | Before | Now | Δ |
|---|---|---|---|
| `manga_translator.py` (the god object) | **3040 lines** | **2235 lines** | **−805 (−26.5%)** — trajectory 3040 → 2700 (S1–S12 on main) → 2235 |
| Dependency-light, unit-tested modules carved out | 0 | **21** | region_filter/apply, model_usage_tracker/unloader/reaper/lifecycle, memory_guard, prev_context, context_counts, dictionary, none_translator, translation_store, image_debug_context, pipeline_params, detection_postproc, translation_memory, gather_per_context, text_translation_dispatcher, post_translation, debug_sink, stages |
| MIT test cases | 180 | **319** | **+139 (+77%)** characterization net |
| Behaviour change | — | **none** | 4 consecutive byte-identical E2E runs (2 patches, 649×1492+451×1489) |

**Why byte-identical, characterization-first, one seam per commit** (not a big-bang rewrite):
- **The god object is the hottest path in the product** — every translated page flows through it. A silent behaviour change there breaks translation system-wide and is hard to detect. So each seam ships a *characterization net first* (locks current behaviour), then a *verbatim* extraction proven against that net — refactor without re-deciding behaviour.
- **Small, revertable increments** — one commit per seam means each is independently reviewable and rollback = a single revert. Blast radius is one seam, not the whole driver. (12 commits on this branch, each green + E2E'd where it touches output.)
- **Landmines preserved verbatim, fixed later behind opt-in flags** — divergent thresholds (L6 0.5/0.3, ≥6/>10), `**ctx` splat (L15), `exit(-1)` (L2), cp1252 encode bug, etc. are *kept*, not "tidied". This separates "move code" (safe) from "change behaviour" (flagged, opt-in) so neither hides in the other.
- **Don't force-unify load-bearing duplication** (the S18 finding) — when "4 copies" turn out to be structurally divergent on purpose, relocate + pin the divergence as explicit params rather than merging (which would change output). Adding callback complexity to prop up a false merge violates the North Star.
- **Testability is the durable win, not just line count** — the leaf logic (e.g. a 12-arg `dispatch_detection` call) was previously only reachable through a full `MangaTranslator` instance + the 22s ML stack; the extracted adapters unit-test in <1s by stubbing. That is what makes the next seams (and future features) safe to touch.

### Before → After (headline, full fields)

**S18 · post-translation processing relocated (NOT unified)** — *What/where:* the punct+post-dict+phase-1 helper and the three phase-2 page-level lang-check retry loops carved out of `manga_translator.py`'s single/concurrent/batch drivers into `post_translation.py` (4 functions; drivers delegate). *Why:* the four "copies" were buried + untestable, and the documented "unify 4 copies" premise was unsafe — close reading showed the retry loops are structurally divergent (`min_ratio` 0.5/0.3, threshold ≥6/>10, pad+enumerate vs filter+text_idx vs cross-context region_mapping) and load-bearing (L6/L8); unifying would change output, so they're pinned as per-scope params. *Before → After:* ~290 lines of duplicated-but-divergent orchestration inline in the god object → 4 named, unit-tested functions; divergence now explicit + documented. *Perf Δ:* none (same code path). *Quality:* byte-identical output; future unify-decision is now visible. *Validation:* 13 characterization cases + full suite (18 async-only baseline, **295 passed**) + E2E (below). *Risk:* byte-identical; revert = 4 commits (S18a–d). *Links:* `a5f7585`,`fd628bc`,`9458dfd`,`a5cde22`; #187.

**Test-suite pollution fix (pre-existing)** — *What/where:* `MIT/test_precision.py` + `MIT/test_qwen3_translator.py` stub `omegaconf`/`manga_translator` into `sys.modules` at import time and never restore. *Why:* during a full `pytest` run those stubs (installed at collection) shadow the real modules for every later test → 8 spurious failures (`test_detection_postproc`, `test_series_context`, `test_mit_config`) that all pass in isolation. Pre-existing — both files sit on `main`, untouched by the refactor. *Before → After:* full suite **26 failed → 18** (the unchanged async-only baseline), 295 passed. *Perf Δ:* N/A. *Quality:* suite signal trustworthy in a single run (was masking real failures). *Validation:* full suite + qwen3/precision own tests 12/12 green. *Risk:* test-only; save-then-restore `sys.modules`. *Links:* `0db9479`.

### Validation — E2E (production tunnel, mandatory original↔translated)
Through `https://hayateotsu.space/` (cloudflared tunnel, per the `frontend-testing` skill — never
localhost). Test page: **Kouchuugun Shikan Boukensha ni Naru** ch1 "Emergency Landing" page 0
(EN→TH, custom_openai / 9arm). Ran **four times**: after S17/S21, S18, S14, and S15 — each restarting MIT
on the new code with the 3-layer cache cleared (S15's run had zero console errors). **All runs identical:** `page=0 → 2 patches`, geometry
**649×1492 + 451×1489**, POST `translate-patches` 201/success (~35 s), Thai text correctly
positioned, art/layout/panels unchanged — byte-identical to the documented bubble-seg-off baseline.
No 500s; only the standard `/pages` 401→200 HWID auth handshake. Screenshots `e2e-s17-p1-*.png`,
`e2e-s18-p1-translated.png`.

### Risk / rollback
Whole stack byte-identical + characterization-covered; branch pushed (`aa918cb..834a522`) for
rollback. PR to `main` pending user confirm.

---

## 2026-06-09 — Render parity (MangaTranslator) + MIT tech-debt audit

Branch: `feat/context-aware-translation`. All translation-render changes are **opt-in env knobs,
byte-identical when unset** (no behaviour change unless explicitly enabled on the backend).

### Shipped — translation render pipeline
| Change | System impact | Knob | Tests |
|---|---|---|---|
| A · ALL-CAPS lettering | EN renders uppercase (manga convention) | `MIT_EN_UPPERCASE` | BE + MIT green |
| B · EN font override | swap a heavier comic face for EN | `MIT_EN_FONT` | green |
| C · Bubble-fill cap | text fills the balloon (raise the #175 0.5 cap) | `MIT_FONT_MAX_BOX_RATIO` | green |
| #168 · SFX detection | detects + translates outside-bubble SFX via **AnimeText YOLO** (auto-download, gated repo) | `MIT_SFX_DETECTOR` | green; E2E `フッ→Hmph` |
| #166/#170/#175/#179 | bubble area-fit, balloon seg, anti-overflow, safe-area narrow column | various | green |
| #176/#181/#183 | EN comic font, 4× supersampling, dst-bounds clamp | various | green |
| cache:reset tooling | clears the 3-layer translated-patch cache for debugging | `npm run cache:reset` | green |

**Test totals:** MIT 42+ pure-module + Backend 66; render verified on the One Punch-Man benchmark page
(`MIT/tools/ab_parity*.py`, `ab_sfx.py` → `*_montage.png`).

### Before → After (headline changes, full fields)

**A · ALL-CAPS lettering** — *What/where:* uppercase EN translation before render (`manga_translator.py:1125`, exposed via `MIT_EN_UPPERCASE`). *Why:* manga convention is all-caps; mixed-case looked un-manga vs the MangaTranslator reference. *Before → After:* "This brat doesn't realize…" → "THIS BRAT DOESN'T REALIZE…". *Perf Δ:* none (string op). *Quality:* matches the reference's casing identity — the single biggest visual-identity gain. *Validation:* Backend config spec + MIT wiring test; E2E `parity2_montage.png`. *Risk:* opt-in, byte-identical off.

**C · Bubble-fill cap** — *What/where:* raise the #175 font cap from 0.5→tunable balloon-height ratio (`font_high_cap` + `MIT_FONT_MAX_BOX_RATIO`). *Why:* short lines under-filled big balloons (timid vs reference). *Before → After:* text ~half balloon height → fills the balloon (E2E used 0.75). *Perf Δ:* none. *Quality:* closer to reference fill; risk of over-large text bounded by the binary-search fit + #183 clamp. *Validation:* `font_high_cap` unit test + characterization render; E2E. *Risk:* opt-in, default 0.5 = byte-identical.

**#168 · SFX detection** — *What/where:* AnimeText YOLO second pass (`sfx_detector.py`) → IoA-dedup vs DBNet → OCR/translate/render, gated by `MIT_SFX_DETECTOR`. *Why:* DBNet never detects stylized outside-bubble SFX, so they stayed untranslated. *Before → After:* `フッ` untranslated → "HMPH" rendered (a region DBNet never found); the page gained 1 translated region (6→7). *Perf Δ:* +1 YOLO forward + model load (119 MB, ~auto-download once); VRAM not separately profiled (pipeline runs 5–7 GB / 12 GB). *Quality:* readable SFX now translate; **heavily-stylized `ぬ〜` is detected but the 48px OCR can't read the hand-drawn glyph → still untranslated** (needs VLM-OCR). *Validation:* `test_sfx_merge` + wiring test; E2E `sfx_montage.png` log `[SFXDetect] 8 boxes, +2 new textlines`. *Risk:* opt-in; gated model needs `HF_TOKEN`.

**#186 · greedy line-break extracted to a seam** (tech-debt refactor) — *What/where:* `text_render.calc_horizontal` Step-1 packing → `_greedy_pack(...)` (+ `_split_words_and_widths`, `_split_into_syllables`). *Why:* 270-line monolith blocked wiring Knuth-Plass (#180) and was high-risk to modify. *Before → After:* greedy logic inline+entangled → an isolated, swappable function with a clear contract; Steps 2–4 unchanged. *Perf Δ:* none (same code path; one extra `select_hyphenator` call, negligible). *Quality:* **byte-identical** output (no behaviour change); unlocks #180 step 2. *Validation:* 16-case characterization net across all language paths + rarely-hit branches; net caught a real `hyphenator` scope leak. *Risk:* covered by the golden net; revert = single commit.

### Key system findings (operational)
- **Knob gating:** in-app render quality depends on the *full* MIT_* knob set on the backend;
  `MIT_BUBBLE_AREA_FIT` gates the #166/#179 anti-overflow path. Missing it → legacy overflow render
  (looked like a regression, was a config gap). See `.claude/memory/project_render_knob_gating.md`.
- **AnimeText model is gated** (`deepghs/AnimeText_yolo`): auto-downloads via `HF_TOKEN` (MIT/.env,
  loaded by `load_dotenv`); needed a one-click "Agree and access repository" on HF first.

### Known gaps vs the MangaTranslator reference
- Font weight still below CC Wild Words → needs a heavier font asset dropped in via `MIT_EN_FONT`.
- Heavily-stylized SFX (`ぬ〜`) is **detected** but the 48px OCR can't read the hand-drawn glyph →
  needs VLM-OCR (#172 upscale won't fix recognition). Detection path is ready.

### Tech-debt register (MIT) — filed 2026-06-09, label `MIT`
| Issue | Area | Sev | Status |
|---|---|---|---|
| #186 | `calc_horizontal` → pluggable LineBreaker seam | HIGH | **seam extracted** (in progress) |
| #187 | `MangaTranslator` god object (~3,200 lines) → stage orchestrators + Context | HIGH | open |
| #188 | model load/lifecycle + translator retry/config base abstractions (kill global `MODEL`) | HIGH | open |
| #189 | glyph-render dedup (`put_char` h/v + stroke ~200 dup lines) | HIGH | open |
| #190 | `resize_regions_to_font_size` + box-padding decomposition + constants | MED | open |
| #191 | vendored LDM (~3000 LOC) + YOLOv5 trim (license + maintenance) | MED | open |
| #192 | config centralize + cleanup (`load_dotenv` import side-effect, bare excepts, TranslatorChain TODO) | MED | open |
| #193 | worker `--start-instance` lifecycle (5003/5004 orphan, PID, port collision) | MED | open |

### Tech-debt progress
- **#186:** built a 16-case characterization net (all language paths + rarely-hit branches), then
  extracted `_split_words_and_widths`, `_split_into_syllables`, and the Step-1 greedy packer
  `_greedy_pack(...)` — **byte-identical**. The pluggable line-break seam now exists → **#180 step 2**
  (Knuth-Plass) is unblocked at the code level.

### Commits
`bc6902c` (render-parity + SFX) · `a9dd09b` (frontend/misc WIP) · `9739b9d` (Knuth-Plass pure module) ·
`03bc6ae` (#180→#186 deferral note) · `fdfb297` · `15f132d` · `778d144` (#186 seam + net).

---

## 2026-06-09 (cont.) — Tech-debt remediation (foundation phase)

Executing `docs/reports/tech-debt-remediation-plan.md` (foundation-first). Each refactor = characterization/
unit net first, byte-identical, shipped + validated per increment.

**#192 (a) · extract TranslatorChain parsing** — *What/where:* `config.py` parse → pure
`translator_chain.parse_translator_chain` (deps injected). *Why:* resolve the `# TODO: Refactor`;
make translator-chain parsing testable without the ML stack. *Before → After:* parse welded into the
class (untestable without importing `translators`) → pure function with 7 unit tests + a 1-line delegation.
*Perf Δ:* none. *Quality:* byte-identical (real-deps check `gemini:ENG` → identical chain/translators/langs/
target_lang). *Validation:* `test_translator_chain.py` 7 passed + source-inspection wiring test. *Risk:*
behaviour-preserving; revert = single commit. *Links:* #192.

**#187 (a) · extract repetition-hallucination check** — *What/where:* `MangaTranslator._check_repetition_hallucination` (a pure verdict, ~50 lines) → `translation_checks.check_repetition_hallucination`. *Why:* start decomposing the god object at the validator seam so new checks attach there, not inside the orchestrator (anti-compounding). *Before → After:* pure logic welded as an async method on a 3,200-line class → a unit-tested pure function; the method now delegates. *Perf Δ:* none. *Quality:* byte-identical (verified vs the pure fn on 4 cases). *Validation:* `test_translation_checks.py` 5 passed + delegation equality check. *Risk:* behaviour-preserving; revert = single commit. *Links:* #187.

**#187 (b) · extract target-language-ratio check** — *What/where:* `MangaTranslator._check_target_language_ratio` → `translation_checks.check_target_language_ratio` (script_ratio injected). *Why:* complete the validator seam at the god object's post-translation checks. *Before → After:* second pure verdict welded as an async method → unit-tested pure function; method delegates. *Perf Δ:* none. *Quality:* byte-identical (verified vs pure fn across empty/below/at-threshold). *Validation:* test_translation_checks.py 10 passed. *Risk:* behaviour-preserving. *Links:* #187, #109.

**#187 (c) · de-duplicate punctuation correction** — *What/where:* the check_items/replace_items quote-bracket correction, DUPLICATED inline in two MangaTranslator paths, → `punctuation.correct_punctuation`. *Why:* a new punctuation rule previously meant editing two copies inside the god object; now one tested function. *Before → After:* ~150 lines of duplicated data-tables + loops in the orchestrator → a single pure function both sites delegate to. *Perf Δ:* none. *Quality:* byte-identical (6 golden cases). *Validation:* test_punctuation.py 7 passed; regression suite 36 passed. *Risk:* behaviour-preserving; both sites verified to delegate, data tables removed. *Links:* #187.

**#187 S1 · collapse 3-way region filter** — *What/where:* the verbatim `should_filter` block, duplicated in 3 MangaTranslator paths → `region_filter.filter_translated_regions`. *Why:* the corrected step 1 from the deep analysis — a 3-way drift surface where a filter tweak silently diverged across single/batch/concurrent. *Before → After:* 3 identical inline copies (~28 lines each) → one tested function all sites delegate to (should_filter 3→0). *Perf Δ:* none. *Quality:* byte-identical incl. none/original carve-outs. *Validation:* test_region_filter.py 7 passed; regression 35 passed. *Risk:* behaviour-preserving. *Links:* #187 (seam S1).

**#187 S2 · fold translation→region assignment** — *What/where:* the happy-path "assign translation + stamp target_lang/_alignment/_direction" loop (4 copies: single/batch-memory-fallback/batch-shared-index/concurrent), the retry-path render-casing (5th copy), and the error-fallback "source-text-as-translation" loop (3 copies) → `region_apply.{apply_translations, apply_render_casing, apply_original_as_translation}`. *Why:* corrected step 2 — 8 assignment loops where any tweak to casing/metadata could silently diverge per-mode. *Before → After:* 8 inline `region.translation = …` loops → 3 tested functions all sites delegate to (assign loops 8→0). *Perf Δ:* none (one per-context list slice `translated_texts[text_idx:]` in the batch path; negligible). *Quality:* byte-identical — L10 zip-truncation preserved (concurrent's `i<len` guard collapses to the same zip kept-set); single-path-only casing kept behind an `apply_casing` flag (batch/concurrent never cased); batch shared-index preserved by returning the consumed count so the caller advances `text_idx`. *Validation:* test_region_apply.py 9 passed; region_filter 7 + translation-path regression 32 passed; full suite 177 passed (19 async-not-supported failures pre-existing, verified identical on stashed base). *Risk:* behaviour-preserving. *Links:* #187 (seam S2).

**#187 S3 / #188 starts · ModelUsageTracker** — *What/where:* the bare `_model_usage_timestamps` dict — stamped from 8 inline `_run_*` sites and swept in `_detector_cleanup_job` — → `model_usage_tracker.ModelUsageTracker` (`touch(tool, model, now)` / `expired(ttl, now)` / `forget(tool, model)`), clock injected. *Why:* #188 begins by getting model-lifecycle state out of the god object behind a tiny, ML-free testable surface, and **pinning the L1 key-drift** (the 8 keys `'colorizer'`/`'textline_merge'`/`'rendering'` etc.) as a golden before S4 ModelUnloader freezes the unload routing. *Before → After:* dict + inline `[(k)] = current_time` ×8 + a `list(items())` sweep with mid-iteration `del` → 8 `touch(...)` calls + `for tool, model in tracker.expired(...): unload; tracker.forget(...)`. *Perf Δ:* none. *Quality:* byte-identical — keys preserved verbatim (no normalisation → L1 drift intact), strict `> ttl`, insertion-order `list(...)` snapshot so mid-sweep `forget` is safe (L13). *Validation:* test_model_usage_tracker.py 7 passed (strict-`>` boundary, insertion order, forget, safe-forget-during-iteration, re-touch refresh); full suite 184 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving; fully encapsulated (0 remaining `_model_usage_timestamps` refs). *Links:* #187 (seam S3), #188.

**#187 S4 / #188 · ModelUnloader** — *What/where:* the `match tool:` block in `MangaTranslator._unload_model` → `model_unloader.ModelUnloader` (injected `{tool: async unload_fn}` table + `empty_cache`/`cuda_available` hooks); `_unload_model` is now a one-line delegate. *Why:* freeze the unload routing as data (the table) behind a tiny ML-free testable surface, and lock in that the L1-drifted keys the tracker stamps (`'colorizer'`/`'textline_merge'`/`'rendering'`) route to **nothing** — the same latent no-op the `match/case` had. *Before → After:* 6-arm `match/case` + inline `empty_cache` → a dict the ctor wires from the real `unload_*` imports, `unload(tool, model)` doing `routes.get(tool)` → await → `empty_cache` when CUDA. *Perf Δ:* none. *Quality:* byte-identical — same log line, same fall-through-then-`empty_cache` order, unknown keys no-op (L1 preserved, not fixed). *Validation:* test_model_unloader.py 4 passed (known-tool route+cache, L1-drift no-op ×3, no-cache-when-cuda-unavailable, per-tool routing) via `asyncio.run`; full suite 188 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S4), #188.

**#187 S5 · release_memory** — *What/where:* the `gc.collect()` + `if torch.cuda.is_available(): torch.cuda.empty_cache()` cleanup, repeated verbatim in 4 spots (>85% pre-proc guard, MemoryError fallback, per-page individual cleanup, per-batch tail) → `memory_guard.release_memory(cuda_available, empty_cache)`. *Why:* a 4-way verbatim dup; injecting the two torch hooks makes the cleanup unit-testable with no torch. *Before → After:* 4× `import gc / gc.collect() / if cuda: empty_cache()` → 4 one-line `release_memory(torch.cuda.is_available, torch.cuda.empty_cache)` calls (0 remaining `gc.collect`/`import gc` in the god object). *Scope note:* the single psutil `virtual_memory().percent > 85` pressure check is **not** extracted — it has one call site, so there is nothing to de-duplicate; folding it would add a function without removing drift (kept surgical per the North Star; `under_memory_pressure()` deferred until a 2nd site appears). *Perf Δ:* none. *Quality:* byte-identical — same `gc.collect`-then-`empty_cache` order, same cuda gating. *Validation:* test_memory_guard.py 2 passed (collect-then-empty when cuda; collect-only when not); full suite 190 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S5).

**#187 S7 · context_page_counts** — *What/where:* the `(pages_used, skipped)` context-carry accounting block, identical in single dispatch (`_dispatch_with_context`) and concurrent dispatch (`_batch_translate_texts`) → `context_counts.context_page_counts(context_size, done_pages)`. *Why:* the two copies feed the `Carrying N` / `Skipped N` log lines; folding guarantees the two paths' numbers can't drift. *Before → After:* 2× ~9-line `if context_size>0 and done_pages: …pages_expected/non_empty_pages/pages_used/skipped… else: 0,0` → 2 one-line calls. *Scope note:* `_build_prev_context` recomputes its own `non_empty_pages`/`pages_used` to slice the context tail — that is the S6 seam, intentionally left untouched here. *Perf Δ:* none. *Quality:* byte-identical — both counts capped at `context_size`, blank-page detection `any(sent.strip() …)` preserved (7 characterization cases incl. the budget-caps-so-empty-page-not-skipped edge). *Validation:* test_context_counts.py 7 passed; full suite 197 passed (same 19 pre-existing async failures); context regression (test_page_context/test_series_context) green. *Risk:* behaviour-preserving. *Links:* #187 (seam S7).

**#187 S8 · apply_post_dictionary** — *What/where:* the post-translation dictionary apply+log block, verbatim in single (`_translate`) and batch (`_apply_post_translation_processing`) → `dictionary.apply_post_dictionary`; the pure `load_dictionary`/`apply_dictionary` helpers were moved out of the god-object file into the same `dictionary.py` so the stage tests without the ML stack. *Why:* two verbatim copies of "apply post-dict to every region's translation, collect & log the replacements"; centralising it also gives the dict helpers a real home. *Before → After:* 2× ~14-line block → 2 one-line `apply_post_dictionary(ctx.text_regions, self.post_dict)`; the two inline `def`s removed from `manga_translator.py` and re-imported (so `from .manga_translator import load_dictionary` still resolves — `__main__.py` untouched). *Perf Δ:* none. *Quality:* byte-identical — same `before => after` records, same per-line + summary + "No post-translation replacements made." logs, same `regex`-module semantics. *Validation:* test_dictionary.py 6 passed (replace, token-delete, summary+per-line logs, no-replacements message, empty-path no-op, moved-helper parse); re-export verified (`load_dictionary.__module__ == manga_translator.dictionary`); full suite 203 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S8).

**#187 S6 · build_prev_context (pure fn)** — *What/where:* `MangaTranslator._build_prev_context` (the ~50-line per-mode context-string builder) → pure `prev_context.build_prev_context(all_page_translations, original_page_texts, context_size, *, use_original_text, current_page_index, batch_index, batch_original_texts)`; the method is now a thin delegate so its two call sites are untouched. *Why:* the per-mode index policy (single all-done / `current_page_index` slice / concurrent batch-append) was implicit `self`-state; making it explicit args lets the L7 asymmetry be characterized in isolation. *Before → After:* method body moved out verbatim; `hasattr(self, '_original_page_texts')` → `original_page_texts is not None` (equivalent — the attr is always init'd `[]`, so hasattr was always True). *Perf Δ:* none. *Quality:* byte-identical — preserves the L7 `available_pages.index(page)` **first-match** (duplicate-content pages map to the earliest original), the `pages_used==0`/`not available_pages` empty short-circuits, and the concurrent `pass` (no append when not using original text). *Process note:* Serena `replace_symbol_body` mis-detected the method's start line and produced a duplicate def + ate part of `_dispatch_with_context`; caught immediately by grep, reverted the file to the S8 state, redid the swap with an anchored regex. *Validation:* test_prev_context.py 11 passed (incl. L7 first-match, blank-skip, current_page_index slice, concurrent append vs pass, original-fallback); context regression (test_page_context/test_series_context) green; full suite 214 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S6).

**#187 S9 · none-translator front-matter guards** — *What/where:* two landmine pieces of `_run_text_translation`'s front-matter → `none_translator.{apply_prep_manual_override, stamp_none_translations}`. *Why:* name + test + document the L12 config mutation and the L3 return-all asymmetry rather than leaving them buried. *Before → After:* `if self.prep_manual: config.translator.translator = none` → `apply_prep_manual_override(config, self.prep_manual)`; the inline none-stamp loop → `stamp_none_translations(ctx.text_regions, config)`. The call-site **order is preserved exactly** (override → `tracker.touch` → if-none stamp + `return ctx.text_regions`) so the touch still fires for the none path. *Perf Δ:* none. *Quality:* byte-identical — L12 in-place mutation kept (poisons a reused Config, by design), L3 returns **all** regions unfiltered (vs the filtered normal path), blank-translation stamps unchanged. *Validation:* test_none_translator.py 4 passed (prep_manual true/false, none-stamp metadata, empty-list no-op); full suite 218 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S9).

**#187 S10 · translation side-channel I/O** — *What/where:* the `--load-text`/`--save-text` JSON read/write in `_run_text_translation` → `translation_store.{read_translations, write_translations}`. *Why:* isolate + test the byte-identical serialisation (`indent=4, ensure_ascii=False`). *Before → After:* inline `with open(...,"r"): json.load` / `with open(...,"w"): json.dump(...)` → `read_translations(path)` / `write_translations(path, sentences)`. *Scope note:* the `print(...)` + bare `exit(-1)` (**L2**) and the `os.path…input_files[0]` filename derivation are **left inline** at the call site (the exit is a process-control landmine clearer when visible); **no IndexError guard added** (would change behaviour). *Latent bug surfaced (preserved, not fixed):* the inline `open(...,"w")` had **no `encoding=`**, so on a cp1252-default platform `ensure_ascii=False` non-ASCII raises `UnicodeEncodeError` — a test characterizes the format + the unescaped-`ensure_ascii=False` bytes; candidate fix `encoding="utf-8"` deferred to an opt-in change. *Perf Δ:* none. *Quality:* byte-identical. *Validation:* test_translation_store.py 3 passed (round-trip, indent-4 array, non-ASCII unescaped); full suite 221 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S10), L2.

**#187 S11 · ImageDebugContext (full class)** — *What/where:* the scattered `_current_image_context` / `_saved_image_contexts` instance state, the `_set/_get/_save/_restore_image_context` helpers, `_result_path`, and the two manual save/restore swap closures → `image_debug_context.ImageDebugContext` (`set`/`subfolder`/`save`/`restore`/`clear_saved`/`with_context`/`result_path`). *Why:* the biggest tech-debt pocket in this batch — per-image debug-folder lifecycle spread across ~20 call sites with duplicated swap boilerplate; consolidating it is the long-term-debt win the user asked for. *Before → After:* `self._current_image_context`/`self._saved_image_contexts` → one `self._image_debug` object; the 5 methods became **thin delegates** (call sites unchanged); ~18 direct `self._current_image_context` reads → `self._image_debug.current`; the 2 swap closures (`original=…; …=X; try: result_path; finally: …=original`) → `with self._image_debug.with_context(X): return self._result_path(path)`. *Perf Δ:* none. *Quality:* byte-identical — same subfolder format, same verbose/web/`result_sub_folder` path branches incl. the no-context default `{ts}-unknown-1024-unknown-unknown`, same `makedirs(dirname)`, same `getattr` defaults (1024/'unknown'); dict shape unchanged so all `['subfolder']`/`['file_md5']`/`.copy()`/truthiness reads behave identically. *Validation:* test_image_debug_context.py 13 passed (subfolder, save/restore round-trip + miss, no-current save no-op, with_context swap + exception-restore, 5 result_path goldens, set with/without image incl. getattr defaults); full suite 234 passed (same 19 pre-existing async failures); diff reviewed call-site-by-call-site. *Risk:* behaviour-preserving (invasive but mechanical; 0 orphan refs). *Links:* #187 (seam S11), L11-adjacent debug paths.

**#187 S12 (globals) · apply_global_settings** — *What/where:* the process-global construction side effects inline in the constructor — the conditional `ModelWrapper._MODEL_DIR` override (was in `parse_init_params`) and the two `torch.backends.*.allow_tf32 = True` flags (were in `__init__`) → `pipeline_params.apply_global_settings(params)`, called once after `parse_init_params`. *Why:* isolate process globals from value-parsing (the analysis's explicit "separate apply_global_settings"); also removed the now-unused `ModelWrapper` import. *Scope:* only the **globals half** of S12 — the `PipelineParams` value object for the ~20 parsed fields is **deferred until #192** (it is entangled with the device / `using_gpu` / raise logic + ordering, which the analysis gates on config-centralisation). *Before → After:* `_MODEL_DIR` set mid-`parse_init_params` + TF32 set in `__init__` → one `apply_global_settings(params)` call; byte-identical (nothing reads `_MODEL_DIR` between its old and new position, and models load lazily at translate time). *Perf Δ:* none. *Quality:* byte-identical — same conditional override, same TF32 flags, same relative order (_MODEL_DIR before TF32). *Validation:* test_pipeline_params.py 3 passed (model_dir override / absent-or-empty no-op / TF32 flags); full suite 237 passed (same 19 pre-existing async failures); 0 `ModelWrapper` refs left in the god object. *Risk:* behaviour-preserving. *Links:* #187 (seam S12, globals), #192 (gates the value-object half).

**#187 S20 / #188 · ModelReaper (TTL loop)** — *What/where:* `MangaTranslator._detector_cleanup_job` (the background model-TTL polling loop) → `model_reaper.ModelReaper(tracker, unloader, get_ttl)`; `_loop` polls `reap_once(now)` once/sec; the 2 task-creation sites now call `self._model_reaper.start()` behind their existing `is None` guard. *Why:* lift the #188 TTL loop out of the god object onto the S3 tracker + S4 unloader, and give the leaked task a cancel handle. *Before → After:* inline `while True: ttl==0?sleep:continue; sweep; sleep` → `reaper.start()`; the sweep is the testable `reap_once`. *Perf Δ:* none (one extra `time.time()` per idle tick — no side effect). *Quality:* byte-identical — `ttl==0` short-circuit preserved, `list(...)` snapshot (L13) intact via `tracker.expired`, `unload`-before-`forget` order kept. **L14 fix is opt-in:** `stop()` cancels the task but **nothing calls it by default**, so the cleanup-task leak is preserved verbatim until a caller opts in. *Validation:* test_model_reaper.py 5 passed (unload→forget order, ttl==0 no-op incl. `expired` not queried, start creates task, stop cancels, stop-no-task no-op) via `asyncio.run`; full suite 242 passed (same 19 pre-existing async failures). *Risk:* behaviour-preserving. *Links:* #187 (seam S20), #188, L13/L14.

**#187 S13 / #168 · DetectionPostProcessor** — *What/where:* `_merge_sfx_detections` + `_textline_aabb` (the AnimeText SFX second-pass merge, gated by `config.detector.det_sfx`) → `detection_postproc.{merge_sfx_detections, textline_aabb}`; `_run_detection` now calls `merge_sfx_detections(ctx, result, self.device)`. *Why:* lift the #168 SFX-merge off the god object into a light module (ML imports stay lazy); done without S15 (the call-site gate is unchanged). *Before → After:* 2 methods on `MangaTranslator` → 2 functions; `device` passed in (was `self.device`). *Perf Δ:* none. *Quality:* byte-identical — same IoA dedup, same empty-`Quadrilateral` append, same `[SFXDetect]` log, same `str(device or 'cuda')`. *Stale-test fix (surfaced by S13's full-suite run):* two **source-inspection wiring tests** were repointed to the post-refactor module locations — `test_sfx_merge` (the merge body moved to `detection_postproc.py`) and, **pre-existing since S2 merged**, `test_safe_area::test_en_uppercase_lettering_is_wired` (S2 had moved the casing to `region_apply.py` but the test still grepped `manga_translator.py`). The MIT test baseline is now **18 async-only failures** (was 19 — one was this stale wiring test). *Validation:* test_detection_postproc.py 2 passed (AABB golden, no-SFX identity short-circuit); test_sfx_merge + test_safe_area green again; full suite 245 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S13), #168.

**#187 S16 · TranslationMemory** — *What/where:* the two cross-page lists (`all_page_translations` + `_original_page_texts`) that lived directly on the god object + `reset_page_context` → `translation_memory.TranslationMemory` (`all_page_translations`, `original_page_texts`, `reset()`); `self._translation_memory` holds them and ~16 direct refs were renamed; `reset_page_context` delegates to `.reset()`. *Why:* make the #136/#140 worker-singleton bleed boundary an explicit object (L9). *Before → After:* two bare instance lists → one named memory object; the lists stay plain lists so `.append()` / `len()` / `[i]=` / slicing behave identically. *Perf Δ:* none. *Quality:* byte-identical — append sites still driven by the caller (L7 per-mode asymmetry preserved), `reset` still only called from `translate_patches` (L9 asymmetry), and `reset` rebinds (not `.clear()`) verbatim. Updated `test_page_context`'s `_bare_translator` to the new memory location. *Validation:* test_translation_memory.py 4 passed (empty init, appendable, reset clears, reset-rebinds-not-clears); context regression (test_page_context/test_series_context) green; full suite 249 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S16), #136/#140, L7/L9.

**#187 S19 · gather_per_context** — *What/where:* the concurrent driver's `asyncio.gather(return_exceptions=True)` + per-exception keep-original placeholder loop → `gather_per_context.gather_per_context(tasks, contexts_with_configs, ignore_errors)`. *Why:* isolate + test the failure-reconciliation (re-raise vs index-aligned placeholder) of the concurrent path. *Before → After:* ~20-line inline try/gather + `for i, result: if isinstance(Exception): …` → one `final_results = await gather_per_context(...)` call (bracketing `Starting/Completed` logs kept). *Perf Δ:* none. *Quality:* byte-identical — same `return_exceptions=True`, same re-raise-unless-`ignore_errors`, same `apply_original_as_translation` placeholder gated on `ctx.text_regions`, same index alignment + logs. *Validation:* test_gather_per_context.py 4 passed (all-succeed order, exception+ignore→placeholder index-aligned, exception+not-ignore→reraise-original, no-regions skips-apply) via `asyncio.run`; full suite 253 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S19).

---

## 2026-06-09 — AFK decomposition batch complete (S12-globals, S20, S13, S16, S19) — stopped before the core

After PR #195 (S2–S11) merged, an AFK batch landed five more byte-identical seams on a stack, then **stopped before the high-risk async-orchestration core** (S15/S17/S18/S21–S26) per the dev's instruction (those need E2E-per-step, not unattended runs). Per-seam before→after blocks are above. **Test baseline corrected to 18 async-only failures** (a stale `test_en_uppercase_lettering_is_wired` left by S2's casing move was fixed in S13). Net: `manga_translator.py` lost the model-TTL loop, the SFX merge, the cross-page lists, and the concurrent gather block to four more light modules; `apply_global_settings` isolated the construction globals. Full suite **253 passed**, 0 real failures.

**#187 S21 / #188 · ModelLifecycle facade** — *What/where:* the duplicated eager-preload block (×2, gated `models_ttl==0`) and the duplicated cleanup-task guard (×2) → `model_lifecycle.ModelLifecycle(reaper, prepare_fns)` with `preload(config, device, models_ttl)` + `ensure_running()`; the guard's idempotency moved into `ModelReaper.ensure_started()`. *Why:* the #188 lifecycle capstone — fold the construction-time preload + the start-once guard onto the S20 reaper; `self._detector_cleanup_task` is gone (the reaper owns its task). *Before → After:* 2× ~9-line preload + 2× `if self._detector_cleanup_task is None: …start()` → `await self._model_lifecycle.preload(...)` + `self._model_lifecycle.ensure_running()`. *Scope:* the facade wraps the **reaper**; the tracker (S3) + unloader (S4) stay direct (used by the `_run_*` touch sites and the reaper) — absorbing them is high-churn/low-value, deferred. *Perf Δ:* none. *Quality:* byte-identical — same preload order, same `upscale_ratio`/`Colorizer.none` conditions, same `device` threading, same `models_ttl==0` gate, idempotent start preserved (L16). prepare_* injected as a table → tests with no ML. *Validation:* test_model_lifecycle.py 4 passed (ttl-skip, full order+device, upscale/colorizer conditions, ensure_running delegates) + test_model_reaper ensure_started idempotent; full suite 258 passed / 18 pre-existing async. *Risk:* behaviour-preserving. *Links:* #187 (seam S21), #188, L16.

**#187 S17 / #188 · TextTranslationDispatcher** — *What/where:* the duplicated ChatGPT/ChatGPT2Stage translator handling in `_dispatch_with_context` (single) and `_batch_translate_texts` (batch) → `text_translation_dispatcher.{build_chatgpt_translator, dispatch_translate}`. *Why:* the highest-risk dedup — the two copies share the construction switch + parse/set-context + carry/skip logs + the 2stage-vs-chatgpt dispatch, but diverge in load-bearing ways. *Before → After:* ~40 + ~70-line near-duplicate switches → a 2-line construct + a `dispatch_translate(...)` call at each site. **Two functions on purpose:** `OpenAITranslator.__init__` can emit a glossary warning, and single constructs the translator *after* the context log while batch constructs it *before* — so each caller calls `build_chatgpt_translator` at its own point (order preserved) and `dispatch_translate` does the order-invariant rest. *Divergences preserved (parameterised):* chatgpt_2stage `result_path_callback` = bound `_result_path` (single) vs the `with_context` swap closure (batch); the `batch_contexts` multi-image wiring via `on_2stage_batch_setup` (batch-only); and the **context-computation placement** (single computes/logs it unconditionally incl. non-chatgpt, batch only inside its chatgpt branch — both left at the call sites, not moved into the dispatcher). *Perf Δ:* none. *Quality:* byte-identical (the only reorder — `parse_args` now after the silent `build_prev_context` — produces an identical observable log sequence). *Validation:* test_text_translation_dispatcher.py 6 passed (build→openai/2stage, parse/set/translate w/wo ctx, 2stage callback+batch-setup, chatgpt-skips-batch-setup, carry/skip logs) via fake translators + `sys.modules` stubs + `asyncio.run`; full suite 264 passed / 18 pre-existing async. **E2E pending** (the high-risk seams want a live-pipeline pass before merge). *Risk:* behaviour-preserving by construction + unit-characterised; E2E recommended. *Links:* #187 (seam S17).

---

## 2026-06-11 — #189 + #190 render dedup (glyph + resize/render geometry) · PR #215

Two sibling MIT render tech-debt issues, **6 byte-identical seams** (one commit each), each pinned by a golden-pixel characterization test written **before** the edit. Branch `refactor/mit-189-190-render-dedup`. Reported with the full 18-section feature/refactor template ([[feedback-impact-report]]).

**1. What changed.** #189 (`rendering/text_render.py`): the two ~200-line near-duplicate glyph fns `put_char_horizontal`/`put_char_vertical` collapsed onto 3 shared direction-parameterised helpers — `_render_glyph_stroke` (the freetype stroker block + validity check), `_paste_bitmap` (the 4 clip/slice/blend paste sites → 1), `_select_face_for_char` (the font-fallback loop). #190 (`rendering/__init__.py`): `_expand_single_axis` (the 2 single-axis expansion blocks → 1), `_pad_box` (render()'s 4 ratio-padding branches' boilerplate → 1 primitive), named length-ratio constants + deleted the ~14-line dead commented `elif`.

**2. Results.** Render code **−198 net lines** (−375 / +177 across the 2 files). 4 paste copies → 1; 2 glyph twins → shared helpers; 4 padding branches → 1 primitive; 2 font-loop copies → 1. Byte-identical on every changed path (2 deterministic goldens green through all 6 seams). Full suite **331 passed / 18 pre-existing async / 0 new failures**. Live E2E passed.

**3. Expected performance gain %.** **0% runtime — byte-identical, maintainability-only.** The render hot path runs the same operations in the same order; goldens prove identical pixels. No latency/VRAM/throughput change (not a perf optimisation). The gain is maintenance/DX velocity, not CPU.

**4. Benefits.** Single source of truth for glyph stroke/paste/font-fallback + box-padding; future render fixes land in 1 place, not 2–4; smaller divergence surface (the copies had already drifted into a latent bug); a reusable golden harness now guards render pixels; fixed a latent vertical-stroke edge-clip misalignment as a free byproduct.

**5. Purpose.** Remove the largest remaining near-duplicate blocks on the render hot path to cut maintenance cost + bug surface (engineering north star: simplest logic that works · maintainable · sustainable long-term).

**6. Why we changed it + architectural impact.** Two ~200-line copies of glyph logic inevitably drift — they already had: the vertical-*stroke* paste clamped `pen_border≥0` and sliced `bitmap_border[0:]`, misaligning a stroke clipped off the top/left edge, a bug absent from the 3 sibling paste sites. Architecturally render moves from 2 monolithic twins + inline branch soup to small single-purpose unit-testable helpers behind a golden net — "relocate the shared mechanism, keep divergent policy explicit at the call site."

**7. Problems before the refactor.** ~200-line near-duplicate `put_char_h/v`; 4 copies of clip/slice/blend paste; 4 near-identical h/v padding branches; copy-pasted fallback loop in `get_char_glyph`/`get_char_border`; scattered magic numbers (0.3/0.4/1.1); ~80+ lines of dead commented debug; a latent v-stroke clip bug born of the divergence; and **no golden/characterization net on render at all**.

**8. Goals.** Byte-identical dedup; golden-guarded before each edit; one commit per seam; zero behaviour change on any real page; load-bearing divergence relocated, not unified.

**9. Architecture Before.**
```
put_char_horizontal (~200 LOC) ─┐ stroker block (copy A) · char paste (copy A) · stroke paste (copy A)
put_char_vertical   (~200 LOC) ─┘ stroker block (copy B) · char paste (copy B) · stroke paste (copy B, buggy clip)
get_char_glyph / get_char_border  ── fallback loop (copy ×2)
resize_regions_to_font_size       ── h-expansion block ‖ v-expansion block (twins) + ~80 dead lines
render()                          ── 4 ratio-padding branches (zero-box/place/copy ×4)
constants                          ── 0.3 / 0.4 / 1.1 inline magic numbers
[no render characterization tests]
```
**10. Architecture After.**
```
_render_glyph_stroke(cdpt,size,dir) ─┐
_paste_bitmap(canvas,bmp,x,y,blend) ─┼─ put_char_horizontal / put_char_vertical (thin)
_select_face_for_char(cdpt,size,dir)─┘
_expand_single_axis(region,need,used,h_axis) ─ resize_regions_to_font_size (thin orchestrator)
_pad_box(temp_box,pad_height,ext,offset)     ─ render() (4 branches → 4 one-liners + 1 primitive)
_LEN_RATIO_FONT_GAIN / _FONT_SIZE_SCALE_GAIN / _MAX_BBOX_SCALE (named constants)
test/test_put_char_golden.py + test/test_render_golden.py (deterministic golden net)
```
**11. Refactor list.**
| Seam | Commit | Helper |
|------|--------|--------|
| #189 S1 | `b320ff5` | `_render_glyph_stroke` |
| #189 S2 | `84417d8` | `_paste_bitmap` (+ v-stroke clip fix) |
| #189 S3 | `7641474` | `_select_face_for_char` |
| #190 S1 | `00bc673` | `_expand_single_axis` |
| #190 S2 | `94795c0` | `_pad_box` |
| #190 S3 | `e92df75` | named constants + dead-elif removal |
| docs | `ddc8566` | DONE.md + PIPELINE.md §5 |

**12. Metrics.** −198 net render LOC (−375 / +177); 4→1 paste sites; 2 glyph fns deduped; 4→1 padding branches; 2→1 font loop; +2 golden test files (9 glyph cases × 2 dirs × border on/off × 2 sizes + 3 dispatch regions); 331 unit pass / 0 new fail; live E2E 74 s (1200×1705 page, GPU); golden runtime ~12–20 s.

**13. Technical Debt Removed.** 4 paste copies, 2 glyph twins, 2 font-loop copies, 4 padding-branch copies, ~80+ dead debug lines, scattered magic numbers, the latent v-stroke clip bug, and the render-test blind spot (zero characterization coverage before this).

**14. Risk Reduction.** Divergence-bug surface eliminated where it had already produced one bug; the golden net catches any future pixel drift in put_char_*/dispatch in ~15 s; byte-identical guarantee ⇒ zero render-quality regression risk from this change.

**15. Developer Experience Impact.** A render fix now edits 1 helper, not 2–4 hand-synced copies; each helper is unit-testable in isolation; the golden gives fast byte-identical feedback locally (no full GPU E2E needed to catch a pixel regression).

**16. Future Opportunities.** Deferred (flagged): #189 FontStack cache-key fix (a *behaviour* change — alters output on mid-page font switch); #190 RenderTuning dataclass threaded through `dispatch()` (runtime-config machinery not yet needed); an exhaustive scrub of the remaining inline dead-debug comments.

**17. Lessons Learned.** "Relocate, don't unify" load-bearing divergence — the v-border clip, the h/v padding placements, and the both-axes overwrite order were preserved explicitly, not forced into one formula that would shift edge pixels. Golden-pixel characterization is the right guard for pixel-critical refactors. Operational: MIT must launch on `MIT/.venv` (cu121 CUDA torch), not the Store python (cpu) — `--use-gpu` + cpu-torch hangs the worker at `/ready` 503 (poll `/ready`, not `/health`). See [[project-mit-launch-env]].

**18. KPI.** Byte-identical 100% (6/6 golden-passing seams) · regressions 0 (331 pass) · LOC −198 render · dedup 4→1 paste / 2→shared glyph / 4→1 padding · E2E pass (clean Thai render, original↔translated parity) · deferred items 2 (both flagged).

*Validation:* golden-pixel unit (put_char h/v + dispatch h/v, deterministic) + full suite + live direct-MIT E2E (`POST /translate/with-form/image`, Kouchuugun source, 74 s, clean render). *Risk/rollback:* byte-identical; revert = drop the branch (no flag needed). *Links:* #189, #190, PR #215.

## 2026-06-11 — #186 LineBreaker seam (finish) + Knuth-Plass wired (unblocks #180)

Finished the pluggable line-break seam in `calc_horizontal`. Prior sessions had extracted the tokenizers + greedy Step 1 (`_greedy_pack`) under a 15-case characterization net; this session formalised the seam and wired the Knuth-Plass strategy. Branch `refactor/mit-186-linebreaker-seam`, 3 commits. Reported with the full 18-section template ([[feedback-impact-report]]).

**1. What changed.** `rendering/text_render.py`: added a `LineBreaker` Protocol + `GreedyLineBreaker` (delegates to the existing `_greedy_pack`) + `KnuthPlassLineBreaker` (adapts the pure `line_break.find_optimal_line_breaks` to the seam). `calc_horizontal` gained an optional `line_breaker=` param (defaults to greedy) and now packs Step 1 via `breaker.pack(...)`; its greedy-only Step 2 (backward syllable hyphenation) is gated on `breaker.greedy_postprocess`. New `test/test_line_breaker.py`.

**2. Results.** The line-break strategy is now swappable without touching tokenization or Step 4 assembly. Greedy stays the default ⇒ production render **byte-identical** (characterization net + line-break + thai-wrap + font-fit: **23 passed**). The Knuth-Plass strategy is selectable and balances lines (`test_line_breaker.py`: **4 passed**) — on the demo sentence greedy leaves a lone `today` (min 97, spread 117), KP pulls `dog` down (min 137, spread 57). #180 step 2 is now unblocked.

**3. Expected performance gain %.** **Default path: 0% runtime — byte-identical** (greedy unchanged; goldens prove identical line breaking). The KP path is **opt-in and quality-only** (balanced lines, not speed): its DP is O(n²) over a region's *words* (tens, not thousands) — negligible vs OCR/inpaint/translate. No latency/VRAM claim until #180 step 2 measures it under E2E.

**4. Benefits.** Knuth-Plass (built in #180 step 1, dormant since) is finally reachable behind a clean seam; line-break policy lives behind one interface (greedy vs holistic) instead of being hard-wired into a 270-line monolith; both strategies are unit-testable in isolation (no PIL); #180 step 2 collapses from "untangle the monolith" to "select a strategy + E2E."

**5. Purpose.** Pay down the tech debt that blocked #180 step 2: `calc_horizontal` interleaved four concerns over shared mutable state, so dropping in a global DP conflicted with the greedy-assuming post-processing. Expose the strategy as a seam so the algorithm swap is a one-liner, per the north star (simplest logic that works · maintainable · sustainable).

**6. Why we changed it + architectural impact.** Forcing Knuth-Plass into the greedy monolith was flagged high-risk on a core, widely-used wrapper (3 production callers). Architecturally, Step 1 moves from a hard-wired greedy block to a **strategy seam**: tokenization (shared) → `LineBreaker.pack` (swappable) → Steps 2-4 (greedy post-process gated by `greedy_postprocess`; assembly shared). "Relocate the shared mechanism, keep divergent policy explicit" — the greedy-specific re-balancing is gated off for holistic strategies rather than deleted.

**7. Problems before the refactor.** `calc_horizontal` Step 1 was hard-wired greedy; the pure Knuth-Plass module (`line_break.py`, #180 step 1) existed but was **unwired** (#180 step 2 blocked); Steps 2-4 assumed the greedy structure + per-line `hyphenation_idx`, so any alternate strategy conflicted with them; no way to A/B a line-break algorithm.

**8. Goals.** Greedy path byte-identical (golden-guarded); `LineBreaker` interface unit-tested in isolation (no PIL) for both strategies; Knuth-Plass wired as a selectable strategy; greedy stays default so the live render is unchanged; #180 step 2 reduced to a strategy selection behind `render.bubble_area_fit`.

**9. Architecture Before.**
```
calc_horizontal
 ├─ tokenize (_split_words_and_widths / _split_into_syllables)   [extracted earlier]
 ├─ Step 1: _greedy_pack(...)                                    [hard-wired greedy]
 ├─ Step 2: backward hyphenation  ┐
 ├─ Step 3: single-char rebalance ├─ assume greedy structure + hyphenation_idx
 └─ Step 4: assembly              ┘
line_break.find_optimal_line_breaks  ── pure Knuth-Plass DP, UNWIRED (#180 blocked)
```
**10. Architecture After.**
```
LineBreaker (Protocol): pack(...) -> (line_words, line_widths, hyphenation_idx); greedy_postprocess
 ├─ GreedyLineBreaker      (greedy_postprocess=True)  -> _greedy_pack         [default = byte-identical]
 └─ KnuthPlassLineBreaker  (greedy_postprocess=False) -> find_optimal_line_breaks  [opt-in, balanced]
calc_horizontal(..., line_breaker=None)
 ├─ tokenize (shared)
 ├─ Step 1: breaker.pack(...)                         [swappable seam]
 ├─ Step 2: gated on breaker.greedy_postprocess       [greedy-only]
 ├─ Step 3: greedy rebalance (natural no-op for KP — never shares a word across lines)
 └─ Step 4: assembly (shared)
test/test_line_breaker.py — both strategies in isolation (no PIL) + real-font selectable proof
```
**11. Refactor list.**
| Seam | Commit | Change |
|------|--------|--------|
| #186 C1 | `09e8c8c` | `LineBreaker` Protocol + `GreedyLineBreaker`; `calc_horizontal` `line_breaker=` param + Step 2 gate (byte-identical) |
| #186 C2 | `426f4a2` | `KnuthPlassLineBreaker` adapter + `test/test_line_breaker.py` (no-PIL isolation + real-font selectable) |
| #186 C3 | docs | PIPELINE.md §5 + DONE.md + this report |

**12. Metrics.** `text_render.py` +46 LOC (seam: Protocol + 2 breakers) over the already-extracted `_greedy_pack`; +68 LOC test (`test_line_breaker.py`, 4 tests). Default-path tests: 23 passed (15-case char net + 5 line-break + thai-wrap + font-fit) ⇒ byte-identical. New breaker tests: 4 passed. 3 production callers unaffected (all pass ≤6 args; new param inert). KP balance on demo sentence: min 97→137, spread 117→57.

**13. Technical Debt Removed.** The #180-blocking entanglement of Step 1 with the greedy-assuming Steps 2-4; the dead-on-arrival unwired Knuth-Plass module; the hard-wired single-strategy line-break; the absence of isolated (no-PIL) line-break unit coverage for an alternate strategy.

**14. Risk Reduction.** Default greedy is byte-identical (15-case golden net green) ⇒ zero render regression risk from this change. The KP strategy is opt-in (default off), so it cannot affect the live render until #180 step 2 deliberately selects it behind `render.bubble_area_fit` + E2E. Both strategies are unit-pinned in isolation, so a future edit that breaks either fails fast (~12 s, no GPU).

**15. Developer Experience Impact.** Swapping the line-break algorithm is now `calc_horizontal(..., line_breaker=KnuthPlassLineBreaker())` instead of surgery on a 270-line monolith; line-break logic is testable without fonts/PIL via a stubbed width fn; #180 step 2 is a small, low-risk follow-up.

**16. Future Opportunities.** #180 step 2: select `KnuthPlassLineBreaker` behind `render.bubble_area_fit` (or a dedicated knob) + production E2E + tuning of `badness_exponent`/`hyphen_penalty`. Give KP word-level over-wide handling (currently a lone over-wide word overflows; syllable splitting stays the greedy path's job) and empty-text parity. Potentially make Step 3 explicitly strategy-gated (today it's a proven no-op for KP).

**17. Lessons Learned.** A seam is the cheap way to defuse a high-risk wiring: rather than force Knuth-Plass into greedy-assuming code, gate the greedy-specific post-process behind a strategy flag and keep assembly shared. "Relocate, don't unify" again — Step 2 is gated off for holistic strategies, not deleted. Unit-testing the interface with a stubbed width fn keeps the proof fast and PIL-free while a single real-font test pins the end-to-end selectable behaviour.

**18. KPI.** Default byte-identical 100% (23/23 default-path tests) · regressions 0 · new isolated coverage +4 tests (both strategies, no PIL) · #180 step 2 unblocked · KP line-width spread −51% on the demo (117→57) · deferred items: #180 step-2 selection + KP over-wide/empty parity (flagged).

*Validation:* characterization net (greedy byte-identical) + `test_line_breaker.py` (both strategies isolated + real-font selectable). Live E2E deferred to the verify step / #180 step 2 (default path is byte-identical so the live render is unchanged). *Risk/rollback:* default byte-identical, KP opt-in/off; revert = drop the branch. *Links:* #186, #180, #178.

## 2026-06-11 — #188 S22 DispatchRegistry + kill global MODEL in detection (last #188 model-lifecycle seam)

Landed the final model-lifecycle seam of the #187/#188 god-object decomposition: collapse the duplicated dispatch get/cache/unload trio into one `DispatchRegistry`, and thread the detector net explicitly to delete the module-global `MODEL`. Code was complete on `refactor/mit-188-dispatch-registry-global-model`; this rebased it onto current main (clean — disjoint from the #215/#216 render work) and verified. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** (a) `dispatch_registry.py` — a 33-line `DispatchRegistry(registry, kind)` with `get`/`unload`, folding the byte-identical `get_X` (lazy cache) + `unload` (pop) + cache-dict trio that the **6** dispatch `__init__` modules (detector/ocr/inpainter/upscaler/colorizer/translators) each copy-pasted. Each module now wires `get_X = registry.get` / `unload = registry.unload` and keeps its own divergent `prepare`/`dispatch`. (b) Detection: `det_batch_forward_default(batch, device, model)` takes the net explicitly; `_load` drops the module-global `MODEL`, `_infer` threads `self.model`; `craft.py`'s global was dead code (deleted). New `test_dispatch_registry.py` (5) + `test_det_forward_default.py` (2, default + dbnet).

**2. Results.** Dispatch boilerplate folded 6→1; no `MODEL` global left in detection (concurrent detector loads can't clobber). Byte-identical: the `if not cache.get` re-create quirk and the `','.join` ValueError message are preserved verbatim. Rebased onto main: **342 passed / 18 pre-existing async / 0 new failures** (335 main + 7 S22). Prior full-stack E2E (production tunnel, Kouchuugun ch1 p0 EN→TH) returned **2 patches 649×1492 + 451×1489 = pixel-exact to baseline**.

**3. Expected performance gain %.** **0% runtime — byte-identical.** The registry does the same lazy-instantiate/cache/pop the inline code did; goldens/units prove identical behaviour. The global-`MODEL` removal is a **correctness/concurrency** change (removes a latent two-detector clobber), not a perf change — no latency/VRAM delta.

**4. Benefits.** One source of truth for dispatch caching (a cache/unload fix lands once, not 6×); detection is concurrency-safe (no shared mutable global on the forward hot path); the registry + threaded-model are unit-pinned; finishes the model-lifecycle half of #188 so the only remaining #187/#188 work is S12 (🔒 #192) + the translator base-abstraction half.

**5. Purpose.** Close out the model load/lifecycle decomposition (#188): kill per-impl boilerplate and the global model state the issue calls out, so model dispatch is one tested seam rather than 6 hand-synced copies + a concurrency landmine.

**6. Why we changed it + architectural impact.** Six copies of the get/cache/unload trio drift independently, and a module-global `MODEL` on the detection forward path is unsafe the moment two detectors load. Architecturally, model dispatch moves from "copy-pasted trio per module + global net" to "one `DispatchRegistry` owning lifecycle, model passed explicitly" — the per-module `prepare`/`dispatch` stay (load-bearing divergence: different methods/args/early-returns), relocated-not-unified.

**7. Problems before the refactor.** 6× duplicated `get_X`/`unload`/cache dict; a module-global `MODEL` in `detection/default.py` + `dbnet_convnext.py` (read in the batch-forward) = concurrency hazard; a dead global in `craft.py`; no isolated test on dispatch caching or the detector forward transform.

**8. Goals.** Fold the dispatch trio byte-identical; remove the detection global without changing the forward's numerics; unit-pin both; keep each module's divergent prepare/dispatch; land on current main with 0 new failures.

**9. Architecture Before.**
```
detection/__init__.py   ── get_detector / unload / DETECTORS cache  ┐
ocr/__init__.py         ── get_ocr / unload / OCRS cache            │  6x copy-pasted
inpainting/__init__.py  ── get_inpainter / unload / cache           ├─ get/cache/unload trio
upscaling, colorization ── ...                                      │
translators/__init__.py ── get_translator / unload / cache          ┘
detection/default.py + dbnet_convnext.py ── global MODEL set in _load, read in det_batch_forward_default (hazard)
detection/craft.py      ── dead global MODEL
```
**10. Architecture After.**
```
dispatch_registry.py: DispatchRegistry(registry, kind).get(key,*a,**kw) / async unload(key)
 ├─ detection/ocr/inpainting/upscaling/colorization/translators: get_X = reg.get ; unload = reg.unload
 └─ each keeps its own prepare/dispatch (divergent — untouched)
det_batch_forward_default(batch, device, model)  ── model threaded explicitly; NO global MODEL anywhere in detection
test_dispatch_registry.py (5) + test_det_forward_default.py (2)
```
**11. Refactor list.**
| Seam | Commit (pre-rebase) | Change |
|------|---------------------|--------|
| S22a | `bd788b5` | `DispatchRegistry` + wire detector/ocr/inpainter/upscaler/colorizer |
| S22b | `cc8785d` | fold `translators/__init__.py` onto the registry |
| #188 global | `f5d60bc` | thread model in `detection/default.py` (kill global) |
| #188 global | `859506d` | finish in `dbnet_convnext` + delete `craft` dead global |
| docs | `dc04369` | DONE.md Lane A + full-stack E2E record |

**12. Metrics.** 13 files, +201 / −72; dispatch trio 6→1 (`dispatch_registry.py` 33 LOC); global `MODEL` removed from 3 detection files; +2 test files / 7 cases. Suite 342 pass (was 335 on main) / 0 new fail. Prior E2E byte-exact (2 patches).

**13. Technical Debt Removed.** 6 copies of the dispatch get/cache/unload trio; the detection global-`MODEL` concurrency hazard (2 files) + 1 dead global; the test blind spot on dispatch caching + detector forward numerics.

**14. Risk Reduction.** Concurrency hazard on the detection hot path eliminated (no shared mutable global); dispatch behaviour pinned by 5 cases (lazy-once, arg-forwarding, exact ValueError, unload-reinstantiate, unknown-key no-op) and the forward transform by 2 (NHWC→NCHW + sigmoid, real torch). Byte-identical ⇒ no translation-quality regression (E2E byte-exact).

**15. Developer Experience Impact.** A dispatch cache/unload change is now one edit in `DispatchRegistry`, not 6 hand-synced copies; the detector forward is testable with a fake net (no model download); the resume tracker now shows the #188 model-lifecycle half complete.

**16. Future Opportunities.** Remaining #187/#188: **S12** `PipelineParams` value-object (🔒 #192) and the **translator base-abstraction half** of #188 (`BaseGPTTranslator`, xhigh). `prepare`/`dispatch` could later share more if their divergence is ever paid down (currently load-bearing, left explicit).

**17. Lessons Learned.** Fold the mechanism, keep policy per-module: the get/cache/unload trio is identical (→ registry) but `prepare`/`dispatch` genuinely diverge (→ stay inline). Killing a global is safest when the replacement is threaded explicitly and pinned by a transform test. A code-complete branch that fell behind main lands cleanly when the two streams are disjoint (render vs dispatch) — rebase + full-suite is enough proof.

**18. KPI.** Byte-identical 100% (units + prior E2E byte-exact) · regressions 0 (342 pass) · dispatch boilerplate 6→1 · detection globals removed 3→0 · new coverage +7 cases · #188 model-lifecycle half complete (S3/S4/S20/S21/S22) · remaining: S12 (🔒#192) + BaseGPTTranslator.

*Validation:* `test_dispatch_registry` + `test_det_forward_default` + full suite (342 pass / 0 new fail on rebased main) + prior full-stack production-tunnel E2E (byte-exact patches). *Risk/rollback:* byte-identical; revert = drop the branch. *Links:* #188, #187, resume `docs/reports/mit-refactor-progress.md`.

## 2026-06-11 — #193 harden --start-instance worker lifecycle (port-collision + orphan cleanup)

Operational reliability fix for the two-port `--start-instance` model. Unlike the byte-identical refactors above this is a **behaviour change** (it adds a startup guard that can fail loudly and hardens shutdown), so it's scoped tightly: the happy path is preserved, only the failure/shutdown paths change. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** New `server/worker_lifecycle.py` (pure stdlib): `port_is_free(host, port)` (plain bind), `ensure_worker_port_free(worker_host, worker_port, front_port)` (raises a clear RuntimeError naming both ports + "free BOTH"), `terminate_process(proc, timeout)` (terminate → wait → kill escalation; idempotent on None/exited). `server/main.py`: `start_translator_client_proc` pre-checks the worker port, prints front+worker PIDs, and registers `atexit.register(terminate_process, proc)`; the signal handler and `__main__` (now `try/finally`) route through `terminate_process`. New `test/test_worker_lifecycle.py` (8) + a `MIT/README.md` "Worker lifecycle" section.

**2. Results.** A stale/orphaned worker on `P+1` is now **reported loudly at startup** instead of hanging the front forever on a `/register` that never comes; a graceful stop (Ctrl+C / SIGTERM) reliably terminates the worker via the atexit backstop (uvicorn overrides our signal handlers, so atexit is what actually fires). 8 unit pass; full suite **350 / 18 pre-existing async / 0 new fail**. Live entrypoint test: front 5003 while the running worker held 5004 raised the RuntimeError immediately, **before any ML load**.

**3. Expected performance gain %.** **No runtime perf change** on the happy path (same launch). The win is **operational**: it removes the repeated "kill front → orphan on 5004 → restart serves old code / hangs" cycle — minutes saved per dev/restart, and a class of "why is it serving stale code" confusion eliminated. Not measurable as CPU/latency.

**4. Benefits.** Restarts are deterministic (port-busy is reported, not silently hung); the worker can't outlive a graceful front stop; front+worker PIDs are logged for manual cleanup; the lifecycle logic is unit-tested without spawning a real worker; README documents the two-port model so the next operator doesn't relearn it.

**5. Purpose.** Kill the operational debt the issue calls out: the inline launch had no port-collision check, no PID tracking, and no orphan cleanup, and uvicorn silently overrode the only shutdown handler — so every MIT restart risked an orphan serving old code (hit repeatedly during render-parity dev, and again this session when a Store-python worker lingered).

**6. Why we changed it + architectural impact.** The launch was inline in `start_translator_client_proc` with a single signal handler that uvicorn clobbers. Architecturally the lifecycle moves into a small, pure, tested `worker_lifecycle` module, and shutdown is now defence-in-depth (signal handler + atexit + `__main__` finally, all idempotent) rather than a single fragile handler. Startup gains a fail-fast precondition.

**7. Problems before the refactor.** No worker-port collision check → the subprocess fails to bind and the front hangs forever on `/register`; uvicorn overrides the SIGINT/SIGTERM handlers → Ctrl+C leaks the worker; `__main__` only cleaned up `except Exception` (not on normal shutdown); no PID logging; the two-port restart procedure was undocumented (tribal knowledge in a memory file).

**8. Goals.** Detect a busy worker port at startup and report it (not hang); reliably stop the worker on a graceful front stop; track/log the worker PID; document the two-port lifecycle + restart; keep the happy-path launch unchanged; make the logic unit-testable without spawning a worker.

**9. Architecture Before.**
```
start_translator_client_proc(host, port, nonce, params):
    Popen(worker on port)          # no port-free check -> silent bind failure / hang
    register(...)
    signal SIGINT/SIGTERM -> proc.terminate()   # OVERRIDDEN by uvicorn at run() -> leaks on Ctrl+C
__main__: try: uvicorn.run() except Exception: proc.terminate()   # not on normal exit
```
**10. Architecture After.**
```
worker_lifecycle.py: port_is_free / ensure_worker_port_free (raise, name both ports) / terminate_process (term->kill, idempotent)
start_translator_client_proc:
    ensure_worker_port_free('127.0.0.1', port, params.port)   # fail loud, not hang
    Popen(worker); print front+worker PIDs; register(...)
    atexit.register(terminate_process, proc)                  # reliable backstop (survives uvicorn)
    signal SIGINT/SIGTERM -> terminate_process(proc)
__main__: try: uvicorn.run() finally: terminate_process(proc)
README: "Worker lifecycle (two-port model)" — restart kills BOTH ports
```
**11. Refactor list.**
| Piece | Where | Change |
|-------|-------|--------|
| port check | `worker_lifecycle.port_is_free` / `ensure_worker_port_free` | startup fail-fast on a busy worker port |
| cleanup | `worker_lifecycle.terminate_process` | terminate→kill escalation, idempotent |
| wiring | `server/main.py` | pre-check + PID log + atexit + signal + `__main__` finally |
| tests | `test/test_worker_lifecycle.py` | 8 cases, no worker spawned |
| docs | `MIT/README.md` | two-port lifecycle + restart steps |

**12. Metrics.** +1 module (`worker_lifecycle.py`, ~60 LOC) + 8 tests; `server/main.py` ~+15/−5 (port-check, PID print, atexit, finally); README +1 section. Suite 350 pass (342 → +8) / 0 new fail. Live collision test: fail-fast before ML load.

**13. Technical Debt Removed.** No-collision-check launch (hang-forever failure mode); uvicorn-clobbered single shutdown handler (worker leak on Ctrl+C); `except Exception`-only cleanup; undocumented two-port restart; untestable inline lifecycle.

**14. Risk Reduction.** Eliminates the orphaned-worker-serves-old-code class of bug at the source (loud collision report + reliable graceful cleanup). Residual: **force-kill (SIGKILL / `Stop-Process -Force`) cannot be caught** — documented in the README (restart must free BOTH ports), the honest limit of any in-process cleanup.

**15. Developer Experience Impact.** A restart that hits a stale worker now prints exactly what's wrong and how to fix it (free both ports) instead of hanging; front+worker PIDs are logged; the README section replaces tribal knowledge. The lifecycle is unit-testable, so future changes are guarded.

**16. Future Opportunities.** A `--stop` / pidfile-based single-command supervisor (the issue's optional "single stop cleans both"); parent-death detection so a force-killed front still reaps the worker (Windows job objects / POSIX `prctl(PR_SET_PDEATHSIG)`); auto-reclaim a stale worker on startup instead of erroring. All deferred (current scope = report + graceful cleanup, the high-value 80%).

**17. Lessons Learned.** uvicorn installs its own signal handlers at `run()`, so any handler registered before it is silently overridden — `atexit` (plus a `finally`) is the reliable cleanup hook, not `signal`. A fail-fast precondition with a message that names the fix ("free BOTH ports") beats a silent hang. Extracting the lifecycle into a pure stdlib module made it unit-testable without spawning a worker (fast, deterministic). ASCII-only operator messages avoid Windows-console mojibake.

**18. KPI.** Hang-on-collision eliminated (fail-fast, message names both ports + the fix) · graceful-stop orphan eliminated (atexit backstop) · +8 unit cases (no worker spawned) · 0 regressions (350 pass) · two-port restart documented · residual force-kill limit documented. Behaviour change (not byte-identical): happy path preserved.

*Validation:* `test_worker_lifecycle` (8) + full suite (350 pass / 0 new fail) + live entrypoint collision test (raised before ML load). *Risk/rollback:* behaviour change on failure/shutdown paths only; revert = drop the branch. *Links:* #193.

## 2026-06-11 — #192 config-parse seam (parse_and_validate_config) + scope decision

The valuable, safe slice of the remaining #192 config-hygiene work: one shared config-parse seam + a Pydantic-v2 migration. The audit's most useful output was deciding what NOT to do (load_dotenv, bare-excepts) — surfaced first below. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** Added `parse_and_validate_config(config: str) -> Config` to `config.py` (uses `Config.model_validate_json`); rewired the 11 scattered `Config.parse_raw` call sites (server/main.py ×10 + batch_runner.py ×1) + 2 tests to it; dropped the now-unused `Config` import from main.py; new `test/test_config_parse.py` (3). **Deliberately did NOT** change `load_dotenv` (deferred) or the bare-excepts (intentional).

**2. Results.** One parse/validate entry point for every endpoint instead of 11 copies; `parse_raw` (deprecated, removed in Pydantic v3) → `model_validate_json` everywhere (the ~13 deprecation warnings on parse go away). Byte-identical for valid configs: `test_config_parse` pins `parse_and_validate_config(j) == Config.parse_raw(j)`. Full suite **353 / 18 pre-existing async / 0 new fail**.

**3. Expected performance gain %.** **0% runtime.** Same parse, called through one function; the v2 method produces the identical Config. Value is maintainability (single validation point) + v3-readiness, not speed.

**4. Benefits.** Validation/error policy for the config now has one home (future tightening lands once, not 11×); the deprecation is gone (v3-ready); the seam is unit-pinned including an equality check against the legacy path; the audit documented two non-changes so they aren't re-opened.

**5. Purpose.** Satisfy the #192 "one config parse/validate path shared by all endpoints" criterion without churning the risky/low-ROI parts the issue also listed — pay down the real debt, leave the correct-as-is code alone (north star).

**6. Why we changed it + architectural impact.** 11 identical `Config.parse_raw` calls is a copy-paste seam with no single place to add validation or migrate the API. The seam centralises it. Architecturally minor (one function + call-site rewire), but it's the carriage point a future config-validation policy or error-shaping would attach to.

**7. Problems before the refactor.** 11 duplicated parse calls; the deprecated `parse_raw` API across all of them (v3 breakage waiting); no single validation seam; (per the issue) load_dotenv import side-effect + bare-excepts — **audited and found load_dotenv high-risk/low-ROI and the bare-excepts intentional**, so left as documented known-state.

**8. Goals.** One shared parse seam; migrate off deprecated `parse_raw`; prove byte-identical for valid configs; don't touch correct-but-flagged code (bare-excepts) or take import-order risk for low ROI (load_dotenv); keep the suite green.

**9. Architecture Before.**
```
server/main.py:    Config.parse_raw(config)   ×10   (deprecated API, no shared seam)
server/batch_runner.py: Config.parse_raw(config_str)
test_image_model_config.py: Config.parse_raw(...) ×2
manga_translator/__init__.py:5  load_dotenv()        # import side-effect (flagged)
manga_translator.py:  7× bare except Exception        # flagged — but all intentional
```
**10. Architecture After.**
```
config.py:  parse_and_validate_config(config) -> Config   # one seam, model_validate_json (v2)
 └─ server/main.py ×10 · batch_runner.py · test_image_model_config.py  all call it
test_config_parse.py: representative-config · ==legacy-parse_raw · invalid-raises
load_dotenv: UNCHANGED (import-order risk > ROI; documented)
bare-excepts: UNCHANGED (intentional broad catches; documented)
```
**11. Refactor list.**
| Piece | Where | Change |
|-------|-------|--------|
| seam | `config.py` `parse_and_validate_config` | one parse+validate fn, `model_validate_json` |
| rewire | server/main.py ×10, batch_runner.py ×1 | call the seam; drop unused `Config` import |
| tests | test_config_parse.py (new) + test_image_model_config.py | seam == legacy parse_raw; invalid raises |
| audit | DONE.md / this report | load_dotenv deferred; bare-excepts intentional (documented) |

**12. Metrics.** +1 fn (~10 LOC) + 3 tests; 11 call sites + 2 tests rewired; 1 unused import removed; ~13 parse deprecation warnings eliminated. Suite 353 (350 → +3) / 0 new fail.

**13. Technical Debt Removed.** 11 duplicated parse calls → 1 seam; deprecated `parse_raw` API (v3 breakage) eliminated; the "no single config-parse path" gap closed; the audit converted two vague "todo: refactor" flags into a documented decision.

**14. Risk Reduction.** v3 won't break config parsing (off the deprecated API); a future config-validation change can't drift across 11 sites. The migration is pinned byte-identical (== legacy). Deliberately avoided the two risk sources the issue flagged (import-order via load_dotenv; semantic drift via narrowing intentional excepts).

**15. Developer Experience Impact.** A config-validation tweak is one edit at the seam; the parse path is greppable (`parse_and_validate_config`) instead of 11 `parse_raw`; no more deprecation-warning noise in test output.

**16. Future Opportunities.** `load_dotenv` → explicit `initialize()` (needs every entrypoint audited for import-time env reads — high-risk, only if a real test-determinism problem appears). Validate `target_lang` against `VALID_LANGUAGES` / convert to enum (the inline config.py todos). S12 `PipelineParams` value-object (#187). All deferred by design.

**17. Lessons Learned.** The highest-value review output can be "don't do this": the bare-excepts read as debt in the issue but are load-bearing broad catches (log-never-crash / best-effort / ignore_errors) — narrowing them is negative-value, so the right move is to document them as intentional. Pin an API migration with an equality test against the old path (`new(j) == old(j)`) so "behaviour-preserving" is proven, not asserted.

**18. KPI.** Single config-parse seam (11→1) · deprecated `parse_raw` removed (v3-ready) · byte-identical (==legacy test) · 0 regressions (353 pass) · 2 flagged items audited + documented as deliberate non-changes (load_dotenv risk, intentional excepts) · #192 criteria met except the documented load_dotenv deferral.

*Validation:* `test_config_parse` (3, incl. ==legacy) + `test_image_model_config` (2, rewired) + full suite (353 / 0 new fail). *Risk/rollback:* behaviour-preserving for valid configs; revert = drop the branch. *Links:* #192 (advanced; load_dotenv deferred).

## 2026-06-11 — #191 remove vendored SD/LDM inpainter + ctd/YOLOv5 detector (~14.4k LOC)

The largest single cleanup of the tech-debt batch: delete two unused, unmaintained vendored upstream subsystems. Gated on a roadmap check (the dev's condition) before any deletion. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** Deleted the SD/LDM inpainter (`inpainting/ldm/**` ~11.7k LOC + `guided_ldm_inpainting.py` / `inpainting_sd.py` / `sd_hack.py` / `booru_tagger.py` + 2 SD yaml configs) and the ComicTextDetector + vendored YOLOv5 (`detection/ctd.py` + `detection/ctd_utils/**` ~2.3k LOC, GPL). Rewired the enums (`Inpainter.sd`, `Detector.ctd`), the `INPAINTERS`/`DETECTORS` registries, the imports, the `<option value="sd">` web-UI entry, and dropped the SD-exclusive `open_clip_torch` dep. New `test/test_registry_trim.py`.

**2. Results.** **−14,405 LOC** across 56 files. Production path untouched (Backend sends `lama_large` + default/dbnet; `sd`/`ctd` were never sent and Backend has zero refs). Registries build clean with no dangling imports (verified by smoke). Full suite **357 / 18 pre-existing async / 0 new failures**.

**3. Expected performance gain %.** **No runtime change** (the removed code was never on the production path). The win is **maintenance + supply-chain**: ~14.4k LOC of vendored ML code (the largest CUDA/torch-upgrade liability in MIT) and a **GPL** dependency (YOLOv5) are gone — smaller clone, faster CI checkout, no GPL-compatibility question, no manual diffing on torch upgrades.

**4. Benefits.** Removes the single biggest vendored-code maintenance burden; resolves the YOLOv5 GPL license concern; shrinks the import/attack surface; aligns the codebase with the chosen roadmap (Flux-via-diffusers + ultralytics-YOLO) by clearing the superseded baggage first; the trim is pinned so it can't silently regress on an upstream re-sync.

**5. Purpose.** Pay down the vendored-code debt the issue flags: ~14k LOC of CompVis-LDM + GPL-YOLOv5 carried from upstream, unused by MangaDock (lama_large + DBNet), with stale deps and license ambiguity.

**6. Why we changed it + architectural impact.** Vendored ML subsystems rot (manual CUDA/torch diffs, no upstream fix flow) and the YOLOv5 GPL is a real license-compat risk. Architecturally the inpainter/detector dispatch shrinks to the maintained set; the seam (DispatchRegistry from S22) made the removal a registry-entry + enum delete, not surgery. Roadmap-aligned: MangaTranslator (our reference) uses Flux/diffusers + ultralytics, so this clears the old path the new one replaces.

**7. Problems before the refactor.** ~11.7k LOC vendored CompVis LDM + ~2.3k LOC vendored YOLOv5 (GPL); both selectable but unused in production; stale deps (`open_clip_torch`); CUDA/torch upgrades required hand-diffing the vendored code; a GPL-vs-project-license question left open.

**8. Goals.** Remove both subsystems without touching the production path; verify the removal doesn't block the MangaTranslator roadmap (the dev's explicit condition); keep the remaining inpainters/detectors intact; pin the trim with a test; byte-identical production render.

**9. Architecture Before.**
```
INPAINTERS: default(aot) · lama_large · lama_mpe · sd(StableDiffusion→guided_ldm→ldm/** ~11.7k) · none · original
DETECTORS:  default(DBNet) · dbconvnext · ctd(ComicText→ctd_utils/** incl. GPL yolov5 ~2.3k) · craft · paddle · none
deps: ... open_clip_torch (SD-only) ...
```
**10. Architecture After.**
```
INPAINTERS: default(aot) · lama_large · lama_mpe · none · original          [sd + ldm/** gone]
DETECTORS:  default(DBNet) · dbconvnext · craft · paddle · none             [ctd + ctd_utils/** gone]
deps: open_clip_torch removed (kornia/einops/omegaconf/transformers kept — used elsewhere)
test/test_registry_trim.py pins: sd/ctd absent, production set intact
roadmap: Flux/diffusers + ultralytics YOLO (replacements, added fresh when needed)
```
**11. Refactor list.**
| Piece | Change |
|-------|--------|
| SD files | delete ldm/** + guided_ldm + inpainting_sd + sd_hack + booru_tagger + 2 yaml |
| SD wiring | drop `Inpainter.sd` (enum + INPAINTERS) + import + web-UI option + `open_clip_torch` dep |
| ctd files | delete ctd.py + ctd_utils/** (incl. GPL yolov5) |
| ctd wiring | drop `Detector.ctd` (enum + DETECTORS) + import |
| docs | PIPELINE.md §3.1 + §5 + mit-hidden-capabilities + DONE.md + this report |
| test | test_registry_trim.py (4) |

**12. Metrics.** −14,405 LOC / 56 files; 2 enum members + 2 registry entries + 2 imports + 1 web-UI option + 1 dep removed; +4 pinning tests. Suite 357 (353 → +4) / 0 new fail. 1 GPL dependency eliminated.

**13. Technical Debt Removed.** ~11.7k LOC vendored CompVis LDM; ~2.3k LOC vendored YOLOv5 (GPL); the `open_clip_torch` SD-only dep; the CUDA/torch hand-diff burden on the vendored ML; the unresolved GPL-license question; two selectable-but-unused pipeline options.

**14. Risk Reduction.** Eliminates a GPL-compatibility liability and the largest vendored-ML maintenance surface. Production is byte-identical (removed code never on the Backend path; verified zero Backend refs + import smoke). The trim is pinned, so an upstream re-sync that reintroduces sd/ctd fails the test instead of silently dragging the baggage back.

**15. Developer Experience Impact.** Smaller repo + clone + CI checkout; torch/CUDA upgrades no longer require diffing vendored LDM; no GPL question hanging over the detector; the inpainter/detector option lists are now exactly what's actually supported.

**16. Future Opportunities.** Add Flux inpainting via `diffusers` + ultralytics-YOLO detection fresh (the roadmap path) if/when wanted — cleanly, not on top of the old vendored code. Optionally delete the now-dead, unrelated `inpainting_attn.py` (left out of #191 scope). Audit other vendored dirs for similar trims.

**17. Lessons Learned.** Gate a big irreversible-feeling deletion on the actual roadmap, not assumption: checking MangaTranslator's `requirements.txt` (diffusers + ultralytics) turned "might we need SD/ctd later?" into a definite "the roadmap replaces them." Verify exclusivity before deleting shared-looking dirs (confirmed `ctd_utils` is ctd-only, `booru_tagger` is SD-only, `open_clip_torch` is SD-only) and keep deps that are used elsewhere (kornia/einops). The S22 DispatchRegistry seam made a 14k-LOC removal a few enum/registry edits.

**18. KPI.** −14,405 LOC (largest batch cleanup) · 1 GPL dep removed · 0 regressions (357 pass) · production byte-identical (zero Backend refs + smoke) · roadmap-aligned (Flux/diffusers + ultralytics replace the removed) · trim pinned (4 tests).

*Validation:* import smoke (registries build, no dangling imports) + `test_registry_trim` (4) + full suite (357 / 0 new fail) + roadmap check (MangaTranslator uses diffusers/Flux + ultralytics, not the vendored LDM/YOLOv5). *Risk/rollback:* byte-identical production; revert = restore the branch (large diff, but git-clean). *Links:* #191, roadmap `C:\Github\MangaDock\MangaTranslator`.

## 2026-06-11 — #187 S12 PipelineParams value-object (last god-object seam → #187 CLOSED)

The final seam of the MIT god-object decomposition: extract `parse_init_params`' field/device/raise logic into a `PipelineParams` value-object, closing #187 (all S1-S26 landed) and the MIT tech-debt category (6/6). Byte-identical, TDD red→green. Full 18-section template ([[feedback-impact-report]]).

**1. What changed.** `pipeline_params.py` gained a `PipelineParams` dataclass (13 fields + `using_gpu` property) + `from_params(params, batch_concurrent)` — the verbatim extraction of the constructor's parsing (device computation, gpu-limited promotion, cuda/mps-availability raise, `batch_concurrent` auto-disable, field parsing). `manga_translator.py`'s `parse_init_params` now delegates to it and assigns `self.X = pp.X`. New: 8 characterization tests (torch availability mocked).

**2. Results.** The constructor's ~35-line parsing block is now a testable value-object; `parse_init_params` is a thin assignment list. Byte-identical (the logic is a verbatim move). TDD: 8 tests RED → GREEN. `test_pipeline_params.py` 11 pass; full suite **365 / 18 pre-existing async / 0 new fail**. **#187 closed → MIT tech-debt category 6/6.**

**3. Expected performance gain %.** **0% runtime — byte-identical.** Same parsing, same device logic, same raise; only the carriage moved. No latency/VRAM change.

**4. Benefits.** The device/`using_gpu`/gpu-limited/raise logic — previously only reachable by constructing a full `MangaTranslator` — is now unit-testable in isolation with mocked torch availability (8 cases pin every branch); the constructor is thinner; #187 is finally complete (the decomposition's last seam).

**5. Purpose.** Close out #187: the last piece of breaking up the ~3000-line god object. S12 was deferred until #192 centralised config; with #192 done and the entanglement analysed as a self-contained method, the extraction is now safe.

**6. Why we changed it + architectural impact.** Param-parsing buried in a constructor (with a process-raising side effect + a property read mid-parse) is untestable without heavy construction. Architecturally the parsing becomes a value-object (`PipelineParams.from_params`) the constructor reads — the same "extract a pure-ish unit, delegate from the driver" pattern as the other 25 seams. `MangaTranslator.using_gpu` stays (reads `self.device`); `_is_gpu` mirrors it inside the value-object.

**7. Problems before the refactor.** ~35 lines of parsing inline in `__init__`/`parse_init_params`; device/`using_gpu`/gpu-limited/raise logic order-sensitive and only testable via full construction; the `batch_concurrent` validation read+mutated `self`; flagged "entangled" and deferred.

**8. Goals.** Byte-identical extraction; value-object unit-testable without constructing `MangaTranslator`; preserve the device logic, the raise, the batch_concurrent auto-disable, and the constructor foot-guns (`kernel_size` no-default); full suite green; close #187.

**9. Architecture Before.**
```
MangaTranslator.parse_init_params(params):
   self.verbose/use_mtpe/font_path/models_ttl/batch_size = params.get(...)
   if self.batch_concurrent and self.batch_size < 2: warn + self.batch_concurrent = False
   self.device = ... (use_gpu? mps/cuda : cpu); gpu-limited promotion; raise if no cuda/mps
   self.kernel_size/input_files/save_text/load_text = params.get(...)
   # only testable by constructing the whole god object
```
**10. Architecture After.**
```
pipeline_params.py:
   _is_gpu(device)                         # body of MangaTranslator.using_gpu
   @dataclass PipelineParams(13 fields; using_gpu property)
       from_params(params, batch_concurrent) -> PipelineParams   # the verbatim parse logic
MangaTranslator.parse_init_params(params):
   pp = PipelineParams.from_params(params, self.batch_concurrent); self.X = pp.X  (×13)
test_pipeline_params.py: 8 char cases (torch availability mocked) + 3 existing globals cases
```
**11. Refactor list.**
| Piece | Where | Change |
|-------|-------|--------|
| value-object | `pipeline_params.py` | `PipelineParams` dataclass + `from_params` + `_is_gpu` |
| delegate | `manga_translator.py` | `parse_init_params` → `from_params` + 13 assignments + import |
| tests | `test_pipeline_params.py` | +8 characterization cases |
| docs | progress tracker / PIPELINE §5 / DONE.md / this report | S12 ✅, #187 DONE |

**12. Metrics.** `pipeline_params.py` +~60 LOC (value-object); `manga_translator.py` ~−20 inline parsing → thin delegation; +8 tests. Suite 357 → **365** / 0 new fail. #187: 26/26 seams done.

**13. Technical Debt Removed.** The last inline parsing block of the god object; an untestable-without-construction device/raise path; the read+mutate-`self` batch_concurrent validation; the "S12 deferred" item on the resume tracker.

**14. Risk Reduction.** The device/gpu-limited/raise logic is now pinned by 8 unit cases (mocked availability) instead of being exercised only incidentally during construction; byte-identical ⇒ no behaviour regression (full suite constructs `MangaTranslator` and stays green).

**15. Developer Experience Impact.** Device-selection logic is editable + testable in one small module without spinning up the translator; the constructor reads as a field list; the decomposition tracker now shows #187 complete (no open seam to resume).

**16. Future Opportunities.** The inline `#todo: fix why is kernel size loaded in the constructor` is now isolated in `from_params` (easy to address later); `kernel_size`'s no-default foot-gun could get a default; `parse_init_params` could eventually be inlined into `__init__` since it's now trivial. All optional.

**17. Lessons Learned.** A "deferred — entangled" seam is often tractable once you read the actual entanglement: here the device/`using_gpu`/raise coupling was a self-contained method, and moving the raise into the value-object is byte-identical because a raising constructor yields an unusable object either way. Mock torch availability to make device-branch logic deterministic + fast to test. Keep foot-guns verbatim in a byte-identical pass (the `kernel_size` no-default).

**18. KPI.** #187 CLOSED (26/26 seams) · MIT tech-debt category **6/6** · byte-identical (verbatim move + suite green) · 0 regressions (365 pass) · +8 isolated tests for previously-construction-only logic · 1 cosmetic delta (logger name, documented).

*Validation:* TDD red→green; `test_pipeline_params.py` 11 pass (3 globals + 8 value-object) + full suite (365 / 0 new fail). *Risk/rollback:* byte-identical; revert = drop the branch. *Cosmetic delta:* the batch_concurrent warning logs under the `pipeline_params` logger name (same message/level/effect). *Links:* #187, #188, resume `docs/reports/mit-refactor-progress.md`.
