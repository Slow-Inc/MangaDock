<!-- lang:en -->
# DONE — Claude Code Session Log

---

## S18 PostTranslationProcessor — relocate (not unify) 4 copies (2026-06-10, /tdd)

The documented S18 premise was "unify 4 copies of post-translation processing". Close reading showed the four are **not** a clean byte-identical dedup: the genuinely-identical part (`filter_translated_regions`) was already extracted in S1, and the three phase-2 retry loops are **structurally divergent and load-bearing** (L6/L8) — single uses min_ratio 0.5 / threshold ≥6 / pad-with-empty + enumerate; concurrent uses 0.3 / ≥6 / filter + text_idx; batch uses 0.5 / >10 / cross-context region_mapping, plus divergent log strings. Forcing them into one function needs per-scope collect/reassign/log callbacks — that *adds* complexity to prop up a merge, against the North Star. The user steered "reduce long-term debt", so the chosen interpretation is **relocate + make testable + pin the divergence as explicit params**, not unify.

New module `MIT/manga_translator/post_translation.py` + `test_post_translation.py` (13 characterization cases), four byte-identical increments, one commit each:
- **S18a** `apply_post_translation_processing` — punct + post-dict + phase-1 repetition retry (the helper batch/concurrent share); two self-bound async steps become callbacks. Updated the punctuation wiring test for the move (1 inline call in the god object + 1 in the module).
- **S18b** `concurrent_page_lang_check_retry` — concurrent phase-2 (0.3 / ≥6, filter + text_idx).
- **S18c** `single_page_lang_check_retry` — single phase-2 (0.5 / ≥6, pad + enumerate, skip-log + unified success/failure message).
- **S18d** `batch_lang_check_retry` — batch phase-2 (0.5 / >10, cross-context region_mapping).

Each driver now delegates; L6 thresholds/ratios and the L8 index-dropping re-translate are preserved verbatim. Suite throughout: 18 async-only baseline, **295 passed**. The single driver's own phase-1 variant (side-effect retry, no per-region try/except, different logging) is documented and left inline — unifying it with the helper would change logging/error behaviour, a flagged change for later.

## E2E validation — S17/S21 refactor stack via production tunnel (2026-06-10)

Brought up the full stack (Redis → cache:reset → MIT 5003 `--use-gpu --start-instance` → Backend 4001 → Frontend 4000 → cloudflared tunnel) and ran the mandatory original↔translated comparison through **`https://hayateotsu.space/`** (never localhost — per `frontend-testing` skill). Test page: **Kouchuugun Shikan Boukensha ni Naru** ch1 "Emergency Landing" page 1 (EN→TH, custom_openai/9arm).

- **Result: PASS, output byte-identical to documented baseline.** `[MangaPatches] page=0 → 2 patches`, POST `translate-patches` → **201** (37s). Patch geometry **649×1492 + 451×1489** — matches the skill's recorded bubble-seg-OFF baseline exactly (render knobs gated off → byte-identical, as designed). Thai text correctly positioned in the caption columns, art/layout/panel positions preserved vs the original screenshot. No 500s; the only errors were the standard `/pages` 401→200 HWID auth handshake (pre-existing, unrelated to translation).
- **What this validates:** the refactor stack on the hot path — **S21 ModelLifecycle** (preload + ensure_running, runs on every translate), S13 detection_postproc, S16 TranslationMemory, S19 gather_per_context — produces unchanged output end-to-end. (S17's chatgpt-specific dispatch is not exercised by the custom_openai path, but the surrounding orchestration is.) Screenshots: `e2e-s17-p1-original.png`, `e2e-s17-p1-translated.png`.

## MIT test-suite pollution fix — sys.modules restore (2026-06-10)

While running the full MIT suite to validate the S17 stack, the full `pytest` run showed **26 failed** — 18 the known async-only baseline (`async def functions are not natively supported`, pytest-asyncio inactive) plus **8 non-async** that all *passed in isolation* (`test_detection_postproc`, `test_series_context`, `test_mit_config` ×6). Root cause: `test_precision.py` + `test_qwen3_translator.py` install `_stub('omegaconf')` / `_stub('manga_translator')` into `sys.modules` at **module import time** (so qwen3.py loads without torch/the real package) and never restore them. pytest imports those root files during **collection**, so the empty stubs shadow the real modules for every test collected afterwards; any later test that imports the real `omegaconf` / `manga_translator.config` then breaks.

- **Pre-existing, not a refactor regression:** git confirms both polluter files sit on `main` untouched by the #187/#188 stack; `pytest test/` alone (root files not collected) = clean 18 async-only. S13 merely *added* `test_detection_postproc.py`, which became a 3rd victim (its code passes in isolation).
- **Fix:** snapshot the affected `sys.modules` entries before stubbing, restore them right after the module-under-test is loaded (it keeps its own references; the tests only touch the loaded symbols). `test_precision.py` deliberately leaves `torch`/`transformers`/`bitsandbytes` stubbed — its `build_load_kwargs` tests resolve those at call time.
- **Result:** full suite **26 → 18 failed** (just the async baseline), **282 passed** (+8). precision+qwen3 own tests 12/12 green. Touch = 2 test files, +55 lines, zero production code. Commit `0db9479` on `refactor/mit-seam-s17-text-translation-dispatcher`.

## #179 narrow-column safe-area + adversarial bug hunt (2026-06-08, /tdd + Karpathy)

**#179 (root-cause render parity):** new pure `MIT/manga_translator/safe_area.py` — `safe_area_box(mask)` = distance-transform safe-interior + pole-of-inaccessibility anchor (ported from MangaTranslator image_utils.py). Wired: `_tag_regions_with_bubbles` carries `bubble_polygon`; `_build_local_region` shifts it into crop coords; renderer `_bubble_interior_box` rasterizes the polygon → mask → `safe_area_box` and wraps to the **interior width** centered on the anchor (narrow column) instead of the bbox. Opt-in under `bubble_area_fit`; off → byte-identical. `test_safe_area.py` 5 green (incl conjoined-neck pole). **E2E (One Punch-Man JA→EN, ab_benchmark + MCP_DOCKER UI):** top-left narration now renders as a narrow column with hyphenated "some-where" — visibly closer to the reference (was a wide paragraph). UI path clean: zero 500/404 (only the pre-existing forum 404). `benchmark_compare_179.png`.

**Adversarial bug hunt (12+ agent workflow, 25 candidates → 16 confirmed):** fixed the 4 that sit in the code being touched:
- **[blocker] ZeroDivision** in `resize_regions_to_font_size` legacy single-axis expansion when `used_rows/used_cols == 0` → guarded `> 0`.
- **[major] whitespace-only translation** entered bubble_fit (truthy but blank → large font for invisible text) → added `region.translation.strip()` guard.
- **[major] empty `widths`** from calc_horizontal made `block_w=0` → every size "fits" → max font → measure now treats empty widths as no-fit (`inf`).
- **[major] `union_box` float truncation** shrank the crop (int() truncates a float max inward, clipping the balloon) → floor mins / ceil maxes. (`test_union_box_does_not_shrink_on_float_coords`).
- Logic tests: 41 green across safe_area/font_fit/bubble_association/render/thai (1 pre-existing async-plugin fail).

**Confirmed bugs deferred (mapped / triaged, NOT yet fixed):** dst_points exceed image bounds (clipping commented out) → **#183**; vertical regions never fitted → **#182**; **Backend [major] batch `buildJobKey` breaks on a `ver:` chapterId** (colon splits the jobKey) — real, in the batch path, needs the same `:`→`_` normalization as PatchStore (not yet filed); patch cache-key `jobModel` divergence (needs verify); minor: fit_font_size margin≤0 guard, ver:/ver_ sanitize collision, control-char traversal, HMAC hex format, cache:reset Redis-misconfig silent pass. L1-not-cleared-by-cache:reset is already documented + the script now prints a restart reminder.
PIPELINE.md §5 updated. Not committed.

## Render Parity — PRD #178 + vertical-slice issues (2026-06-08, /to-prd + /to-issues)

After the deep dissection, the user decided the direction (narrow-column + 4× supersampling + real vertical + SFX) and asked to break it into a PRD + issues. Filed:
- **PRD #178** — "Render Parity with MangaTranslator" (bilingual, ready-for-agent): problem/solution, 26 user stories, deep-module plan (`safe_area`, `line_break`, `vertical_layout`, supersample seam, inpaint-fidelity helpers), testing decisions (pure modules + source-inspection wiring + byte-identical-when-off + benchmark E2E), VRAM framing (5–7/12GB now vs legacy 11.5GB SD/LDM, headroom for AnimeText + quantized diffusion opt-in). Parent of the render-quality issues; extends PRD #169.
- **New vertical slices (all ready-for-agent, opt-in, byte-identical-off):** #179 mask-aware narrow-column wrap + safe-area centering (root cause) · #180 Knuth-Plass + kinsoku + hyphenation [blocked-by #179] · #181 4× supersampling · #182 real vertical layout + auto-orientation · #183 squeeze-on-collision + pre-warp bounds check.
- **Existing children of #178:** #168 SFX, #171 emphasis, #172/#167 OCR, #173 feather, #174 flat-fill, #175 sizing, #176 font, #161 glossary.
- **Deferred (in PRD, file when reached):** LAB luminance-match, translation determinism (temp 0.1 + gate), quantized diffusion inpainter (re-adopt legacy SD/LDM behind a flag).
- No code changed. Next: /tdd the cheap visible wins (#175 cap, #181 supersampling, #179 narrow-column) and #168 SFX.

## Research — translator deep dissection: MangaTranslator vs ours (2026-06-08, ultracode workflow)

User asked to fully dissect MangaTranslator (techniques/models/methods), survey our MIT + Backend, analyze why ours is worse, and surface black boxes in both. Ran a 12-agent dissection workflow (9 per-stage dissectors reading both codebases + 3 synthesizers; 1.24M subagent tokens) + a gap-fill agent for detection. New canonical doc: **`docs/research/translator-deep-dissection.md`** (~70KB) — full pipeline dissection (detection/OCR/translation/cleaning-inpaint/layout/render/orchestration + complete ML model inventory), our MIT+Backend inventory, an 8-dimension "why ours is worse" table mapped to issues, and an honest black-box ledger (both codebases, tagged verify-by: read-code | run-experiment | ask-author).
- **Headline (models/VRAM):** theirs = FLUX inpaint (8–15GB) + SAM2/SAM3 + AnimeText YOLO + 4× supersampling; ours = LaMa (~1–2GB) + DBNet + 48px CNN. They buy photoreal inpaint + crisp text + glossary/emphasis context at 8–15GB; we run at 1–2GB. Dev box has headroom (5–7/12GB used).
- **Root-cause one-liner:** we adopted upstream's *correct* engine but ship it **untuned** — heuristic font-fit instead of safe-area + collision binary-search, no supersampling, greedy wrap instead of DP+kinsoku, LaMa without feathering/luminance-match, temp 0.5 without emphasis/glossary. **Most fixes are porting upstream's already-written logic into our patch path behind opt-in seams, not new research.**
- **Why-worse ranked → issues:** seams #173 · font/supersampling #175+new · overflow/vertical #175+new · anchoring new · line-break/kinsoku new · SFX #168 · OCR upscale #172/#167 · translation tuning #171/#161/new.
- Decided direction in memory `project_render_parity_direction` (narrow-column mask-aware wrap + 4× supersampling + real vertical Latin + SFX opt-in). Doc cross-links `mangatranslator-internals` + `round2-deep`. No code changed this round.

## #175 bubble-fit anti-overflow sizing (2026-06-08, /tdd, /to-issues)

User flagged (with screenshots) that #166's fitted text renders too big and clips at the balloon/panel edge. Filed #175 (sizing) + #176 (comic font) via /to-issues. Fixed #175's sizing:
- **Pure** `fit_font_size` gained a `margin` param — fits to a fraction (0.92) of the box so glyph ascent/descent slack can't touch the edge (unit-tested; `margin=1.0` default keeps existing callers byte-identical).
- **Renderer** `_bubble_fit_font_size`: real per-line height (`_LINE_HEIGHT=1.2`), `_FIT_MARGIN=0.92`, relative cap `_MAX_FONT_BOX_RATIO=0.5`. **Crucially**, calc_horizontal is now wrapped to the *margin'd* width too — without that the search floored at `low=8` (lines calc made for the full width always exceeded the margin'd fit-test). Did **not** copy MangaTranslator's flat `max=16` (would regress to tiny on our full-res pages).
- **Diagnosis (mantra)**: instrumented `resize_regions_to_font_size` to a file (the `--start-instance` worker logs in a child process — also caught a real ops bug: killing only the :5003 listener orphans the :5004 instance, so code edits silently don't take effect; must kill both ports). Ground truth: bubble-fit regions sized 8–54; the `font=8` floor on the top-left narration box was the margin/calc-width mismatch (now fixed → 41); the bottom-right clip is a **LEGACY-path** region (`hasbub=False`, no fit-to-box) — out of #175's scope.
- **E2E** (One Punch-Man JA→EN, `ab_benchmark.py`): top-left narration now fills its box (was tiny font 8), text fits within boxes, clipping largely gone. Visible jump toward the reference (~45% → ~60-65%). `benchmark_compare_175.png`.
- Tests: `test_font_fit.py` + `test_bubble_association.py` 23 green; targeted render/thai sweep 35 green (1 pre-existing async-plugin fail). PIPELINE.md §5 updated. **#175 NOT closed — awaiting user confirm.**
- **Remaining gap (new finding)**: non-bubble regions use the legacy path with no fit-to-box → they can still overflow (bottom-right). Plus SFX untranslated (#168) and typeface (#176). Candidate follow-up: extend fit-to-box to legacy regions or improve bubble coverage. Not committed.

## MIT benchmark vs MangaTranslator + upload→translate fix (2026-06-08, /tdd)

Stood up the full stack (frontend+backend+MIT worker+cloudflared tunnel) and drove the One Punch-Man "Benchmark Pipeline MIT" page (uploaded JA) through the UI via Playwright to compare against MangaTranslator's reference (`MIT/example_translation.jpg`). New `MIT/BENCHMARK.md` records the canonical test case + scorecard; throwaway harness `MIT/tools/ab_benchmark.py` translates it JA→EN directly through the worker and composites the patches.
- **Result: ~40–50% of MangaTranslator on this page.** Translation text comparable; the gap is rendering+coverage: rectangular **narration boxes under-fill** (speech-bubble YOLO doesn't detect them → no `bubble_box` → #166 can't engage), **SFX untranslated** (ぬ→"LOOM"; #168 not built), **edge clipping** on the right column. #166 binary-search is correct but only lifts detected speech bubbles — this page is narration+SFX heavy, out of its scope.
- **Bug #1 FIXED (TDD)** — `loadPageBytes` (`page-source.ts`) couldn't load an uploaded page: the Reader sends a relative `/api/proxy/uploads/...` URL → `fetch` "Failed to parse URL" → 500. Added `isLocalUploadPath` + disk read under the uploads root (handles `/uploads/` and `/api/proxy/uploads/` prefixes, same traversal guards as img-cache); `loadPageBytes` gained `uploadsRoot` opt, wired at both call sites. `page-source.spec` 12 green (+4). Rebuilt+restarted backend; the page now reaches the worker and renders.
- **Bug #2 FIXED (/debug-mantra, TDD)** — after the worker succeeded, storing patches 500'd: `PatchStore: unsafe chapterId segment: "ver:752fc515-..."`. Uploaded "version" chapters carry a `ver:` prefix whose `:` failed PatchStore's `/^[\w.-]+$/` guard. Reproduced with a unit test (`put({chapterId:'ver:<uuid>'})` → throws), fixed by normalizing `:` → `_` in `PatchStore.put` before the guard (`toPathSegment`) so the dir is `ver_<uuid>`; `/`,`\`,`..` still throw (traversal contract preserved — that test stays green). `patch-store.spec` 13 green (+1). **Confirmed E2E via Playwright on `hayateotsu.space`: the uploaded chapter now translates fully — toolbar "✓ แปลแล้ว", EN patches overlay the page, zero 500s.** This was the real-world repro the unit test stood in for.
- Stack left running (worker :5003, backend :4001 with #166 flags, frontend :4000, tunnel up). Not committed.

## #166 — direct-worker E2E proof (2026-06-08)

Tunnel (`hayateotsu.space`) was down (CF 530) so the Playwright path was blocked; proved the render change by driving the MIT worker directly instead (cleaner isolation of the change anyway). New throwaway diag `MIT/tools/ab_bubble_fit.py`: POSTs `tools/_bubble_proof/page01.jpg` to `:5003/translate/with-form/patches` with `bubble_area_fit` OFF vs ON (both `det_bubble_seg` on, `ocr.prob 0.03`), composites the returned patches onto the page → `before.png` / `after_fitoff.png` / `after_fiton.png`.
- **Result:** translation works end-to-end (EN→TH via custom_openai gateway, 24 regions). The bottom-right speech balloon renders **large, clean, balloon-filling Thai** under ON vs tiny/untranslated under OFF — **no clipping, no overlap** → the binary-search fit + the two scrutinize fixes (union_box crop-expansion, sole-occupant gate) hold in a real render.
- **Honest caveats:** (1) the runs differ in patch count (OFF 6 / ON 7) — `bubble_area_fit` ON legitimately changes the crop via `union_box`, so it's not a byte-isolated A/B; the bottom-right box was rescued only under ON. (2) Most **rectangular narration boxes still render small in both** — the `kitsumed/yolov8m_seg-speech-bubble` model targets rounded dialogue balloons, not narration boxes, so they get no `bubble_box` and fall to the legacy path. Covering narration boxes is out of #166's scope (needs a different detector / the OSB+panel path).
- First attempt returned 0 patches: the diag set `source_lang_only=JPN` but page01 is an English scan → all 24 regions dropped by the lang filter; fixed by leaving source `ANY`. Worker left running on :5003. Not committed.

## #166 binary-search — scrutinize fixes: clip + overlap (2026-06-08, /tdd)

`/scrutinize` of the binary-search work surfaced two blockers in the patch-crop seam (both hit exactly the target "loose balloon" case, so they'd look *worse* than before under `MIT_BUBBLE_AREA_FIT=1`). Fixed via TDD before any E2E:
- **Blocker 1 — clipping:** the crop is sized to text-lines (+pad+render_extra=120px); a balloon larger than that overflowed it, so the balloon-sized fitted text rendered cut off at the patch edge. Fix: new pure `bubble_association.union_box()` (clamped axis-aligned union) grows the crop to cover the group's balloons in `_process_group`, gated on `config.render.bubble_area_fit`. 3 tests.
- **Blocker 2 — overlap:** a multi-region balloon (`_group_nearby_regions` keeps a multi-line balloon as one group) had every region fit to and render into the *same* full-balloon rect → stacking. Fix: new pure `bubble_association.balloon_occupancy()` counts regions per balloon box; the renderer fits a region only when `occupancy[i] == 1`, else it falls through to the legacy per-text-line path. 2 tests.
- Verified: sole occupant still fits (font 120 into a 480×320 balloon); shared/None balloons gated out. Tests: `test_bubble_association.py` 15 green (+5), `test_font_fit.py` 6 green (wiring asserts both gates + union_box), targeted render/thai suite 33 green (1 pre-existing async-plugin fail). PIPELINE.md §5 updated. Verdict moved scrutinize → fix-then-ship done; **safe to E2E now.** Not committed.

## #166 binary-search font sizing — the real fit (2026-06-08, /tdd)

Replaces Step B's `sqrt(area-ratio)` heuristic (which near-no-op'd on dense boxes — the "ทำไมดูไม่ต่าง" feedback) with MangaTranslator's actual technique: binary-search the largest font whose wrapped text fits the balloon, measured by the renderer's own wrapper so the fit prediction matches the render.
- **Pure** `font_fit.py` `fit_font_size(box_wh, measure, low, high)` — standard binary search over a `measure(size)->(block_w,block_h)` callback; fit-test = `block_w<=W ∧ block_h<=H`; floor-on-overflow. No PIL/ML imports. Removed the old `bubble_area_font_size` + its 6 area-ratio tests + the `_apply_bubble_area_fit` patch pre-step (dead once the renderer owns the fit). 5 search tests.
- **Renderer** `rendering/__init__.py`: new `bubble_fit` path in `resize_regions_to_font_size` — for a horizontal region carrying a #170 `bubble_box`, `_bubble_fit_font_size()` fits via `calc_horizontal` and renders **into the balloon box** (dst_points = bubble rect), bypassing the length-ratio heuristic so the fitted size is never re-inflated past the balloon. Threaded `bubble_fit` through `dispatch`; `_run_text_rendering` passes `config.render.bubble_area_fit`. Off / no bubble_box → byte-identical legacy path.
- **Proven** (real freetype wrapper, no GPU): same text in a 120×80 box → font 30; in a 480×320 box → font 120 (4× box ⇒ bigger font), dst = balloon dims. Direction correct, no squish-back.
- Tests: `test_font_fit.py` 6 green (5 search + 1 source-inspection wiring); targeted render/bubble/thai suite 28 green (1 pre-existing async-plugin fail `test_default_renderer`, unrelated). PIPELINE.md §5 provenance updated (config/manga_translator/rendering/font_fit). **Issue #166 NOT closed — awaiting user confirm + full frontend E2E.** Not committed.

## Dev tooling — `scripts/notify.ps1` Windows toast notifier (2026-06-08)

User wants a ping when a long task finishes / needs a decision so they can step away from the terminal. Claude Code's built-in `PushNotification` reports "sent" but produces no OS toast on their Win11 + VS Code setup (verified: not DND, nothing in Action Center). Built a working path instead.
- **Mechanism**: `scripts/notify.ps1 -Message "..."` (run by pwsh 7) shells out to **Windows PowerShell 5.1** and emits a **WinRT Toast** under the Windows PowerShell AppId → lands in Action Center → forwarded to the phone via Phone Link (user's phone is Phone-Link-paired). pwsh 7 can't load WinRT projections, hence the 5.1 hop; `powershell.exe` isn't on PATH in this env so the script uses the full `System32\WindowsPowerShell\v1.0` path; text is XML-escaped; `-File` runs fine under RemoteSigned (no `-ExecutionPolicy Bypass`, which the classifier denies).
- **Confirmed live**: raw WinRT toast displayed on screen; built-in PushNotification + legacy NotifyIcon balloon did not.
- Documented in CLAUDE.md (EN+TH, "Dev Notifications"); standing rule saved to memory `feedback_notify_on_done_or_question`. Not committed.

## Debug tool — `cache:reset` wipes translated-patch caches (2026-06-08, /tdd)

Re-translating during MIT debugging was defeated by every cache layer replaying the prior result; clearing them by hand (Redis pattern + `.cache` glob + `uploads/patches`) was error-prone — one wrong glob nukes `forum:*`/`search:*` (same data-loss class PatchStore's `OWNED_NAME` guards). Extracted the dangerous part into a unit-tested pure module.
- **Pure module** `src/cache/translation-cache-reset.ts`: `isTranslatedPatchCacheKey()` (matches only `translate:manga-patches:` — sibling `translate:glossary:*` survives) + `resetTranslationCache(ports)` orchestrator over injected I/O ports (Redis / L3 disk / patch PNGs), best-effort per layer. 6 tests with in-memory fakes prove forum/search/mangadex/glossary keys are left intact and counts are accurate.
- **CLI glue** `scripts/reset-translation-cache.ts` (`npm run cache:reset`, `-- --dry-run`): wires real ioredis (graceful skip when Redis down, mirrors RedisService fallback) + `fs` for `.cache/*.json` (selects by the entry's `key` field) and `uploads/patches/<chapterId>` trees. In-memory L1 dies with the backend → restart clears it.
- **Verified on real data**: `.cache` held 463 json (219 patch + 244 other); dry-run then real run deleted exactly the 219, leaving 244 (463→244) — zero collateral. Full cache suite 137 green (14 suites). Not committed.

## #166 font-size fidelity — Step A: render knobs (2026-06-08, /tdd, in progress)

Leverage-order step 1 of #166 ("knobs"). The renderer's auto floor is `(img.h+img.w)/200` — in patch mode that's computed from the tiny crop, so text renders uniformly small. MIT's `render.font_size_offset`/`font_size_minimum` existed but the Backend never sent them.

- **Backend** `buildMitConfig`: `MIT_FONT_SIZE_OFFSET` (signed int) + `MIT_FONT_SIZE_MIN` (positive px) → `render.{font_size_offset,font_size_minimum}`; absent → render block byte-identical. `signedIntEnv`/`posIntEnv` helpers. `books-mit-config.spec` 13 green (knob set + absent-unchanged).
- **Frontend E2E** (build + restart with `MIT_FONT_SIZE_MIN=30`, cleared all 3 cache layers, re-translated Kouchuugun p1): text renders visibly larger and fills each caption box far better than the default auto-floor render — confirms mechanism #3 (knobs never tuned + crop-derived tiny floor). Screenshot in `_bubble_proof/`.
- **Next (Step B, the core)**: drive size by *available area* (the `region.bubble_box` carried from #170) instead of the source textline column + the global floor — per-box auto-fit, not a blunt global minimum. Then Step C (patch-crop growth), Step D (display-text ≥2× median, ties to #168).
- Dev env now also carries `MIT_FONT_SIZE_MIN=30`. Not committed/merged.

### Step B — area-driven sizing (`MIT_BUBBLE_AREA_FIT`, /tdd)
The automatic fix vs Step A's blunt global floor: size each region's font to its **balloon area** (#170 `bubble_box`) instead of the source textline column.
- **Pure helper** `manga_translator/font_fit.py` `bubble_area_font_size()` — linear scale = `sqrt(bubble_area / (textline_area × share))`, clamped `[1, max_ratio=1.6]`, only grows, `share` = lines splitting one balloon (so a multi-line bubble doesn't overflow). 6 tests, no ML imports.
- **Wiring**: `_build_local_region` shifts `bubble_box` into crop coords; `_process_group` calls `_apply_bubble_area_fit(local_regions)` when `config.render.bubble_area_fit`; it sets `region.font_size` (plain attr) — renderer (`rendering/__init__.py`) untouched. `RenderConfig.bubble_area_fit` (off=byte-identical); Backend `MIT_BUBBLE_AREA_FIT` knob (`books-mit-config` 15 green).
- **Frontend E2E** (worker + backend restarted on Step B code, `MIT_BUBBLE_SEG=1 MIT_BUBBLE_AREA_FIT=1`, no font-min, cache cleared, Kouchuugun p1 re-translated; worker logged `7 balloons, 24/24 regions tagged`): per-box sizing — spacious boxes (e.g. "แล้ว…อะไรจะเลวร้ายไปกว่านี้ได้") render large/fill, dense boxes stay readable; no overflow, no uniform-tiny. Distinct from Step A's uniform global bump.
- Tests: MIT 16 (font_fit 6 + bubble_association 10) + Backend 27 (mit-config 15 + patch-store 12) green. **Issue #166 NOT closed — awaiting user confirm.** Remaining: Step C (crop growth), Step D (display-text). Dev env now `MIT_BUBBLE_AREA_FIT=1` (font-min removed).

---

## MangaTranslator round-2 deep read — hidden techniques (2026-06-08, research)

Re-swept the full `/MangaTranslator` clone (33K LOC, Apache-2.0) with 5 parallel Explore agents to find techniques the first study missed. New doc: `docs/research/mangatranslator-round2-deep.md` (cross-linked from `mangatranslator-internals.md`). Highest-value new findings:
- **Full binary-search font-sizing constants** (low=8/high=16 dialogue, 10–64 OSB; fit-test = line_width≤W ∧ block_height≤H; collision = 4 corners inside mask; squeeze ×0.90 up to 3×; line-height from real Skia metrics; pole-of-inaccessibility anchor) → makes #166 implementable for real, not a weak heuristic.
- **Mask edge feathering** (`ramp = 1 − d_out/blur_radius`, distance-transform alpha) → kills patch seams; applies to our LaMa patches (#156). New issue candidate.
- **Emphasis contract** (`*italic*`/`**bold**`/`***bi***` + Giongo→onomatopoeia / Gitaigo→verb-no-period) → complete recipe for #171 P2, prompt-only.
- **Solid-bg → flat-fill** (white/black border ratio ≥0.95 skips inpaint) → our white caption boxes qualify. New issue candidate.
- **min-128px upscale before OCR** + numbered-parser `[Missing item N]` repair + SAM neighbour whiteout → #172.
- **Event-based OCR chaining** for parallel batch = exactly our #159.
- Quick wins: temp 0.1 all providers, ellipsis `…→...`, RTL no-reorder, determinism-gate cache + 2px bbox quantize.
- Confirmed model repo ids (speech-bubble = `kitsumed/yolov8m_seg-speech-bubble` which we already adopted for #170; OSB = `deepghs/AnimeText_yolo` for #168).
- Roadmap mapping updated in the round-2 doc. PRD #169 extended via comment (P4/P5 + grounds #166 with the full binary-search spec); **two new issues filed under #169: #173 (patch-seam edge feathering, P4) and #174 (solid-bg flat-fill fast-path, P5)** — bilingual, ready-for-agent.

---

## #160 — translation memory persistence (2026-06-08, /tdd, live-verified)

PRD #155 P3. Translated text becomes durable memory in Supabase; the per-page webhook persists each page's #158 text layer.

- **Migration** (Supabase MCP `apply_migration`, project `mangadock`): `manga_glossaries`, `chapter_page_texts`, `chapter_summaries` per the PRD schema; RLS enabled, **no policies** (server-only — service role bypasses RLS).
- **Repository** `translation-memory.repository.ts` — best-effort (try/catch → boolean, never throws → translation never depends on it): `savePageText` (idempotent upsert on `(chapter,page,lang)`), `upsertGlossary` (a `source='auto'` write is **skipped when the stored row is `edited`** — curation protected; explicit `edited` always wins). 5 unit tests, mocked Supabase.
- **Wiring**: constructed from the already-injected `SupabaseService` (no constructor/module change → zero spec breakage); `handleMitCallback` fire-and-forgets `savePageText` after caching (no added latency).
- **BUG found by the live demo** (why real testing matters): the webhook controller's anti-corruption mapping `const result = { imgWidth, imgHeight, patches }` **dropped `regions`** → first demo left `chapter_page_texts` empty. The existing #158 test accepted the field but never asserted it was *forwarded*. Tightened that assertion (RED), then added `regions` to the destructure + result (GREEN). `mit-webhook-hmac.spec` 9 green.
- **Live demo** (batch-translate Kouchuugun ch.1 via the frontend → webhooks → persist; queried Supabase): rows appear in `chapter_page_texts` — e.g. page 0 = 24 regions, `"COLONIAL PLANET VESTA…"` → `"ดาวเคราะห์อาณานิคมเวสตา…"`, with model/target_lang. Acceptance #4 met.
- Read paths + summary/glossary generation are later slices (#161). Issue open, not committed.

---

## #168 — SFX detector: pure core + seam (2026-06-08, /tdd, AFK-gated)

The deep testable module + env seam of #168, AFK-buildable without the model. The AnimeText-YOLO wrapper + pipeline second-pass + proof on the SFX pages are a **separate slice gated on** (a) model-download approval (deepghs/AnimeText_yolo `.pt`, security gate) and (b) the SFX reference pages p8/p13 (MangaDex 404'd them this session).

- **Pure helper** `manga_translator/sfx_merge.py` `dedup_sfx_boxes()` — drops second-pass SFX boxes already covered (IoA ≥ 0.2 over the candidate area) by a DBNet textline, so dialogue isn't double-detected. 4 tests, no ML imports.
- **Seam**: `DetectorConfig.det_sfx` (off=byte-identical); Backend `MIT_SFX_DETECTOR` knob (`books-mit-config` 16 green).
- Not committed; issue open. Full completion needs the gated model + pages.

---

## #172 filed — OCR rescue ladder (PRD #169 P3) (2026-06-08)

Closed the last gap in residual-original-text coverage. The three causes of original text leaking onto a translated page are now all tracked: stylized SFX never detected → #168; OCR detected-but-dropped → #167 (shipped); **OCR recovered-but-mangled → #172 (new)**. Umbrella goal = PRD #169 User Story 5 ("zero original-language leftovers"). #172 = env-gated 3-step ladder (floor #167 done → geometric pre-split of over-long textlines → vision re-read via the existing gateway, per-page fallback logging); step 3 coordinates with PRD #171 P1 (multimodal OCR) to share the vision-OCR seam. Bilingual, ready-for-agent.

---

## Patch URL cache-bust — versioned `?v=<contentHash>` (2026-06-08, /tdd)

Fix for the stale-patch-cache bug found during #170 frontend E2E (deterministic patch filenames + `max-age=14400` → re-translating with changed geometry served stale PNGs up to 4 h; surfaced as garbled top caption boxes on Kouchuugun p1).

- **Seam**: `PatchStore.put()` (`patch-store.ts`) already had both the PNG bytes and the URL builder — append `?v=` = `sha1(bytes).slice(0,12)`. Content-hash (not mtime) so an identical re-translate keeps the URL (cache stays warm) while changed bytes bust it. Disk filename unchanged; only the returned URL carries the version. `toRelativeProxyUrl` (frontend) already preserves the query string → no frontend change.
- **TDD** `patch-store.spec.ts` (12 green): tracer = url has `?v=[0-9a-f]+`; same content → same version; different content → different version; updated 2 existing exact-url assertions to split off the query.
- **Regression**: full `src/books` suite = 15 fails (the pre-existing pubsub-batch baseline, unchanged) + 118 pass — zero new failures.
- **Live E2E** (rebuilt + restarted Backend, re-translated Kouchuugun p5 fresh): overlay urls now carry distinct hashes (`r0.png?v=41ee539faad3`, `r1.png?v=a3d68b56b02d`, …) — confirmed wired through to the browser `<img>` src.
- **Gotcha confirmed**: the fix only helps translations made *after* deploy — pages cached pre-fix (L3 holds the non-versioned response) keep serving stale patches. Cleared all 3 cache layers (8 PNG + 3 L3 + L1 restart) + reloaded the browser (frontend `patchedPages` short-circuits "แปลหน้านี้" → no backend call), re-translated p1 fresh → all 7 overlays now `?v=`-versioned with correct natH (587/617, not stale 1492/1489); p1 renders cleanly. Lesson folded into `feedback_clear_cache_before_test` (clear L3 + reload after any deploy).
- Not committed/merged (awaiting user).

---

## #170 bubble segmentation IMPLEMENTED — balloon-aware grouping fixes scattered clumps (2026-06-08, /tdd)

P0 enabler of PRD #169. Additive scope (user-chosen): DBNet stays the text detector; a speech-balloon YOLO-seg enriches each region with its balloon. All behind `MIT_BUBBLE_SEG=1` — off = byte-identical.

- **Proof first (measure, don't guess)**: `tools/diag_bubble_seg.py` loaded `kitsumed/yolov8m_seg-speech-bubble` on 5 real Kouchuugun pages → masks correct (7/6/8/10/8 balloons), **VRAM 8,598/12,282 = 70%** co-resident with the running worker (+663 MB), 30 ms/page. Gate passed before any pipeline code.
- **Slice 1-3 `bubble_association.py`** (pure geom, no ML, 10 tests <1s): `associate_regions_to_bubbles()` (containment → smallest-area nested wins → IoA fallback ≥0.5) + `group_regions()` (balloon-aware union-find: different balloons never merge, same balloon always merges; all-None = legacy proximity).
- **Slice 4 env knob**: Backend `buildMitConfig` `MIT_BUBBLE_SEG` → `detector.det_bubble_seg` (`books-mit-config.spec` 11 green); MIT `DetectorConfig.det_bubble_seg` + source-inspection wiring test.
- **Slice 5 ML wrapper + integration**: `bubble_detector.py` lazy YOLO wrapper (best-effort → no balloons on failure); `translate_patches` tags regions when flag on; `_group_nearby_regions` **refactored to delegate** to the pure `group_regions` (extract-for-testability).
- **E2E A/B verify** (worker restarted on new code, same page, flag-only diff): Kouchuugun p1 caption-box page **2→7 patches, aspect 0.30→0.73** — scattered clumps gone. OFF reproduced the exact `451×1489`/`649×1492` baseline → byte-identical.
- **Frontend E2E** (Playwright via `hayateotsu.space` tunnel, Backend rebuilt + restarted with `MIT_BUBBLE_SEG=1` + `MIT_OCR_PROB=0.03`, Kouchuugun cache cleared 93 PNG + 38 L3): translated p1 → backend log `page=0 → 7 patches`, reader rendered all 7 per-balloon overlays (aspect 0.67–0.86); p4 → `page=3 → 3 patches` (wide banner 2.9 / square bubble 1.02 / tall caption 0.7) — each container its natural shape, no clumps. Remaining within-box gaps = #166 sizing, as scoped. Dev env left with the flag on (revert: restart Backend without `MIT_BUBBLE_SEG`).
- **Stale-patch-cache bug found via original↔translated compare (NOT a #170 logic bug)**: user's p1 screenshot showed the top caption boxes squished/garbled. Measured: overlay `r0`/`r1` `naturalHeight` = 1492/1489 (old OFF strips, browser-cached under the same deterministic filename `p0__r0.png`) while the disk files were 587/617 (correct new bubble patches). Proof: re-fetched with `?bust=` → 587/617; busting the live overlay `src` rendered p1 correctly. Root cause = patch overlay `p.url` in `MangaReader.tsx` has **no cache-bust param** + `max-age=14400`, so re-translating with changed geometry serves stale patches up to 4 h. Real fix (separate scope) = version the patch URL (`?v=<mtime/hash>`). Methodology recorded in `frontend-testing` skill (original↔translated compare is mandatory; stale-cache diagnostic; search→modal→read playwright recipe).
- **Scope boundary**: #170 delivers boundary + grouping (carries `region.bubble_box`); font-sizing to *fill* the balloon (remaining within-box gaps) is **#166**, now unblocked.
- New dep `ultralytics` (AGPL-3.0, self-hosted) in `requirements.txt`. Provenance: `PIPELINE.md §5` (manga_translator new 3→5). Lesson re-applied from this series: I twice guessed the scattered-clump cause before; measured patch dims + viewed renders this time.
- **Not committed/merged** (awaiting user). #170 has proof + E2E comments.

---

## LEAK SWEEP — #136 #137 #139 (+#138 falsified) — 2026-06-06

From architecture review report: candidates C1-C7 → issues #136-#143 (bilingual per new convention in `docs/agents/issue-tracker.md`)

- **#136 MIT page-context**: `reset_page_context()` + call at top of `translate_patches` — stops unbounded RAM growth on worker singleton + context leaking across jobs (`context_size=0` default → no behavior change) · `test_page_context.py` (2) · real seam = #140 (HITL)
- **#137 PatchStore**: single module owns `uploads/patches` — deterministic name `{src}__{tgt}__{model}__p{N}__r{N}.png` (re-translate = overwrite) + delete stale regions when page shrinks + `sweepLegacy()` sweeps random-name backlog (boot + daily `.unref`) · 3 call sites use PatchStore (`uploads/patches` removed from books.service) · `patch-store.spec.ts` (5) with fake mirroring real readdir semantics
  - **Mock-drift caught by live verify**: initial fake used prefix-list but `DiskStorageProvider.list` = `readdirSync(dir)` (one-level, basename) → sweep silently missed real disk → fixed both module+fake
- **#139 bundle**: stats `RECORD_VIEW_SCRIPT` single Lua (atomic write+TTL — spec rewrite 4 tests) · ContinueReadingRow timer ref+cleanup · log tee rollover across midnight · img-proxy 15MB cap
- **#138 falsified**: EventSource is inside effect + cleanup complete — Explore agent misread, verify before acting
- **Specs**: storage mock in all books specs adds `list`/`delete` · full suite 50/50 + build 0 + tsc 0
- **HITL pending**: #140 Translation Session · #141 MitClient+BatchJobRegistry · #143 NDJSON/fan-out ADR · #142 useChapterTranslation

---

## PRD #131 → #132+#133+#134 IMPLEMENTED — translator-aware model selector (2026-06-05 late)

From #130 finding (Qwen deployment shows Gemini selector that does nothing + wastes GPU across cache partitions) — full chain: /to-prd → /to-issues (3 vertical slices) → /tdd → live verify on branch `feat/translator-aware-model-selector`

- **#132 MIT**: `/ready` → `{ready, workers, translator}` · discovery: `GET /books/models` referenced in #87 **never existed** — Frontend used hardcoded fallback throughout · live: `curl /ready` → `"translator":"qwen3"` ✓
- **#133 Backend**: `getImageTranslator()` (60s cache, null when down/503/no-field) + `getMangaModelsInfo()` + route `GET /books/models` for first time · TDD `books-models.spec.ts` (6, RED→GREEN) · live: `{"models":[real catalog],"imageTranslator":"qwen3"}` ✓
- **#134 Frontend**: `fetchImageTranslator`/`isGeminiImageTranslator` (null = fail-open) + deep module **`getEffectiveImageModel()`** as single gate for all translate calls (blocks stale localStorage sending model on non-Gemini) · desktop+mobile menus gated by `showModelSelector` · live browser: menu opens but **"AI Model" hidden** on Qwen machine ✓ · tsc EXIT 0
- Docs: `CONTRACT.md` adds §Readiness

---

## LIVE E2E SESSION (2026-06-05 evening) — restart MIT + browser/API verified before merge

- ✅ Webhook path E2E with new code: run1 translated 4/4 complete
- **Bug found+fixed by e2e**: `handleMitCallback` still writing cache **v3** while pre-check reads v4 → webhook results never served from cache → fix via `patchCacheKey` + model segment from jobKey (commit `103177a`, TDD RED→GREEN, 22 tests green) → **run4/run5 = 0s instant** ✓
- ✅ **#127 live-proven**: repeated call after all-cached returns all 4 pages every time
- ✅ **Cancel chain (#101/#123) live-proven**: curl abort 6s → Backend cancels MIT job → MIT drops page 0 result
- ✅ **#128 live-proven**: planted stale cancel flag → new translation succeeded 2/2
- ✅ **#87 UI seen in screenshot**: model menu shows from real `/books/models`
- **New finding → #130**: machine uses `TRANSLATOR_TYPE=local` + `DEFAULT_LOCAL_TRANSLATOR=qwen3` → translates with Qwen3, not Gemini → model override correctly ignored per PRD scope, but UI selector silently misleads user

---

## #95 S2 + #87 UI + #129 RESOLVED (2026-06-05 second round)

- **#95 S2**: enforce secret only in production (option c); `NODE_ENV=production` + no-secret → 401 · `mit-webhook-hmac.spec.ts` **green for first time (7)** → baseline down to 14 (pubsub only)
- **#87 Reader model selector UI**: "AI Model" section in both desktop translate dropdown and mobile more-menu (chip pattern same as LANGS) — list from `fetchAvailableMangaModels()` + "Auto" button (= delete key → operator env wins)
- **#129 Decision option (a)**: accept + document · ADR in `MIT/ARCHITECTURE.md` §6 — cancel = page-boundary by design · UX: toast in `cancelTranslate`

---

## #87 IMPLEMENTED — per-request Gemini model (2026-06-05, TDD)

- **Slice A Backend**: `imageModelKey()` + `patchCacheKey()` — cache **v3→v4** with model segment; `buildMitConfig(..., imageModel?)` → `translator.model`; `buildJobKey` includes model (prevents cross-model collision)
- **Slice B MIT**: `TranslatorConfig.model: Optional[str]` · `_model()` = override or `GEMINI_MODEL` · `useCache` returns False when override ≠ default
- **Slice C Frontend**: `getSelectedMangaImageTranslateModel()` — new key `mangaImageTranslateModel`; UI pending

---

## #95 S1 IMPLEMENTED — webhook HMAC over raw request bytes (2026-06-05, TDD)

- **Root cause**: Backend verified HMAC on `JSON.stringify(parsed body)` but MIT signs raw bytes (`json.dumps(separators=(',',':'), ensure_ascii=False)`) → byte-unstable (e.g. float `1280.0` → JS stringify becomes `1280`) → mismatch when `MIT_WEBHOOK_SECRET` set
- **Fix**: `main.ts` json() `verify` hook saves `req.rawBody` · controller verifies on `req.rawBody`

---

## #127 + #128 IMPLEMENTED — cancel→re-translate poisoning (2026-06-05, TDD)

- **#127 Backend: all-cached batch job leak** — `startOrAttachBatchJob` early-return when `uncachedPages.length === 0` without removing placeholder from registry → next request of same jobKey attaches to resolved job → returns immediately, doesn't serve cache, doesn't call MIT. Fix: remove jobKey from registry before early-return
- **#128 MIT: stale cancel flag poisoning new batch of same taskId** — deterministic taskId + `/cancel` arriving after `discard()` in finally → taskId stays in `_cancelled` permanently → next run `is_cancelled` from first page → silent break, no webhook. Fix: `discard(taskId)` at run start — new submission supersedes stale cancel

---

## Cancel-propagation + Thai wrap + VRAM pass (2026-06-05)

- **Cancel**: Frontend proxy not forwarding `req.signal` → browser abort didn't reach NestJS → `res.on('close')` didn't fire → MIT never cancelled. Fix: `signal: req.signal`
- **Thai word wrap**: pythainlp not in requirements → `_HAS_PYTHAINLP=False` → ZWSP no-op → whole sentence treated as "1 word" → `calc_horizontal` fallback splits char by char. Fix: add `pythainlp` + `_safe_char_split` cluster-safe fallback. Test: `test/test_thai_wrap.py` (8)
- **VRAM**: merge mitConfig to single `buildMitConfig()` · reduce defaults: detection 2560→2048, inpainting 2048→1536 · expose `MIT_DETECTION_SIZE/INPAINTING_SIZE/INPAINTER/INPAINTING_PRECISION`

---

## Batch Translation End-to-End Fix Session (2026-06-04)

5 bugs found and fixed in sequence:

| # | Root Cause | Fix |
|---|---|---|
| 1 | MIT Webhook sent to Backend Public Origin (Cloudflare) — MIT on localhost can't reach it | Add `MIT_CALLBACK_ORIGIN` env + `mitCallbackOrigin` getter |
| 2 | Webhook controller rejected all requests when `MIT_WEBHOOK_SECRET` not set | Make HMAC optional — no secret → accept unauthenticated |
| 3 | `signal` passed to MIT POST → user cancel → kills TCP mid-flight → MIT BLAS crash (`forrtl error 200`) | Remove `signal` from MIT POST + pre-check `signal.aborted` before submit |
| 4a | MIT webhook body (base64 PNG ~1-3MB) exceeds body-parser default 100KB → `PayloadTooLargeError` | Set `json({ limit: '50mb' })` + `bodyParser: false` |
| 4b | Contract mismatch: MIT sends flat payload but controller expected `body.result` → crash | Controller reads flat fields, assembles `result` object itself |
| 5 | SSE endpoint no heartbeat → ~62s wait with no bytes → Cloudflare 524 | Add initial `: connected` byte + periodic `: ping` every 15s |

---

## MIT Scrutiny → Issues #100–#111 (2026-06-04 → 2026-06-05)

Full end-to-end scan of MIT server and logic layer. All 12 issues fixed with TDD.

| Issue | Severity | Fix Summary |
|---|---|---|
| #100 | Critical | `send_webhook` retry + dead-letter — extracted to `server/webhook.py`, 10 tests |
| #101 | Critical | Batch cancellation propagation — `cancellation.py` module, `POST /cancel/{taskId}`, 6 tests |
| #102 | Security | Path traversal in result file endpoints — `server/path_utils.py`, 7 tests |
| #103 | Security | Worker bind 0.0.0.0 RCE risk — hardcode `--host 127.0.0.1`, 6 tests |
| #104 | Major | Dead batch endpoints — removed `/translate/batch/json`, `/translate/batch/images` and related code |
| #105 | Cleanup | Dead code removal — 152 lines net deleted |
| #106 | Major | Async-correctness — streaming timeout, blocking HTTP → httpx, lock-across-await fix, 7 tests |
| #107 | Bug | GeminiTranslator error handling — `server_error_attempt=0`, bare raise fix, lstrip→removeprefix, IndexError guard |
| #108 | Major | GPT sample selection — replaced langcodes fuzzy-match with direct dict lookup, 4 tests |
| #109 | Major | Target-language check — replaced langid with target-script char ratio, 6 tests |
| #110 | Major | Rendering direction mismatch + None homography guard, 4 tests |
| #111 | Major | Region utils — textline_merge prob denominator fix, TextBlock null guard, mutable default, 5 tests |

**MIT unit suite final (2026-06-05): 49 tests passing** (up from 25 at session start)

---

## MIT Documentation (2026-06-05)
- `MIT/ARCHITECTURE.md` — 12-section blueprint (2-process model, directory map, patch path, translator subsystem, webhook, known issues #100-#111)
- `MIT/SETUP.md` — install/run/test runbook + real troubleshooting (forrtl 200, model load 150s, CUDA OOM, port conflicts)
- `MIT/CONTRACT.md` — wire format MIT↔Backend; casing footgun (single=snake_case vs batch/webhook=camelCase) + HMAC raw-bytes hazard + size limits

---

## PRD #92 — Qwen3 Offline Translator (2026-06-04)

Design for users with GPU (RTX 4070 Super 12GB) who want offline manga translation without Gemini API dependency.

Solution: New `Qwen3Translator` class with thinking mode disabled + `MIT_TRANSLATOR` env var in Backend to select translator type. Qwen3-4B BF16 = ~8GB VRAM, fits in 12GB.

---

## Phase 1.5 Completion Verification (2026-05-27)

All 4 pillars verified: Community Forum (PR #9 merged), HWID middleware enforcement, Creator Earnings API+UI, Zero-Trust Gate.

---

## Phase 2 — 2-Layer Cache Upgrade (Branch: feat/2-layer-cache-upgrade, Commit: ad72574)

- **ElectionService** — Redis NX Lock, Lua CAS renewal, 15s interval, TTL=37.5s
- **MetricsService** — CPU/mem/latency heartbeat every 10s
- **BatchSyncWorker** — Reliable Queue: `RPOPLPUSH` + `LREM` ack + crash recovery + leader-only guard
- **CacheOrchestratorService** — write-behind `set()`: L1 + L2 + `markDirty()`
- **Test Count:** 134 passing (up from 117)

---

## Phase 2b — Issues #13–#15: L3 Batch Layer (2026-05-28)

- **#13 L3DiskService** — extracted disk I/O from JsonCacheService; fixed bug: `set()` was calling `writeToDisk()` on every update — massive disk I/O overflow
- **#14 L3BatchWriter** — periodic L2→L3 batch on all nodes: wallet 2s, stats 5s, default 60s
- **#15 Leader flush wire** — `BatchSyncWorker.syncKey()` now calls `l3.write()` before future Supabase RPC
- **Test Count:** 155 passing

---

## Phase 2c — Issues #18–#21: Dirty Queue Bug Fixes (2026-05-28)

- **#18** Processing queue leak — missing `DEL` before re-queue in `recoverOrphans()`
- **#19** Expired key orphan — `lrem` ack on early return prevents permanent orphan
- **#20** Shutdown durability — `onApplicationShutdown()` now calls `l3BatchWriter.flush()` instead of useless L1↔L2 timestamp sync
- **#21** Non-atomic crash recovery — replaced DEL→RPUSH sequence with single `RECOVER_SCRIPT` Lua EVAL
- **Test Count:** 161 passing

---

## Phase 2.4–2.5 — Cache Hardening (2026-05-29)

- **CatastrophicRecoveryService** — boot with Redis down → read L3 → compare timestamp with Supabase → buffer winners → fire-once reconnect callback; smart dirty queuing skips Supabase winners
- **BatchSyncWorker Retry Budget** — `MAX_RETRIES=5`, `HINCRBY cache:retry_counts`, `SADD cache:dead_letter` on exhaustion
- **CacheHealthService** — `GET /status/cache` → `{ dirtyQueueDepth, processingQueueDepth, deadLetterCount, l3KeyCount, isLeader }`
- **Timer hygiene** — `.unref()` on all `setInterval` timers to prevent Jest process leak
- **Test Count:** 277 passing

---

## Translation System Overhaul (2026-06-04)

6 bugs fixed (#73–#78): `.finally()` job deletion race, raw pixel coords as percentages, HMAC mismatch, idempotency race, latecomer listener ordering, TOCTOU in job registration.

Dead code removed (#81): `translateMangaPage()` full-image path, its controller endpoint, and frontend export.

**Architecture Decision: Option A'** — Replace `activeBatchJobs` Map with Redis pub/sub; `handleMitCallback` = `cache.set` + `redis.publish`; eliminates all 6 bug classes.

**Test Count:** 299 passing

---

## V5 Final Hardening (Commit 69712f9)

- Error handling: all `throw new Error()` → `InternalServerErrorException` in UnlockService
- Runtime validation: `ValidationPipe` (class-validator) enabled globally in `main.ts`
- Test integrity: `forum.controller.spec.ts` mocks updated to match real contract `{ items, total }`
<!-- lang:end -->

<!-- lang:th -->
# DONE — Claude Code Review Fix Session (2026-05-27)

---

## ✅ LEAK SWEEP — #136 #137 #139 (+#138 falsified) — 2026-06-06, /improve-codebase-architecture → /to-issues → /tdd

จากรายงาน architecture review (HTML ใน temp): candidates C1-C7 → issues #136-#143 (สองภาษาตาม convention ใหม่ใน `docs/agents/issue-tracker.md`)

- **#136 MIT page-context**: `reset_page_context()` + เรียกต้น `translate_patches` — หยุด RAM โตไม่จำกัดบน worker singleton + บริบทรั่วข้าม job (`context_size=0` default → ไม่มี behavior change) · `test_page_context.py` (2) · seam จริง = #140 (HITL)
- **#137 PatchStore**: module เดียวเป็นเจ้าของ `uploads/patches` — ชื่อ deterministic `{src}__{tgt}__{model}__p{N}__r{N}.png` (แปลซ้ำ=เขียนทับ) + ลบ stale regions เมื่อหน้าหดตัว + `sweepLegacy()` กวาด backlog ชื่อ random (boot+รายวัน `.unref`) · 3 call sites ใช้ PatchStore หมด (`uploads/patches` หายจาก books.service) · `patch-store.spec.ts` (5) ด้วย fake ที่เลียน **readdir semantics จริง**
  - 🎯 **mock-drift จับได้จาก live verify**: fake แรกใช้ prefix-list แต่ `DiskStorageProvider.list` จริง = `readdirSync(dir)` (ระดับเดียว, basename) → sweep เงียบบนดิสก์จริง → แก้ทั้ง module+fake — บทเรียน: fake ต้อง mirror adapter จริง
  - design note: sweep เป็น legacy-format cleanup (ไม่ใช่ age-based ตาม issue เดิม) เพราะ StorageProvider ไม่มี mtime — ของใหม่ bounded ด้วย overwrite จึงพอ
- **#139 bundle**: stats `RECORD_VIEW_SCRIPT` Lua เดียว (atomic write+TTL — spec rewrite 4 tests) · ContinueReadingRow timer ref+cleanup (mountedRef ที่ agent อ้างไม่มีจริง) · log tee rollover ข้ามวัน (เจอกับตัวคืน e2e) · img-proxy cap 15MB
- **#138 falsified ✓ ปิด not-planned**: EventSource อยู่ใน effect + cleanup ครบอยู่แล้ว — Explore agent อ่านพลาด, ผม file ก่อน verify (บทเรียนซ้ำ: verify ทุก finding ของ agent ก่อนใช้)
- **Specs**: storage mock ทุก books spec เติม `list`/`delete` · ทั้งชุด 50/50 + build 0 + tsc 0
- **HITL ค้าง**: #140 Translation Session · #141 MitClient+BatchJobRegistry · #143 NDJSON/fan-out ADR · #142 useChapterTranslation (AFK คิวหลัง)

---

## ✅ PRD #131 → #132+#133+#134 IMPLEMENTED — translator-aware model selector (2026-06-05 ดึก, TDD + live verified)

จาก #130 finding (Qwen deployment เห็น Gemini selector ที่กดแล้วไม่มีผล + เปลือง GPU ข้าม cache partition) — chain เต็ม: /to-prd → /to-issues (3 vertical slices) → /tdd → live verify บน branch `feat/translator-aware-model-selector`

- **#132 MIT**: `/ready` → `{ready, workers, translator}` (ใช้ `TranslatorConfig()` ที่เพิ่งเป็น default_factory) · **discovery**: `GET /books/models` ที่ #87 อ้างว่ามี **ไม่เคยมีจริง** — Frontend ใช้ fallback hardcode มาตลอด · live: `curl /ready` → `"translator":"qwen3"` ✓
- **#133 Backend**: `getImageTranslator()` (cache 60s, null เมื่อ down/503/no-field) + `getMangaModelsInfo()` + route `GET /books/models` ครั้งแรก · TDD `books-models.spec.ts` (6, RED→GREEN) · live: `{"models":[catalog จริง],"imageTranslator":"qwen3"}` ✓
- **#134 Frontend**: `fetchImageTranslator`/`isGeminiImageTranslator` (null = fail-open) + deep module **`getEffectiveImageModel()`** เป็น gating จุดเดียวของทุก translate call (กัน stale localStorage ส่ง model บน non-Gemini) · เมนูทั้ง desktop+mobile gate ด้วย `showModelSelector` · live browser: เมนูเปิด แต่ **"โมเดล AI" หายไป** บนเครื่อง Qwen ✓ · tsc EXIT 0
- Docs: `CONTRACT.md` เพิ่ม §Readiness

**ตั้งใจไม่ทำ:** MIT-side rejection ของ model field (per #87 — เมินเงียบถูกแล้ว) · migrate cache partitions เก่า (TTL 7 วัน)

---

## 🧪 LIVE E2E SESSION (2026-06-05 ค่ำ) — restart MIT + ทดสอบจริงผ่าน browser/API ก่อน merge

**Setup:** restart MIT ด้วยโค้ดใหม่ (web+worker) · Playwright MCP browser (มีข้อจำกัด: HMR ws พังผ่าน docker → หน้า reload เป็นพัก ๆ + Turnstile widget โหลดไม่ได้ → ต้อง seed `cf_clearance_token` เอง) · ส่วน Backend↔MIT ทดสอบผ่าน HTTP/SSE ตรง (แม่นกว่า)

**ผล (ตอน 5.5 = 4 หน้า, ตอน 16.5 = 2 หน้า ของ Otome Game):**
- ✅ Webhook path E2E โค้ดใหม่: run1 แปลครบ 4/4
- 🐛 **เจอ+แก้บั๊กที่ e2e จับได้**: `handleMitCallback` ยังเขียน cache **v3** ขณะ pre-check อ่าน v4 → webhook results ไม่เคยถูก serve จาก cache (run2 แปลซ้ำ 34s) → fix ผ่าน `patchCacheKey` + model segment จาก jobKey (commit `103177a`, TDD RED→GREEN, 22 tests เขียว) → **run4/run5 = 0s instant** ✓
- ✅ **#127 พิสูจน์ live**: เรียกซ้ำหลัง all-cached ได้ครบ 4 หน้าทุกครั้ง + log `all 4 pages were cached — skipping MIT` + `completed & removed from registry`
- ✅ **Cancel chain (#101/#123) พิสูจน์ live**: curl abort 6s → Backend `last caller gone — cancelling MIT job` → MIT `POST /cancel/... 200` + `cancelled - dropping page 0 result`
- ✅ **#128 พิสูจน์ live**: ปลูก stale cancel flag (POST /cancel ตอนไม่มี job = cancel-after-finish) → แปลใหม่สำเร็จ 2/2 (ก่อน fix จะเงียบทั้ง batch)
- ✅ **#87 UI เห็นด้วยตา** (screenshot): เมนูแปลแสดง "โมเดล AI": อัตโนมัติ/2.5-flash/2.5-flash-lite จาก `/books/models` จริง
- ✅ jobKey มี model segment จริง: `...:gemini-2.5-flash-lite started/completed` + cache partition แยก (แปลใหม่เมื่อเปลี่ยน model)
- 🔍 **Finding ใหม่ → #130**: เครื่องนี้ `TRANSLATOR_TYPE=local` + `DEFAULT_LOCAL_TRANSLATOR=qwen3` → MIT แปลด้วย **Qwen3** ไม่ใช่ Gemini → model override ถูกเมินอย่างถูกต้องตาม PRD scope แต่ UI selector หลอกผู้ใช้เงียบ ๆ — falsification test (โมเดลปลอม `gemini-9.9-nonexistent` ผ่าน batch = สำเร็จ?! แต่ REPL ตรง GeminiTranslator = 404 ✓) คือวิธีที่จับได้
- ⚠️ ยังไม่ verified ด้วยตา: toast ตอน cancel (#129) — reader โดน dev-reload เตะก่อนทุกครั้ง (artifact ของ MCP browser ผ่าน docker เท่านั้น ไม่ใช่บั๊กแอป) · model override บน **Gemini แท้** ใน worker path — เครื่องนี้เป็น Qwen จึงทดสอบไม่ได้โดยไม่สลับ env ผู้ใช้

---

## ✅ #95 S2 + #87 UI + #129 RESOLVED (2026-06-05 รอบสอง, user มอบหมายให้ตัดสินใจ)

**#95 S2 — enforce secret เฉพาะ production (TDD):**
- ตัดสินใจ option (c): no-secret + `NODE_ENV=production` → 401 (fail loudly) · dev/test → accept unauthenticated (คงการตัดสินใจ 2026-06-04 เรื่อง local dev)
- 2 tests baseline เดิมถูกเขียนใหม่เป็น production context + เพิ่ม dev-accept test → `mit-webhook-hmac.spec.ts` **เขียวทั้ง suite (7) เป็นครั้งแรก** → baseline เหลือ 14 (pubsub เท่านั้น) — อัปเดต memory ทั้ง repo+local แล้ว
- **#95 ครบทั้ง S1+S2+S3 → ปิดได้**

**#87 — Reader model selector UI (เสร็จ ปิดได้):**
- section "โมเดล AI" ในทั้ง desktop translate dropdown และ mobile more-menu (chip pattern เดียวกับ LANGS) — list จาก `fetchAvailableMangaModels()` (fetch lazy ตอนเมนูเปิดครั้งแรก) + ปุ่ม "อัตโนมัติ" (= ลบ key → operator env default ชนะ)
- เขียน `MANGA_IMAGE_TRANSLATE_MODEL_KEY` ลง localStorage · tsc EXIT 0 · eslint pre-existing เดิมเท่านั้น
- ค้างเฉพาะ manual e2e (ต้อง restart MIT)

**#129 — ตัดสินใจ option (a): accept + document (ปิดได้):**
- ADR ใน `MIT/ARCHITECTURE.md` §6 — cancel = page-boundary by design; เหตุผล: interrupt กลาง inference เสี่ยง forrtl 200, checkpoint ต้อง plumb taskId ข้าม process, worker ที่สอง = VRAM ×2; latency ยอมรับได้ ≤1 หน้า (~60-100s); revisit เมื่อมี multi-GPU/worker pool
- `CONTRACT.md` §3a — เตือน caller ว่า window นี้ไม่ใช่ "MIT down"
- UX: toast ใน `cancelTranslate` ("หน้าที่กำลังประมวลผลอยู่จะหยุดเมื่อจบหน้านั้น") — `useToast` (no-op ถ้าไม่มี provider)

---

## 🔄 #87 IMPLEMENTED (backend+MIT+lib; Reader UI ค้าง) — per-request Gemini model (2026-06-05, TDD)

**Slice A — Backend (เขียวครบ):**
- `imageModelKey()` (sanitize `[\w.-]`, strip `models/`) + `patchCacheKey()` — cache **v3→v4** มี model segment (`:model|default`); v3 เดิมหมดอายุเอง (TTL 7 วัน)
- `buildMitConfig(..., imageModel?)` → `translator.model` เมื่อ valid · `buildJobKey` รวม model (กัน cross-model collision — เกิน PRD แต่จำเป็น: jobKey เดิมจะชนกันเมื่อ 2 คนเลือกคนละ model)
- plumbing ครบสาย: controller (ทั้ง 2 endpoints + removeBatchListener) → startOrAttachBatchJob → _runMitBatch → NDJSON cache write → fallback → _retryMissingPagesIndividually
- Test: `books-image-model.spec.ts` (4, RED→GREEN) · `books-retry.spec.ts` อัปเดตตาม signature ใหม่ (spec ผูก private method) · nest build EXIT 0 · books suite = baseline เดิม

**Slice B — MIT (เขียวครบ):**
- `TranslatorConfig.model: Optional[str]` (config.py) — contract test `test_image_model_config.py` (2, RED→GREEN)
- `gemini.py`: `_model_override` set ใน `parse_args` ทุก dispatch · `_model()` = override หรือ `GEMINI_MODEL` · แทนที่เฉพาะ request path (count_tokens, generate_content ×2 รวม JSON helper) · **`useCache` คืน False เมื่อ override ≠ default** (cached_content ผูกกับ model ที่สร้าง — bypass ปลอดภัยสุด, ช้าลงเฉพาะ request ที่ override) · `caches.create`/`_CONFIG_KEY`/validation ตอน init คงใช้ env default โดยตั้งใจ
- ไม่เขียน gemini unit test (ต้อง network — precedent #107); MIT unit suite 69 passed

**Slice C — Frontend (plumbing เสร็จ; UI ค้าง):**
- `getSelectedMangaImageTranslateModel()` — key ใหม่ `mangaImageTranslateModel` → fallback key text เดิม (selector เดียวขับทั้งสอง ตาม PRD option แรก) → ไม่เลือก = `undefined` (operator env default ชนะ — user story 9)
- `mangaTranslatePage.ts` ทั้ง 2 fn + `MangaReader` ทั้ง 3 จุดเรียก ส่ง `imageModel` · tsc EXIT 0 · eslint = pre-existing errors เดิมเท่านั้น

**ค้างก่อนปิด #87:** (1) selector UI ใน Reader ที่ user ทั่วไปเห็น — ตอนนี้ขับผ่าน `DevMangaTranslateModelToggle` ที่ gate ด้วย `NEXT_PUBLIC_MANGA_TRANSLATE_DEV_TOOLS` เท่านั้น (2) manual end-to-end กับ MIT จริง (ต้อง restart MIT)

---

## ✅ #95 S1 IMPLEMENTED — webhook HMAC over raw request bytes (2026-06-05, TDD)

- **Root cause:** Backend verify HMAC บน `JSON.stringify(parsed body)` แต่ MIT sign raw bytes (`json.dumps(separators=(',',':'), ensure_ascii=False)`) → byte ไม่ stable (เช่น float `1280.0` → JS stringify เป็น `1280`) → ถ้าเปิด `MIT_WEBHOOK_SECRET` จะ mismatch
- **Fix:** `main.ts` json() `verify` hook เก็บ `req.rawBody` · controller verify บน `req.rawBody` (fallback stringify เฉพาะ direct invocation ที่ไม่มี Express req)
- **Test:** เพิ่ม raw-bytes test ใน `mit-webhook-hmac.spec.ts` (RED→GREEN ด้วย payload `1280.0`) · `nest build` EXIT 0
- **สถานะ #95:** S1 ✅ ตอนนี้ · S3 (5MB bound) มีผลอยู่แล้ว · **S2 (enforce secret) ถูก revert โดยตั้งใจ** ใน session 2026-06-04 (HMAC optional เพื่อ local dev) — 2 tests ที่ encode S2 strict behavior ยัง fail อยู่ใน baseline (จงใจไม่แตะ รอตัดสินใจ: enforce เฉพาะ production หรือ update tests ตาม behavior ปัจจุบัน)
- **Docs:** `MIT/CONTRACT.md` §5 — ย้าย S1 จาก open hazards → resolved

---

## ✅ #127 + #128 IMPLEMENTED — cancel→re-translate poisoning (2026-06-05, TDD)

อาการที่ผู้ใช้แจ้ง: cancel แล้วกดแปลใหม่ → "แปลทั้งตอน" ไม่ดึง cache + MIT ไม่ทำงาน · "แปลเฉพาะหน้า (ยังไม่แปล)" MIT ไม่ทำงาน · MIT รับ cancel ช้า → trace แล้วแตกเป็น 3 issues (#127 AFK, #128 AFK, #129 HITL-รอตัดสินใจ)

**#127 — Backend: all-cached batch job leak ใน `activeBatchJobs`**
- Root cause: `startOrAttachBatchJob` early-return ตอน `uncachedPages.length === 0` โดยไม่ลบ placeholder ออกจาก registry (cleanup อยู่ใน `finally` ที่ไม่ถูกแตะ) → request ถัดไปของ jobKey เดิม attach กับ resolved job → replay `completedPages` ว่าง → คืนทันที ไม่ serve cache ไม่เรียก MIT
- Fix: ลบ jobKey ออกจาก registry (guarded identity check) ก่อน early-return — mirror ของ finally-cleanup
- Test: `books-batch-registry.spec.ts` (2) — RED→GREEN; books suite baseline เดิม (16 pre-existing: pubsub 14 + hmac 2 — ตรง memory); `nest build` EXIT 0

**#128 — MIT: stale cancel flag วางยา batch ใหม่ของ taskId เดิม**
- Root cause: taskId deterministic (`chapterId:src:tgt`) + `/cancel` ที่มาถึง**หลัง** `run_batch_with_callbacks` `discard()` ใน finally ไปแล้ว → taskId ค้างใน `_cancelled` ถาวร → run ถัดไป `is_cancelled` ตั้งแต่หน้าแรก → break เงียบ ไม่ส่ง webhook เลย
- Fix: `discard(taskId)` ตอนเริ่ม run — submission ใหม่ supersede stale cancel; cancel ระหว่าง run ยังทำงานเหมือนเดิม (#101 ไม่ถดถอย — มี regression tests)
- Refactor เพื่อ testability (precedent #100 webhook.py): extract loop → **`server/batch_runner.py`** (deps เบา; heavy imports อยู่หลัง seam `_translate_page`) — `main.py` import จาก module ใหม่ + trim orphan imports (`send_webhook`, `is_cancelled`, `discard`)
- Test: `test/test_batch_runner.py` (4: stale-flag-no-poison, cancel-mid-page-drop, cancel-between-pages-stop, discard-on-exit) — import <1s ไม่ลาก ML stack · MIT unit suite รวม **67 passed**
- Docs sync: `ARCHITECTURE.md` §6 + `CONTRACT.md` §3a — ระบุ semantic "new submission clears stale cancel flag"

**ตั้งใจไม่แตะ:** #129 (page-granular cancel latency + single-worker starvation) เป็น HITL — รอเลือกแนวทาง (a) accept+doc / (b) checkpoint ใน pipeline / (c) worker ที่ 2 · pre-existing fails: Backend pubsub/hmac 16 ตัว, MIT upstream `test_translation*`/`test_textline_merge` (async-def, ไม่มี pytest-asyncio) — ยืนยันด้วย stash-run แล้วว่าไม่เกี่ยวกับ change นี้

**Review notes:** attach path ยังไม่ pre-check cache ให้ latecomer (ได้เฉพาะ `completedPages` replay) — พฤติกรรมเดิม ไม่ใช่ scope #127 · ยังไม่ commit (รอ user สั่ง)

---

## 🐛 Cancel-propagation + Thai wrap + VRAM pass (2026-06-05, /debug-mantra /scrutinize)

อาการที่ผู้ใช้แจ้ง: (1) กดยกเลิกแปล "ทั้งตอน" แล้ว MIT ยังแปลต่อ, (2) ตัวอักษรไทยขึ้นบรรทัดกลางคำ, (3) ขอลด VRAM/เพิ่ม perf

**#cancel — แปลต่อทั้งตอนหลังกดยกเลิก** (commit `e8a246f`)
- Root cause หลัก: `Frontend/app/api/proxy/[...path]/route.ts` ไม่ forward `req.signal` เข้า upstream fetch → browser abort ไม่ถึง NestJS → `res.on('close')` ไม่ fire → ไม่ยิง `/cancel` ไป MIT. Fix: `signal: req.signal`
- Root cause รอง: `removeBatchListener` สร้าง jobKey เองโดยไม่ผ่าน `shouldSendMitSourceLang()` → ตอน `MIT_SEND_SOURCE_LANG=false` (ค่าใน .env.example!) key ไม่ตรงกับ start path → cancel branch ไม่ทำงาน. Fix: extract `mitLangPair()`/`buildJobKey()` single source
- Test: `books-batch-cancel.spec.ts` (2) — cancel fire ทั้ง default และ `=false`

**#thai — ขึ้นบรรทัดกลางคำ** (commit `be2b01d`)
- Root cause: pythainlp ไม่อยู่ใน requirements → `_HAS_PYTHAINLP=False` → ZWSP no-op → ทั้งประโยคเป็น "1 คำ" → `calc_horizontal` fallback `list(word)` แตกทีละ code point ("จะ"→"จ"+"ะ")
- Fix: เพิ่ม `pythainlp` (newmm, no torch) + `_safe_char_split` cluster-safe fallback (มาร์ค U+0E31/0E34-3A/0E47-4E ติดพยัญชนะฐานเสมอ) wired 2 จุดใน calc_horizontal
- Reproduced จริงก่อนแก้ (debug-mantra step 1). Test: `test/test_thai_wrap.py` (8)

**#vram — env-configurable knobs** (commit `bd70698`)
- รวม mitConfig (เดิม duplicate 2 ที่) เป็น `buildMitConfig()` single source
- ลด default: detection 2560→2048, inpainting 2048→1536 (activation ∝ size²) + expose `MIT_DETECTION_SIZE/INPAINTING_SIZE/INPAINTER/INPAINTING_PRECISION`
- ชี้ชัด: int4/int8/fp8 ใช้ได้เฉพาะ LLM translator (Qwen3, `QWEN3_PRECISION` มีอยู่แล้ว) ไม่ใช่ CNN detector/OCR/LaMa. แนะนำ int4 สำหรับ 4B translator บนการ์ด ≤12GB. default translator = Gemini API = 0 local VRAM
- Test: `books-mit-config.spec.ts` (4). Backend baseline ไม่เพิ่ม regression (pre-existing 14 pubsub + 2 hmac เท่าเดิม)

---

## 🐛 Batch Translation End-to-End Fix Session (2026-06-04)

อาการ: แปลทีละหน้าได้ปกติ แต่ "แปลทุกหน้า" (Batch Translation) frontend ไม่แสดง patch — สุดท้าย frontend ได้ HTTP **524** (Cloudflare timeout)

พบและแก้ bug 4 ตัวตามลำดับ (debug จาก log ไฟล์ backend/MIT):

| # | Root Cause | Fix | Files |
|---|---|---|---|
| 1 | MIT Webhook ส่งไป Backend Public Origin (Cloudflare) ที่ MIT บน localhost reach ไม่ได้ | เพิ่ม `MIT_CALLBACK_ORIGIN` env + `mitCallbackOrigin` getter (`http://localhost:4001`) | `books.service.ts`, `.env`, `.env.example` |
| 2 | Webhook controller reject ทุก request เมื่อ `MIT_WEBHOOK_SECRET` ไม่ได้ตั้ง | ทำ HMAC เป็น optional — ไม่มี secret → accept unauthenticated | `mit-webhook.controller.ts` |
| 3 | ส่ง `signal` เข้า `fetch(mitUrl)` → user cancel → kill TCP กลางคัน → MIT BLAS crash (`forrtl error 200`) | ถอด `signal` ออกจาก MIT POST + เพิ่ม pre-check `signal.aborted` ก่อน submit | `books.service.ts` |
| 4a | MIT webhook body (base64 PNG ~1-3MB) เกิน body-parser default 100KB → `PayloadTooLargeError` | ตั้ง `json({ limit: '50mb' })` + `bodyParser: false` ตอน create app | `main.ts` |
| 4b | **Contract mismatch**: MIT ส่ง flat payload `{taskId,pageIndex,imgWidth,imgHeight,patches,error}` แต่ controller คาด `body.result` → `result.imgWidth` crash (undefined) | controller อ่าน flat fields แล้วประกอบ `result` object เอง (anti-corruption layer) — ตรงกับ NDJSON path ที่อ่าน flat อยู่แล้ว | `mit-webhook.controller.ts` |
| 5 | SSE endpoint ไม่มี heartbeat → ระหว่างรอ MIT แปลหน้าแรก (~62s, ใกล้ 100s) ไม่มี byte ไหล → Cloudflare 524 | เพิ่ม initial `: connected` byte (บังคับ proxy เข้า streaming mode) + periodic `: ping` ทุก 15s, clear บน close/end | `books.controller.ts` |

**Verified:** `npx nest build` EXIT 0 (production build สะอาด; spec files มี error เดิมที่ไม่เกี่ยว)

### 🔍 MIT Scrutiny → GitHub Issues (2026-06-04)

scrutinize ทั้ง server/orchestration layer ของ MIT แล้วเปิด 6 issues:

| Issue | Severity | สรุป |
|---|---|---|
| [#100](https://github.com/Slow-Inc/MangaDock/issues/100) | 🔴 critical | `send_webhook` ไม่ retry + กลืน error → Patch Set ที่คำนวณเสร็จหายถาวร (สาเหตุแท้จริงของ "0/20") |
| [#101](https://github.com/Slow-Inc/MangaDock/issues/101) | 🔴 critical | ยกเลิก batch ไม่ propagate ไป MIT (`DummyRequest.is_disconnected→False`) → zombie job เผา GPU |
| [#102](https://github.com/Slow-Inc/MangaDock/issues/102) | 🟠 security | path traversal + unauth บน `/result(s)/...` → read/delete นอก RESULT_ROOT |
| [#103](https://github.com/Slow-Inc/MangaDock/issues/103) | 🟠 security | worker รับ pickle ผ่าน HTTP + bind 0.0.0.0 → RCE risk; ต้อง bind 127.0.0.1 |
| [#104](https://github.com/Slow-Inc/MangaDock/issues/104) | 🟡 major | batch endpoints พัง (sent_batch arity + stub execute_batch) — dead/broken |
| [#105](https://github.com/Slow-Inc/MangaDock/issues/105) | 🟢 cleanup | dead code: duplicate imports, `String(e)` JS leftover, `start_instance=True` override, no-op if/else, dead `__del__`, `=='cancel'` |

**เฟส 3 — สแกน logic layer เพิ่ม (ข้ามไฟล์ model AI):**
- [#106](https://github.com/Slow-Inc/MangaDock/issues/106) 🟡 — event-loop blocking (`requests.get` ใน async), lock-across-await, streaming ไม่มี timeout
- [#107](https://github.com/Slow-Inc/MangaDock/issues/107) 🟡 **bug จริงใน gemini.py (default translator!)** — `server_error_attempt` UnboundLocalError ทำ retry path พังเมื่อ Gemini error + bare raise + `lstrip` prefix misuse + JSON sample IndexError
- `#105` comment — dead code เพิ่มใน translator dispatch (langid ทิ้ง, branch redundant, shared mutable cache)
- `translators/__init__.py dispatch`, `TranslatorChain`, `_run_text_translation` — ตรวจแล้ว ไม่มี critical (แค่ dead code)

**เฟส 4 — สแกน GPT shared layer + validation (ข้าม model AI):**
- [#108](https://github.com/Slow-Inc/MangaDock/issues/108) 🟡 — `config_gpt.py` few-shot sample cache (`langSamples`) ไม่ key ตามภาษา/ชนิด → แปลภาษาแรกค้าง sample กระทบ multi-lang gemini + common_gpt JSON-mode helpers พัง (text2json ขาด self, chat_sample int-index)
- [#109](https://github.com/Slow-Inc/MangaDock/issues/109) 🟡 — `_check_target_language_ratio` ใช้ langid reject ทั้งหน้า (เปราะกับ SFX/credits ที่ไม่แปล) + dead `min_ratio` param + threshold region ไม่ตรงกัน (5 vs 10)
- `#105` comment เพิ่ม — dead code: `OfflineTranslator._load` ประกาศซ้ำ, `reload` param ไม่ parse, dead `_json_sample` local
- `common.py CommonTranslator.translate`, `_validate_translation`/retry, `_check_repetition_hallucination` — ตรวจแล้ว logic ถูกต้อง

**เฟส 5 — rendering + orchestration glue:**
- [#110](https://github.com/Slow-Inc/MangaDock/issues/110) 🟡 — `render()` ใช้ `region.horizontal` (raw) ทำ box padding แต่วาดด้วย `render_horizontally` (forced) → เพี้ยนเมื่อ force direction (MangaDock ใช้ auto เลย dormant) + homography None ไม่ guard
- `_translate_until_translation` (detect→ocr glue ที่ patch path เรียก) — try/except + ignore_errors ทุก stage, early-return ปลอดภัย **ไม่มีบั๊ก**

**✅ สถานะ: ตรวจ MangaDock-relevant logic ครบ end-to-end แล้ว** — patch path traced ตั้งแต่ entry (server endpoints) → queue/executor → worker → translate_patches → detect/ocr glue → translator dispatch → gemini/qwen3 → GPT shared layer → post-translation validation → rendering → webhook → SSE

**Issues ทั้งหมด: #100-#110 (11 issues) + #105 (2 comments)**

**เฟส 6 — สแกน logic ที่เหลือทั้งหมด (ยกเว้น model AI):**
- [#111](https://github.com/Slow-Inc/MangaDock/issues/111) 🟡 — `textline_merge` prob normalize หารผิด denominator (`textlines` แทน `txtlns`) + `TextBlock` `texts[0]` default พัง + mutable default
- `#110` comment — `generic.py` `findHomography` ไม่ guard (อีก site)
- `#106` comment — `gemini_2stage.py` ใช้ sync OpenAI block event loop
- dispatch glue ทั้ง 6 (detection/ocr/inpainting/mask_refinement/upscaling/colorization) — สะอาด
- retry-pattern check: gemini.py เป็นไฟล์**เดียว**ที่ไม่ init `server_error_attempt` (chatgpt/deepseek/custom_openai/sakura init ถูกต้อง) → ยืนยัน #107

**วิธีครอบคลุม:**
- **Deep-read (ทีละบรรทัด):** server/ ทั้งหมด · MangaDock patch path ใน manga_translator.py · translators/__init__+common+common_gpt+config_gpt+gemini+qwen3+gemini_2stage · textblock+textline_merge · rendering · dispatch glue ทั้ง 6
- **Pattern-swept (grep crash-class: undefined-var-in-except, bare except, mutable default, lstrip-misuse, findHomography unguarded, sync-in-async):** ไฟล์ที่เหลือทั้งหมด รวม chatgpt/chatgpt_2stage/sakura/nllb/sugoi/m2m100/etc + mode/local+ws + utils ที่เหลือ → bug ทั้งหมด isolate อยู่ในไฟล์ที่ deep-read แล้ว
- **ไม่ได้ line-read แบบเต็ม (pattern-swept เท่านั้น):** body ของ translator ที่ MangaDock ไม่ใช้ (chatgpt_2stage, sakura, nllb ฯลฯ ~5,000 บรรทัด), CLI mode (local.py, ws.py), geometry helpers (generic.py ที่เหลือ, sort.py, inference.py)
- **ข้ามถาวร:** OCR/detection/inpainting/diffusion **model AI** (~7,500 บรรทัด)

**Issues ทั้งหมด: #100-#111 (12 issues) + comments บน #105(×2), #106, #110**

---

## ✅ #100 IMPLEMENTED — Webhook retry + dead-letter (2026-06-05, TDD)

**Design (grill-locked, user approved ทั้งหมด):** retry เฉพาะ transient (5xx/429/conn) ไม่ retry 4xx · 4 attempts (max_retries=3) · exp backoff 0.5→1→2s · timeout 20s/attempt · sequential await + cap · dead-letter = structured JSON log · env-configurable

**Approach:** แยก `send_webhook` → **`server/webhook.py`** (deps: httpx/json/hmac/hashlib เท่านั้น → test import 0.26s vs main.py 22s) เพื่อ testability/maintainability ระยะยาว

**ไฟล์ที่แก้:**
- `MIT/server/webhook.py` (ใหม่) — `send_webhook` + `_sign` + `_is_retryable_status` + `_dead_letter`
- `MIT/server/main.py` — import จาก webhook.py + ลบ def เดิม + ลบ orphan imports (hmac/hashlib/httpx ×2 — รวม duplicate ของ #105 ที่ change นี้ทำให้ orphan)
- `MIT/test/test_send_webhook.py` (ใหม่) — **10 tests, fake httpx, asyncio.run (ไม่ต้อง pytest-asyncio)**
- `MIT/.env.example` — section 5: `MIT_WEBHOOK_MAX_RETRIES`, `MIT_WEBHOOK_RETRY_BACKOFF_MS`

**Verify (ทุกขั้นผ่าน):** TDD RED→GREEN · `pytest test/test_send_webhook.py` = **10 passed 0.21s** · py_compile OK · main.py ยัง import ได้ (send_webhook re-exported)

**ติดตั้ง:** `pytest 9.0.3` ลงใน MIT `.venv` แล้ว

**Review notes:** dead-letter ปัจจุบันเป็น log อย่างเดียว (ไม่ persist/replay) — ตาม scope #100; การ persist เพื่อ reconciliation เป็นงานแยก (เกิน #100) · ยังไม่ commit (รอ user สั่ง)

## ✅ #107 IMPLEMENTED — GeminiTranslator error-handling (2026-06-05)

- **G1** `server_error_attempt = 0` ก่อน retry loop (ตกหายไป — chatgpt/deepseek/sakura มีอยู่แล้ว) → APIError ไม่ crash UnboundLocalError แต่ retry ตามตั้งใจ
- **G2** `raise` เปล่า → `raise ValueError(...)` (model misconfig ได้ error ชัด)
- **G3** `.lstrip('models/')` → `.removeprefix('models/')` (lstrip ตัด char ในเซ็ต — `models/embedding`→`bedding`)
- **G4** JSON-mode: ย้าย `loggerVals[...] = lang_JSON_samples[0]` เข้าใน `if` guard (กัน IndexError) + ลบ trailing-comma tuple
- **Verify:** py_compile OK · G3 demo (`bedding-001` vs `embedding-001`) · 25 unit tests ยังเขียว · **ไม่เขียน gemini unit test** (สร้าง translator ต้อง network = disproportionate ต่อ mechanical fix ที่ตรงกับ 3 sibling translators)

---

## ✅ #101 IMPLEMENTED — Batch cancellation propagation (2026-06-05, TDD, grilled)

Design grill-locked (ทุกข้อยึดหลักการ simplest+sustainable+perf):
- **MIT** `server/cancellation.py` — process-global `set()` registry (`mark_cancelled`/`is_cancelled`/`discard`)
- **MIT** `POST /cancel/{taskId}` endpoint → `mark_cancelled` (idempotent, no-op unknown)
- **MIT** `run_batch_with_callbacks` — double-check: ต้น loop (กันเริ่มหน้าใหม่) + ก่อน `send_webhook` (drop หน้าค้าง) + `discard(taskId)` ใน `finally` (ไม่ leak)
- **Backend** `removeBatchListener` — เมื่อ caller สุดท้ายออก → fire-and-forget `POST MIT /cancel/{jobKey}` ที่จุด abort เดิม (best-effort, swallow error)
- **Test:** `test/test_cancellation.py` — 6 tests · MIT unit suite รวม **25 passed** · Backend `nest build` EXIT 0
- commit + closed #101 · docs (ARCHITECTURE §6 + CONTRACT) อัปเดตให้ตรง

---

## ✅ #108 IMPLEMENTED — GPT sample selection (2026-06-05, TDD, Option C)

- **CG-1 (หลัก):** แทน `langcodes` fuzzy-match + per-instance cache (`langSamples`) ด้วย **direct lookup** (normalize code→name + case-insensitive) → ไม่มี cache = ไม่มี staleness ข้ามภาษา/chat-json, ไม่ต้องลง `language_data`, ลบ `self.logger` crash — ตามหลักการ "simplest + sustainable" (ลบความซับซ้อน ไม่ใช่ค้ำมันไว้)
- **พบระหว่างทาง:** sample matching **พังจริงในเครื่องนี้** (langcodes ต้องการ `language_data` ที่ไม่ได้ลง) → Gemini ได้ few-shot = ว่าง การ fix นี้แก้ทั้ง #108 + ปัญหานี้พร้อมกัน
- **CG-2:** fix JSON-mode helpers ใน `common_gpt.py` — `text2json` ขาด self, `chat_sample[0]` index dict ด้วย int → ใช้ `chatSample`, `min([])` guard (JSON mode off by default — ไม่ได้ unit-test แยก)
- **Test:** `test/test_gpt_samples.py` — 4 tests (no-staleness, code→name, unknown→[], chat/json ไม่ปน) · RED→GREEN · **ไม่ต้องลง dependency**
- รวม unit tests MIT ทั้งหมด: **19 passed** (webhook 10 + region 5 + samples 4)

---

## ✅ #111 IMPLEMENTED — Region utils (2026-06-05, TDD)

- **U-1** `textline_merge/__init__.py` — `region.prob` หารด้วยพื้นที่ของ region ตัวเอง (`txtlns`) ไม่ใช่ทั้งหน้า (`textlines`)
- **U-2** `utils/textblock.py` — `texts=None`/`[]` ไม่ crash (text="")
- **U-3** `utils/textblock.py` — `shadow_offset` ไม่ใช่ mutable default ที่แชร์กัน
- **Test:** `test/test_region_utils.py` — 5 tests (TextBlock construction + merge prob 2-region) · RED→GREEN ครบ
- commit + closed #111

---

## ✅ #109 IMPLEMENTED — Target-language check robustness (2026-06-05, TDD)

- **ปัญหา:** `_check_target_language_ratio` เดิมเอา translation ของทุก region มา merge แล้ว `langid.classify(merged)` ทั้งก้อน → SFX/credits ที่ตั้งใจไม่แปล ("SETSU SCANS") ทำให้ langid พลิกเป็นภาษาผิด → reject หน้าที่แปลถูกทั้งหน้า. `min_ratio` param ก็ dead (doc บอก "ไม่ใช้"). gate ภายใน `<=10` ขัดกับ caller page-level `>5` (หน้า 6–10 region log ว่า "starting check" แต่ฟังก์ชัน return True เงียบๆ)
- **Fix แบบ simplest+sustainable (North Star):** แทน langid-classify-merged (เปราะ) ด้วย **target-script char ratio** — นับสัดส่วนตัวอักษรที่อยู่ในสคริปต์ของภาษาเป้าหมาย แยกเป็น pure helper `utils/lang_ratio.py` (`target_script_ratio`) — ไม่มี ML import, unit-test เร็ว
  - ลบ internal `<=10` gate → ฟังก์ชันเป็น pure verdict, caller เป็นเจ้าของ policy ว่าจะเช็กเมื่อไร (page `>5`, batch `>10` — คนละ scope จงใจต่างกัน)
  - `min_ratio` กลับมาใช้จริง (`ratio >= min_ratio`)
  - langid ยังคง import (ใช้ที่อื่น line 786/1831) — ไม่แตะ
- **Test:** `test/test_lang_ratio.py` — 6 tests (Thai+SFX>0.8, untranslated-latin-when-THA<0.1, English-when-ENG>0.9, Japanese-when-ENG<0.1, empty/symbol==1.0, unknown→latin fallback) · RED→GREEN ครบ
- **Files:** `manga_translator/utils/lang_ratio.py` (new), `test/test_lang_ratio.py` (new), `manga_translator/manga_translator.py` (รื้อ body + import)
- commit + closed #109

---

## ✅ #102 IMPLEMENTED — Path traversal in result file endpoints (2026-06-05, TDD)

- `safe_result_folder(root, name)` ใน `server/path_utils.py` — reject `..`, `/`, `\`, empty, แล้ว verify `resolved.relative_to(root)` (ครอบ symlink attack)
- Wire ใน GET `/result/{folder}/final.png` + DELETE `/results/{folder}` → HTTP 400 สำหรับ invalid name
- `/results/clear` — disable by default via `MIT_ENABLE_RESULT_CLEAR=0` (unauthenticated+destructive, iterate RESULT_ROOT เองไม่ traversal แต่ต้อง opt-in)
- **Test:** `test/test_path_utils.py` — 7 tests, 0.04s, no ML
- commit `5d26ed8` + closed #102

---

## ✅ #103 IMPLEMENTED — Worker bind 0.0.0.0 RCE risk (2026-06-05, TDD)

- Extract `_build_worker_cmd(params, port, nonce)` จาก `start_translator_client_proc` — hardcode `--host 127.0.0.1` เสมอ (worker bind loopback เท่านั้น)
- ADR: `ARCHITECTURE.md` §2 + §9 อัปเดต — worker endpoints are loopback-trusted
- **Test:** `test/test_worker_bind.py` — 6 tests (loopback always, port/nonce propagated, gpu flags)
- commit `0d88711` + closed #103

---

## ✅ #104 + #105 IMPLEMENTED — Dead batch endpoints + dead code (2026-06-05)

- **#104 Decision: Remove** — production ใช้ `/translate/with-form/patches/batch` เท่านั้น. ลบ: `/translate/batch/json`, `/translate/batch/images`, `/simple_execute/translate_batch`, `/execute/translate_batch`, `BatchTranslateRequest`, `get_batch_ctx`, `BatchQueueElement`, `sent_batch`, `sent_batch_stream`
- **#105 Dead code:** collapse no-op if/else ใน `QueueElement.__init__`, remove dead `__del__` (image ไม่เคยเป็น str), remove `args.start_instance = True` override, remove `import os`
- ลบ 152 lines สุทธิ, 44 tests passing
- commit `af18459` + closed #104/#105

---

## ✅ #106 IMPLEMENTED — Async-correctness in queue/streaming (2026-06-05, TDD)

- `streaming.py` — `stream(messages, timeout=300)`: `asyncio.wait_for` + yield error frame on TimeoutError (ป้องกัน hang forever)
- `request_extraction.py` — `to_pil_image` URL path: `requests.get` (blocking) → `httpx.AsyncClient(timeout=30)` (async)
- `instance.py` — `find_executor` release lock ก่อน `event.wait()` (ป้องกัน serialise concurrent callers บน lock)
- **Test:** `test/test_async_correctness.py` — 7 tests (stream terminate, timeout, progress, httpx called, executor deadlock-safe)
- commit `1de61ff` + closed #106

---

## ✅ #110 IMPLEMENTED — Rendering direction mismatch + None homography (2026-06-05, TDD)

- **R-1** `rendering/__init__.py` line 333: `if region.horizontal:` → `if render_horizontally:` (ใช้ effective direction ไม่ใช่ raw detected — dormant ตอนนี้แต่จะพังเมื่อ forced direction ถูกใช้)
- **R-2** Guard `if M is None: logger.debug(...); return img` ก่อน `cv2.warpPerspective` (degenerate regions skip cleanly แทนที่จะ raise แล้วถูก swallow)
- **Test:** `test/test_rendering_guard.py` — 4 tests (collinear → None homography, valid → non-None, None guard, direction logic). No ML needed
- commit `93c31e6` + closed #110

---

**MIT unit suite สุดท้าย (2026-06-05): 49 tests passing** (เพิ่มจาก 25 ตอนเริ่ม session)

**ทุก issue #100–#111 ปิดหมดแล้ว**

---

### 📘 MIT documentation (blueprint สำหรับ team + agent) — 2026-06-05
- `MIT/ARCHITECTURE.md` — พิมพ์เขียว 12 sections (2-process model, directory map, patch path, translator subsystem, webhook, known issues #100–111). frame model folders เป็น black box หลัง `dispatch()` (codebase ใหญ่เพราะ model upstream — ไม่ต้อง doc ต่อโมดูล)
- `MIT/SETUP.md` — runbook: install/run/test + troubleshoot จริง (forrtl 200, model load 150s, CUDA OOM, port, webhook unreachable)
- `MIT/CONTRACT.md` — wire format MIT↔Backend; เด่นที่ **casing footgun** (single=snake_case `img_width` vs batch/webhook=camelCase `imgWidth`) + HMAC raw-bytes hazard (#95 S1) + size limits — กันบั๊กคลาส contract-drift
- **ตั้งใจไม่ทำ:** ADR log เต็ม, per-module model docs, Swagger (FastAPI มี `/docs` อยู่แล้ว) — กัน doc bloat

---

**เฟส 2 — สแกนส่วนที่เหลือ** (`mode/share.py`, `streaming.py`, `qwen3.py`, patch helpers, `config.py`):
- `translate_patches` + patch helpers (union-find grouping, mask crop/scale) — สะอาด ไม่มีบั๊ก
- `qwen3.py` (โค้ดใหม่ commit e1979cd) — แข็งแรง; default `Qwen/Qwen3.5-4B` ตรงกับ `.env.example`; ยืนยันทำงานจาก MIT log จริง
- **ข้อสังเกตเล็กน้อย (ยังไม่ filed):** `streaming.py stream()` รอ `messages.get()` ไม่มี timeout — ถ้า worker ไม่ส่ง terminal frame (code 0/2) SSE generator ค้าง (กระทบเฉพาะ streaming path ไม่ใช่ webhook path)
- **ขอบเขต:** ไม่ได้ line-audit deep ML pipeline (detection/OCR/inpaint/render/diffusion models) — เป็นโค้ด upstream และไม่ใช่จุดที่ reliability bug ของฟีเจอร์นี้อยู่

**ทดสอบ end-to-end:** ยังไม่ได้รัน — ต้อง **restart MIT** (run-server.bat) แล้วลองแปลทุกหน้าใหม่ Backend hot-reload เอง

**Review notes (ทิ้งไว้ตั้งใจ ไม่แก้ในรอบนี้):**
- **#95 S1**: HMAC ยังคำนวณบน `JSON.stringify(body)` (parsed) ไม่ใช่ raw request bytes — MIT คำนวณบน `json.dumps(separators=(',',':'))` → ถ้าเปิด secret จะ mismatch ต้องเก็บ raw body buffer (เช่น `rawBody` express verify)
- **Latent**: ใน `handleMitCallback` ถ้า throw หลัง `processingPages.add(pageIndex)` (เช่น storage fail) page จะ lock ถาวร retry ไม่ได้ — ควรห่อ try/finally เพื่อ delete จาก processingPages เมื่อ error

---

## 🔖 Pending Issues (GitHub MCP no access — publish manually when token updated)

| # | Title | Priority |
|---|---|---|
| #89 | fix(books): notify() ต้อง publish ไป Redis ใน NDJSON sync path | ✅ done |
| #90 | fix(webhook): security hardening — raw HMAC, enforce secret, img_b64 bound | ✅ done (S2+S3; S1 raw HMAC pending) |
| #91 | fix(misc): listener tracking, observability, fetch short-circuit | ✅ done |
| #92 | PRD: Qwen3 offline translator (see below) | 📋 PRD ready |

---

## 📋 PRD #92 — Qwen3 Offline Translator (2026-06-04)

### Problem Statement

ผู้ใช้ที่มี GPU (RTX 4070 Super 12GB) ต้องการรัน manga translation แบบ offline ไม่พึ่ง Gemini API แต่ MIT hardcode translator เป็น `gemini` และไม่มี Qwen3 translator class Qwen3 ยังมี thinking mode ที่ต้องปิดก่อนใช้งาน

### Solution

1. `MIT` — Qwen3Translator class ใหม่ที่ปิด thinking mode + config ผ่าน env vars
2. `MIT config.py` — เพิ่ม `qwen3`, `qwen3_big` ใน Translator enum + OFFLINE_TRANSLATORS
3. `Backend` — อ่าน `MIT_TRANSLATOR` env var แทน hardcode `gemini`

### Env Vars (MIT)

| Var | Default | Description |
|---|---|---|
| `QWEN3_MODEL` | `Qwen/Qwen3-4B-Instruct` | HuggingFace model ID |
| `QWEN3_4BIT` | `false` | INT4 quantization |
| `QWEN3_TORCH_DTYPE` | `auto` | auto/bfloat16/float16 |
| `QWEN3_MAX_NEW_TOKENS` | `4096` | Max output tokens |
| `QWEN3_BIG_MODEL` | `Qwen/Qwen3-8B-Instruct` | Model for qwen3_big key |
| `QWEN3_BIG_4BIT` | `false` | INT4 for big model |

**Backend:**
```
MIT_TRANSLATOR=gemini   # gemini | qwen3 | qwen3_big | nllb | sugoi
```

### Key Implementation Notes

- `apply_chat_template(..., enable_thinking=False)` — requires transformers >= 4.51.0; strip `<think>.*</think>` as fallback
- Qwen3-4B BF16 = ~8GB VRAM → fit ใน 12GB, ~4GB เหลือสำหรับ KV cache
- Cold start บน SN850X NVMe (~7GB/s): ~1 วินาที หลัง download ครั้งแรก

### Testing

- MIT (Python unittest): thinking tag stripping, env var reading, response parsing
- Backend (Jest): `MIT_TRANSLATOR` env → correct translator field ใน MIT config JSON; default = `gemini`
- Prior art: `books-pubsub-batch.spec.ts` สำหรับ mock `_runMitBatch`

### Out of Scope

- Frontend translator selector UI
- Qwen3 MoE 235B
- Automatic VRAM detection/quantization selection
| #91 | fix(misc): listener tracking log, observability, fetch short-circuit | 🟡 medium |

---

## Files Modified

### Frontend
- `app/lib/communityApi.ts` — Always append `limit` param (removed `!== 20` condition)
- `app/lib/apiCache.ts` — `cacheClearByTag`: collect keys before iterating (Map mutation bug fix)
- `app/components/VoteButtons.tsx` — Added resync `useEffect` on `targetId` change; moved auth check before loading guard
- `app/hooks/useForumStream.ts` — Changed SSE URLs to `/api/proxy/` prefix; added non-empty catch blocks with console.warn; fixed `esRef.current = null` in `useFeedStream` cleanup
- `app/community/page.tsx` — Added `if (!user) { showLoginPrompt(); return; }` to `handleCreatePost`; fixed SVG paths `l18 18` → `L18 18`
- `app/community/p/[id]/page.tsx` — XSS sanitization for imageUrls (`/^https?:\/\//` guard); added `mountedRef` to prevent setState after unmount in handlePostComment; removed redundant `fetchData(true)` after optimistic comment add

### Backend
- `src/auth/auth.guard.ts` — Removed duplicate `OptionalAuthGuard` class
- `src/auth/optional-auth.guard.ts` — Now the single source of truth for `OptionalAuthGuard`
- `src/forum/forum.controller.ts` — Updated import to use `optional-auth.guard`; added `Math.min(100, ...)` limit cap; fixed `getTrendingManga` parseInt; added `fs.unlink` temp file cleanup in both upload handlers; added `import * as fs`
- `src/forum/forum.service.ts` — Added `file-type` magic-byte validation for uploads (replaces client-header check); `listComments` `.limit(500)` cap; `createComment` parent check adds `.is('deleted_at', null)`; replaced all `throw new Error()` with `InternalServerErrorException`; fixed `String(err)` for unknown error types; `recalculateVotes` now uses `recalculate_votes_atomic` RPC
- `src/forum/forum-events.service.ts` — Wrapped `redis.publish` in try/catch; guarded `next()` with `!postSubject.closed`
- `src/wallet/wallet.service.ts` — Replaced `addCoins`/`spendCoins` with atomic Supabase RPC calls; removed TOCTOU `getOrCreateWallet` (upsert now handled inside RPC); all `throw new Error()` → `InternalServerErrorException`
- `src/wallet/wallet.controller.ts` — Added DEV ONLY comment to `/wallet/topup` endpoint
- `src/unlock/unlock.service.ts` — Restructured `purchaseUnlock` to insert unlock record BEFORE `processRevenueSplit`; rolls back unlock on payment failure
- `supabase-migration.sql` — Added Section 8: `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` RPC functions

### Spec Files (fixed to compile)
- `src/forum/forum.controller.spec.ts` — Updated `OptionalAuthGuard` import to `optional-auth.guard`
- `src/forum/forum.service.spec.ts` — Added 3rd constructor arg + `rpc` mock to `makeService`
- `src/wallet/wallet.service.spec.ts` — Rewrote to test new RPC-based `addCoins`/`spendCoins`; removed `getOrCreateWallet` tests

### DB (Supabase MCP applied live)
- `atomic_wallet_and_vote_rpcs` migration — `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` created
- `update_wallet_rpcs_with_balance_after` migration — Updated RPCs to include `balance_after` and `reference_id` in transaction insert

---

## ✅ Cloudflare Worker + R2 Integration — Phase A+B+C-B (2026-06-09)

Branch: `feat/context-aware-translation`

### Phase A — Worker deploy + secrets
- `Cloudflare-Worker/wrangler.toml` — fix `bucket_name = "mangadock-assets"`, `name = "mangadock-worker"`
- Worker deployed ที่ `https://mangadock-worker.akkanop2549.workers.dev`
- Secrets set: `BACKEND_SHARED_SECRET`, `MIT_PROCESS_URL`, `IMAGE_QUALITY_PROFILE`
- Endpoints verified: `/health`, `/v1/exists`, `/v1/object` (GET/PUT/DELETE), `/v1/translate`

### Phase B — CloudflareR2StorageProvider + /v1/list
- `Cloudflare-Worker/src/index.ts` — เพิ่ม `handleList()` + route `GET /v1/list` (prefix/recursive, delimiter="/" สำหรับ readdir semantics)
- `Backend/src/common/env.validation.ts` — เพิ่ม `WORKER_URL`, `WORKER_SECRET` (optional)
- `Backend/src/common/storage/cloudflare-r2.provider.ts` (ใหม่) — `CloudflareR2StorageProvider` implements `StorageProvider` (put/get/delete/deleteDir/exists/list → Worker API)
- `Backend/src/common/storage/storage.module.ts` — factory switch: `WORKER_URL`+`WORKER_SECRET` set → R2 provider, otherwise disk
- **key insight:** `DiskStorageProvider.list()` = `readdir` (basenames, 1 level) → Worker `handleList` ใช้ `delimiter="/"` เพื่อ mirror semantics เดียวกัน

### Phase C-B — Worker translate-patches + Backend routing (#184 — closed)
- `Cloudflare-Worker/src/index.ts` — เพิ่ม `MIT_PATCH_URL` ใน Env, `base64ToArrayBuffer()`, `handleTranslatePatches()` (R2 cache check → MIT → store PNGs + metadata JSON → return patches), route `POST /v1/translate-patches`
- `Cloudflare-Worker/.dev.vars.example` — เพิ่ม `MIT_PATCH_URL`
- `Backend/src/books/patches.controller.ts` (ใหม่) — `GET /r2-patches/*` → `storage.get(r2Key)` → stream PNG (เหตุผลที่ไม่ใช้ `/uploads/patches/`: `express.static` register ก่อน NestJS routes → controller ไม่ได้รับ request)
- `Backend/src/books/books.module.ts` — register `PatchesController`
- `Backend/src/books/books.service.ts` `translateMangaPagePatches()` — Worker branch: ถ้า `WORKER_URL`+`WORKER_SECRET` set → POST `/v1/translate-patches` → map `r2Key` → URL `{backendOrigin}/r2-patches/{r2Key}` → Redis cache; fallback = MIT direct (disk mode)
- tsc EXIT 0 (Worker + Backend)

**ยังไม่ทำ:** unit test Worker handler + integration test Backend→Worker path (track แยก)

**Deploy checklist:**
```
cd Cloudflare-Worker && npx wrangler deploy
npx wrangler secret put MIT_PATCH_URL   # http://26.17.141.205:5003/translate/with-form/patches
# Backend .env: WORKER_URL + WORKER_SECRET
```

### Package
- `file-type` installed in Backend (`npm install file-type`)

### Verified & Hardened (Pre-Phase 2 Audit)
- **Soft Deletion:** Verified `deleted_at` implementation in `forum.service.ts` across 9 points (Update & Filter).
- **Spoiler Blur:** Verified `spoiler` category integration in `PostCard`, `PostDetail`, and `Community` page with blur filters and click-to-reveal logic.

## What Was NOT Changed
- Pre-existing spec errors in `hardware-id.middleware.spec.ts`, `unlock.controller.spec.ts`, `wallet.controller.spec.ts` (INestApplication import) — out of scope
- Storage-before-DB order in uploadBanner/uploadImage — was already correct

## Review Notes
- `file-type` magic-byte validation: verify CJS interop on deployed Node version
- `recalculate_votes_atomic` RPC: confirm `data[0]?.upvotes` always populated after UPDATE
- `unlock.service.ts` rollback: best-effort delete — consider logging if rollback also fails

---

## ✅ Phase 1.5 Completion Verification (2026-05-27)

### Phase 1.5 Status: COMPLETE

#### Community Forum (PR #9 — merged 2026-05-27)
- `Frontend/app/community/layout.tsx` — Shared layout + mobile drawer
- `Frontend/app/community/trending/page.tsx` — Trending manga grid
- `Frontend/app/community/manga/[mangaId]/page.tsx` — Manga community feed
- `Frontend/app/community/profile/[uid]/page.tsx` — User profile page
- `Frontend/app/components/ForumSideMenu.tsx` — Sidebar navigation
- `Frontend/app/components/PostCard.tsx` — Reddit compact view + spoiler transitions
- `Frontend/app/components/SmoothScrolling.tsx` — Scroll reset on pathname change
- `Frontend/app/community/page.tsx` — Bottom sheet modal animation
- `Frontend/app/community/p/[id]/page.tsx` — Sticky header, spoiler fade, XSS fix
- `Frontend/app/lib/communityApi.ts` — Round position before send
- `Backend/src/forum/forum.dto.ts` — @IsNumber replaces @IsInt

#### Task A — Creator Earnings API + UI (pre-existing, verified complete)
- `Backend/src/wallet/wallet.service.ts` — `getCreatorEarnings(uid)` queries `translator_earnings` VIEW; returns zero values when no row exists
- `Backend/src/wallet/wallet.controller.ts` — `GET /wallet/earnings` with AuthGuard
- `Frontend/app/lib/studioApi.ts` — `CreatorEarnings` type + `getCreatorEarnings(token)`
- `Frontend/app/studio/wallet/page.tsx` — Earnings section visible only for translator/creator roles

#### Task B — HWID Middleware Enforcement (pre-existing, verified active enforcer)
- `Backend/src/common/middleware/hardware-id.middleware.ts` — Active enforcer: rejects 401 `{ statusCode: 401, message: 'Missing hardware ID' }` for protected routes; warns at logger level; whitelist covers auth/forum/wallet/public browse

### What Was NOT Changed (Phase 1.5 close-out)
- `supabase-migration.sql` — translator_earnings VIEW already existed, no migration needed
- Any file in `Documents/`, `unlock.service.ts`, `books/*`

### Notes
- Phase 1.5 is fully closed — all 4 pillars (Forum, HWID, Earnings, Zero-Trust) verified in codebase
- Ready to begin Phase 2 planning (Architectural Scaling & Cloud Readiness)

---

## ✅ Phase 2 — 2-Layer Cache Upgrade (Branch: feat/2-layer-cache-upgrade, Commit: ad72574)

### Phase 2 Cache Status: IMPLEMENTED — Pending PR

#### New Files
- `Backend/src/status/metrics.service.ts` — Node heartbeat: CPU sampling (500ms), freeMem, Supabase HEAD ping, publishes `cluster_metrics:{nodeId}` ทุก 10s (ยิงทันทีตอน startup ด้วย)
- `Backend/src/status/election.service.ts` — Redis NX Lock election: `SET cache:leader NX PX` สำหรับ acquisition, `SET XX PX` สำหรับ renewal ทุก 15s, LEADER_TTL = 37.5s (2.5× interval)
- `Backend/src/cache/batch-sync.worker.ts` — Reliable Queue: `RPOPLPUSH cache:dirty cache:processing` → sync → `LREM` ack; crash recovery ด้วย `LRANGE cache:processing` บน onModuleInit; leader-only guard ใน flush()
- `Backend/src/status/metrics.service.spec.ts` — 2 tests: startup publish, interval tick
- `Backend/src/status/election.service.spec.ts` — 7 tests: NX acquisition, contention, renewal, failover, logging
- `Backend/src/cache/batch-sync.worker.spec.ts` — 8 tests: rpoplpush, lrem ack, crash recovery, markDirty, corrupt data

#### Modified Files
- `Backend/src/cache/cache-orchestrator.service.ts` — write-behind set(): Redis write + markDirty; ลบ DEFAULT_TTL_SEC (dead code); ลบ markDirty จาก setMangaCacheWithTiers
- `Backend/src/cache/cache.module.ts` — import StatusModule, register BatchSyncWorker
- `Backend/src/status/status.module.ts` — register + export MetricsService, ElectionService

#### Key Architecture Decisions
- **Leader Election:** Redis NX Mutex แทน metric scoring — ป้องกัน split-brain และ leader thrashing
- **Reliable Queue:** RPOPLPUSH+LREM แทน LPOP — ป้องกัน data loss เมื่อ leader crash กลางคัน
- **MetricsService:** เก็บ CPU/mem/latency เพื่อ observability เท่านั้น ไม่ใช้ตัดสิน leadership
- **METRICS_STALE_MS:** 35,000ms (เพิ่ม 5s buffer จาก Redis TTL 30s)

#### What Was NOT Changed
- `books/*`, `forum/*`, `unlock.service.ts`, `wallet/*` — out of scope
- BullMQ / Supabase Edge Function — over-engineering สำหรับ stage นี้
- Pub/Sub cross-node L1 sync — scaffolding สำหรับ Phase 3

#### Bugs Found by TDD
- `flush()` เช็ค `isLeader` แค่ใน interval callback — แก้: ย้าย guard เข้าใน flush() เอง
- `onModuleInit()` ของ BatchSyncWorker ต้องเป็น `async` เพื่อให้ crash recovery เสร็จก่อน interval เริ่ม

#### Test Count: 134 passing (เพิ่มจาก 117 → 134)

#### Notes
- Phase 2 Cache branch พร้อม review ก่อน merge — รอ PR
- `cache:processing` list ควร empty ตลอดในสภาวะปกติ; non-empty หลัง flush cycle = WARN signal
- Dirty queue consumer (syncKey → JsonCache) ยังเป็น scaffolding; Supabase RPC handlers จะเพิ่มทีละ feature ใน Phase 2 ถัดไป

---

## ✅ Phase 2b — Issue #13: L3DiskService Extraction (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 147 tests passing

#### New Files
- `Backend/src/cache/l3-disk.service.ts` — Deep module สำหรับ disk I/O ทั้งหมด: `write(key, entry)` (sanitize filename + embed original key) + `readAll(): Map` (skip corrupt, swallow errors); รับ cacheDir ผ่าน `@Optional() @Inject('L3_CACHE_DIR')` เพื่อ testability
- `Backend/src/cache/l3-disk.service.spec.ts` — 5 tests: empty dir, round-trip, key sanitization, corrupt JSON skip, disk error swallow
- `Backend/src/cache/json-cache.service.spec.ts` — 3 tests: `set()` ไม่เขียน disk, `syncEntry()` ไม่เขียน disk, `onModuleInit()` warm L1 จาก L3

#### Modified Files
- `Backend/src/cache/json-cache.service.ts` — **แก้ bug หลัก**: ลบ `writeToDisk()` ออก + `set()` / `syncEntry()` เป็น in-memory เท่านั้น + `onModuleInit()` ใช้ `l3.readAll()` แทน direct `fs.readdirSync`; constructor รับ `L3DiskService` ผ่าน DI
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3DiskService` เป็น provider (ก่อน `JsonCacheService` เพราะ DI dependency)

#### Key Fix (from grill session 2026-05-28)
**Bug:** `JsonCacheService.set()` เรียก `writeToDisk()` ทุก L1 update — disk I/O overflow เพราะ L1 update บ่อยมาก
**Fix:** L3 (disk) เขียนโดย `L3DiskService.write()` เท่านั้น ซึ่งจะถูกเรียกโดย `L3BatchWriter` (Issue #14) ตาม Flush Frequency ต่อ data type — ไม่เคยเขียนใน `set()` path

#### Test Count: 147 passing (เพิ่มจาก 139 → 147)

#### What Was NOT Changed
- `CacheOrchestratorService` — interface `set()`/`syncEntry()` เหมือนเดิม
- `BatchSyncWorker` — `syncEntry()` ยังทำงานปกติ (ตอนนี้ update L1 in-memory เท่านั้น — correct)
- `batch-sync.worker.spec.ts` — mock `JsonCacheService` ไม่ได้รับผลกระทบ

---

## ✅ Phase 2b — Issues #14+#15: L3BatchWriter + Leader flush wire (TDD)

### Status: COMPLETE — 155 tests passing

#### New Files
- `Backend/src/cache/l3-batch-writer.ts` — periodic L2→L3 batch บนทุก node; FLUSH_CONFIG: wallet: 2s, stats: 5s, default: 60s; fires immediate flush on startup; skips L2-missing keys; skips when Redis unavailable
- `Backend/src/cache/l3-batch-writer.spec.ts` — 6 tests: startup flush, L2 miss skip, wallet 2s interval, manga only at 60s, destroy stops intervals, Redis unavailable

#### Modified Files (#15)
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` ตอนนี้เรียก `l3.write(key, entry)` แทน `jsonCache.syncEntry()`; inject `L3DiskService` แทน `JsonCacheService`
- `Backend/src/cache/batch-sync.worker.spec.ts` — อัปเดต mock ใช้ `L3DiskService`; assertions เปลี่ยนจาก `jsonCache.syncEntry` เป็น `l3.write`
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3BatchWriter` provider

#### Final Write-behind Architecture
```
set(key)  →  L1 in-memory  →  L2 Redis  →  markDirty

L3BatchWriter (all nodes):   L2 → L3  (per Flush Frequency per type)
BatchSyncWorker (Leader):    L2 → L3  (re-sync before future Supabase write)
```

#### Design Note (per grill)
- `L3DiskService.write()` swallows disk errors — L3 = best-effort backup
- Ack (lrem) always happens after write attempt; JSON parse fail = no ack (retry)
- `L3BatchWriter` re-attempts on next cycle ถ้า disk ชั่วคราว unavailable

#### Test Count: 155 passing (เพิ่มจาก 147 → 155)

---

## ✅ Phase 2c — Issues #18–#21: Dirty Queue Bug Fixes (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 161 tests passing (Commits: bba4a76, 6154a2d)

#### Context
PR #16 scrutiny (Issues #17 PRD) found 3 major bugs + 1 minor in the dirty-queue path. Broken into 4 issues (#18–#21) and fixed via TDD.

#### Fixes

**Issue #18 — Processing queue leak (bba4a76)**
- `recoverOrphans()` previously called `lrange` → `del` → individual `rpush` per key
- Missing: `del` was never called → orphans piled up in `cache:processing` across restarts
- Fix: Added `del(PROCESSING_QUEUE)` before `rpush` loop
- Tests: "clears cache:processing with DEL before re-queuing"; "does not call DEL when empty"

**Issue #19 — Expired key orphan (bba4a76)**
- `syncKey()` silently skipped when L2 key expired (`if (!raw) return;`)
- Expired key stayed in `cache:processing` forever → permanent orphan after crash
- Fix: `await client.lrem(PROCESSING_QUEUE, 1, key)` before early return
- Tests: "calls lrem to ack even when key is expired in L2 — prevents permanent orphan"

**Issue #20 — Shutdown durability (bba4a76)**
- `onApplicationShutdown()` was syncing L1↔L2 timestamps — useless (in-memory data lost on exit)
- Fix: replaced with `l3BatchWriter.flush()` — actually persists to disk before exit
- `CacheOrchestratorService` now takes `L3BatchWriter` as 4th constructor param
- `setMangaCacheWithTiers()` now calls `markDirty()` (was missing from write-behind path)
- New spec: `cache-orchestrator.service.spec.ts` (4 tests)
- Tests: "calls l3BatchWriter.flush() on graceful shutdown"; "does not call jsonCache.syncEntry() on shutdown"

**Issue #21 — Non-atomic crash recovery (6154a2d)**
- DEL → RPUSH sequence has a crash window where keys can be silently dropped
- Fix: single `RECOVER_SCRIPT` Lua EVAL — LRANGE + DEL + RPUSH atomically in one round-trip
- Follows RENEW_SCRIPT / DELETE_SCRIPT pattern from ElectionService
- Logs count only (not per-key) since keys not iterable client-side after Lua exec
- Tests: "uses EVAL to atomically move orphans"; "does not call DEL or RPUSH directly during recovery"

#### Architecture Decisions
- **Lua CAS pattern** for all atomic multi-step Redis operations: RENEW_SCRIPT (election renewal), DELETE_SCRIPT (lock release), RECOVER_SCRIPT (crash recovery)
- **R2 for translated manga images**, Supabase for structured metadata → `setMangaCacheWithTiers()` now participates in write-behind (markDirty)
- **L3BatchWriter.flush()** is the correct shutdown hook — L1 sync was a false guarantee

#### Test Count: 161 passing (เพิ่มจาก 155 → 161, -1 test cleanup)

#### Notes
- All 4 issues (#18–#21) closed; PR #16 branch (`feat/2-layer-cache-upgrade`) ready for final review and merge
- `RECOVER_SCRIPT` Lua script named constant lives in `batch-sync.worker.ts` alongside the queues it uses
- `cache-orchestrator.service.spec.ts` is a new file added alongside the orchestrator source

---

## ✅ Phase 2.4–2.5 — Cache Hardening (2026-05-29, PRs #60 / #61 closed)

### Status: COMPLETE — 277 tests passing

---

### Phase 2.4 — CatastrophicRecoveryService (#38)

#### New Files
- `Backend/src/cache/catastrophic-recovery.service.ts` — `OnModuleInit`: เมื่อ Redis ไม่ขึ้นตอน boot → อ่าน L3 → เปรียบเทียบ timestamp ต่อ key กับ Supabase (batch 100) → buffer winners → register reconnect callback (fire-once); `pushToL2()`: jitter 0–5s + pipeline chunk 500
- `Backend/src/cache/catastrophic-recovery.service.spec.ts` — 18 tests: T1-T10 (core + fire-once), S1-S5 (Supabase comparison), D1-D3 (smart dirty queuing)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` RPC params เปลี่ยนจาก `{ p_key, p_entry }` → `{ p_key, p_data, p_updated_at, p_ttl_ms }` (conditional upsert)
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม U1-U2: verify correct RPC param shape; `p_entry` absent
- `Backend/src/cache/cache.module.ts` — register `CatastrophicRecoveryService`

#### Key Architecture Decisions
- **Smart Dirty Queuing:** `source: 'l3' | 'supabase'` tracking — skip RPUSH เมื่อ Supabase wins (data อยู่ DB แล้ว) → เฉพาะ L3 winners เท่านั้นที่ต้อง re-sync
- **Fire-once callback:** `onReconnect()` return `unregister fn` → เรียกหลัง push สำเร็จครั้งแรก → ป้องกัน stale L3 data ทับ L2 บน reconnect ครั้งที่ 2+
- **Thundering herd:** jitter `Math.random() * 5000ms` ก่อน pipeline push
- **Supabase fallback:** ถ้า Supabase unavailable → ใช้ L3-only winners (log WARN)

#### Scrutinize Finding Fixed (post-PR)
- **Blocker:** `onReconnect` callback ไม่ unregister → push stale boot-time L3 data ทับค่าใหม่กว่าใน L2 บน reconnect ครั้งที่ 2
- **Fix (commit bcfd68d):** `const unregister = this.redis.onReconnect(() => this.pushToL2(winners).then(() => unregister()).catch(...))`
- **T10 test:** verify `unregister()` ถูก call exactly once หลัง push สำเร็จ

---

### Phase 2.4+ Round 1 — BatchSyncWorker Retry Budget + Dead-letter (#64–#66)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts`
  - Export: `MAX_RETRIES = 5`, `RETRY_COUNTS_KEY = 'cache:retry_counts'`, `DEAD_LETTER_SET = 'cache:dead_letter'`
  - On RPC fail: `HINCRBY cache:retry_counts <key> 1`; if count >= MAX_RETRIES → `SADD cache:dead_letter <key>` + `LREM` + `logger.error`
  - On RPC success: `HDEL cache:retry_counts <key>` ก่อน `LREM`
  - On L2 expiry: `HDEL cache:retry_counts <key>` ป้องกัน stale counter สะสม
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม 6 tests R1-R6

#### Key Architecture Decision
- Keys ที่ fail Supabase ซ้ำๆ วนลูป dirty→processing→dirty ไม่มีที่สิ้นสุด → ระบบ retry budget + dead-letter set ป้องกัน single bad key กิน flush budget ทั้งหมด
- Dead-lettered keys inspectable ด้วย `SMEMBERS cache:dead_letter`; re-queue ด้วย `SMOVE cache:dead_letter cache:dirty <key>`

---

### Phase 2.4+ Round 2 — mangaId Propagation in Stats Pipeline

#### Modified Files
- `Frontend/app/components/MangaReader.tsx` — สร้าง URL ด้วย `URLSearchParams` รวม `?mangaId=` param เมื่อ prop มีค่า

#### Context
- `StatsIncrementService.recordChapterView()` ตั้ง `stats:chapter:{id}:manga:{date}` key ถูกต้องอยู่แล้ว
- `BooksController.getMangaChapterPages()` รับ `@Query('mangaId')` อยู่แล้ว
- ปัญหา: `MangaReader.tsx` ไม่ส่ง `?mangaId=` ทำให้ `manga_id` ใน `chapter_daily_stats` เป็น `''` เสมอ
- ทุก component caller (`BookDetailModal`, `ContinueReadingRow`, `MangaGrid`, `BookRow`) ส่ง `mangaId={book.id}` ครบแล้ว

---

### Phase 2.4+ Round 3 — Timer Hygiene + Cache Health Endpoint (#67–#69)

#### New Files
- `Backend/src/cache/cache-health.service.ts` — `getHealth(): Promise<CacheHealthSnapshot>`: LLEN dirty/processing, SCARD dead_letter, L3 keyCount, isLeader; คืน 0 ทุกตัวเมื่อ Redis unavailable
- `Backend/src/cache/cache-health.service.spec.ts` — 6 tests H1-H6

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/stats-flush.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/redis.service.ts` — เพิ่ม `llen(key)` + `scard(key)` methods
- `Backend/src/cache/l3-disk.service.ts` — เพิ่ม `keyCount()` → count `.json` files ไม่ parse JSON
- `Backend/src/cache/cache.module.ts` — register + export `CacheHealthService`
- `Backend/src/status/status.controller.ts` — `GET /status/cache` → `CacheHealthService.getHealth()`

#### Key Architecture Decisions
- **Timer `.unref()`:** ป้องกัน Jest process leak warning; production ไม่มีผลกระทบ
- **`GET /status/cache`:** เปิดเหมือน `/status/stream` (ไม่มี auth guard) — ข้อมูลไม่ sensitive
- **`CacheHealthService`:** deep module — dependency inject ได้, mock ได้ง่าย, interface ไม่เปลี่ยน

---

### Test Count: 277 passing (เพิ่มจาก 265 → 277)

| Batch | Tests Added |
|-------|------------|
| T1-T10 (CatastrophicRecovery core + fire-once) | +10 |
| S1-S5 (Supabase comparison) | +5 |
| D1-D3 (smart dirty queuing) | +3 |
| U1-U2 (RPC param shape) | +2 |
| R1-R6 (retry budget + dead-letter) | +6 |
| H1-H6 (cache health service) | +6 |

### Notes
- PR #60 (feat/cache-phase-2-4) ปิดแล้ว — งานทั้งหมดรวมอยู่ใน PR ใหม่
- `cache:dead_letter` Redis Set ควร empty เสมอในสภาวะปกติ; non-empty = signal ว่ามี key ที่ต้องตรวจสอบ Supabase schema/constraint
- `GET /status/cache` endpoint: operator ใช้ตรวจสอบ queue depths; ไม่มี auth เหมือน `/status/stream`
- `L3DiskService.keyCount()` นับแค่ไฟล์ ไม่ parse JSON — ถูกใช้เฉพาะ health snapshot, ไม่กระทบ critical path
- `mangaId` ใน `chapter_daily_stats` จะมีค่าถูกต้องตั้งแต่ session นี้เป็นต้นไป; ข้อมูล historical ที่มี `''` ยังอยู่ใน DB แต่ไม่กระทบ future data

---

## ✅ Translation System Overhaul (2026-06-04, Session: multi-perspective review)

### Status: COMPLETE (backend) — Batch refactor (Option A') pending

#### Bugs Fixed & Tested (issues #73–#78, all closed)
- **#73** `startOrAttachBatchJob`: `.finally()` deleted job before webhooks arrived → replaced with `try/finally` + 15-min timeout + abort-signal listener
- **#74** `handleMitCallback`: raw pixel coords stored as percentages → normalized with `imgWidth/imgHeight`; patch URL uses `backendOrigin`
- **#75** HMAC mismatch (Python spaces vs JS compact) → `json.dumps(separators=(',',':'), ensure_ascii=False)`; NestJS length-checks before `timingSafeEqual`
- **#76** Idempotency race in `handleMitCallback` → `processingPages: Set<number>` locks synchronously before any `await`
- **#77** Latecomer listener added after replay loop → add before iterating `completedPages`
- **#78** TOCTOU in `startOrAttachBatchJob` → register placeholder in `activeBatchJobs` before first `await cache.get()`

#### Dead Code Removed (#81, closed)
- `BooksService.translateMangaPage()` — full-image path (never called by frontend)
- `BooksController POST /chapters/:id/pages/:idx/translate` — endpoint removed
- `Frontend translateMangaPage()` — exported but never imported

#### Other Fixes (#82–#84, closed)
- **#82** `_retryMissingPagesIndividually` now accepts `AbortSignal`; passes `maxStartupRetries:3` to limit fallback wait from 150s → 15s per page
- **#83** `checkMitHealth` calls `/ready` (not root `/`); MIT server gains `/ready` endpoint returning 503 until first worker registered
- **#84** `fetchAvailableMangaModels()` fetches from `/api/proxy/books/models` with 5-min cache + hardcoded fallback

#### New Issues Created
- **#85** fix: `translateMangaEpisode` hardcodes Thai — add `targetLang` parameter
- **#86** feat: expand target language options to all 17 MIT-supported languages
- **#87** PRD: user-selectable Gemini model for MIT image translation

#### Architecture Decision: Option A' (Redis pub/sub batch translation)
After Gemini 10-perspective scrutiny + roadmap comparison:
- Option A (in-memory job registry) — compliant but 6 bugs stem from Map-based state
- Option B (sync NDJSON only) — simpler but violates Roadmap Fire-and-Forget + Pillar 4
- Option C (sequential+cache) — violates Pillar 4 and Phase 2 GPU cloud requirement
- **Option A' chosen**: replace `activeBatchJobs` Map with Redis pub/sub; `handleMitCallback` = `cache.set` + `redis.publish`; eliminates all 6 bug classes without losing fire-and-forget/webhook pattern

#### Test Count: 299 passing (was 295)

#### Notes
- `books-batch-webhook.spec.ts` (13 tests) + `books-retry.spec.ts` (2) + `books-health.spec.ts` (2) + `mit-webhook-hmac.spec.ts` (3) added
- Option A' implementation issue pending — will replace `startOrAttachBatchJob` (~500 lines) with Redis pub/sub (~50 lines)
- `processingPages: Set<number>` added to `BatchJobState` interface (temporary, removed with Option A')

---

## ✅ Cloudflare Worker + R2 Storage Integration (2026-06-09, Branch: feat/context-aware-translation)

### Status: COMPLETE (Phase A + B) — Phase C pending design decision

---

### สิ่งที่ทำในเซสชันนี้

#### 1. R2 Bucket + Worker ตรวจสอบและตั้งค่า

- ตรวจพบ bucket จริงชื่อ `mangadock-assets` (ไม่ใช่ `mangadock` ที่ wrangler.toml เดิมระบุ)
- ตรวจพบ Worker ที่มีอยู่ใน account: `jakethewitcher`, `mangadock-assets`, `tctps` — ไม่มี `mangadock-worker`
- ตัดสินใจ deploy ในชื่อ `mangadock-worker` (Worker ใหม่) เพื่อแยกออกจาก placeholder
- ตั้ง secrets ผ่าน `wrangler secret put` (3 ค่า: `BACKEND_SHARED_SECRET`, `MIT_PROCESS_URL`, `IMAGE_QUALITY_PROFILE`)
- Worker ขึ้น production แล้วที่ `https://mangadock-worker.akkanop2549.workers.dev`
- ทดสอบ endpoints ผ่านจาก local: `/health` ✓, `/v1/exists` ✓, `PUT /v1/object` → R2 ✓

---

#### 2. ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `Cloudflare-Worker/wrangler.toml` | `name = "mangadock-worker"`, `bucket_name = "mangadock-assets"` |
| `Cloudflare-Worker/src/index.ts` | เพิ่ม `R2ListResult` interface, `handleList()` function, route `GET /v1/list` |
| `Backend/src/common/env.validation.ts` | เพิ่ม `WORKER_URL` + `WORKER_SECRET` (optional) |
| `Backend/src/common/storage/cloudflare-r2.provider.ts` | **ไฟล์ใหม่** — implements `StorageProvider` ผ่าน Worker API |
| `Backend/src/common/storage/storage.module.ts` | factory: ใช้ R2 provider เมื่อ `WORKER_URL`+`WORKER_SECRET` set, fallback `DiskStorageProvider` |

---

#### 3. Worker endpoint ใหม่: `GET /v1/list`

```
GET /v1/list?prefix=<prefix>            → directory listing (immediate children)
GET /v1/list?prefix=<prefix>&recursive=true  → all keys under prefix (สำหรับ deleteDir)
```

Response: `{ ok: true, keys: string[] }`

- `recursive=false` (default): ใช้ R2 `delimiter="/"` — คืนชื่อไฟล์และ subdirectory ระดับแรก (เหมือน `readdir` ของ `DiskStorageProvider`)
- `recursive=true`: คืน R2 keys ทั้งหมดที่ขึ้นต้นด้วย prefix — ใช้โดย `CloudflareR2StorageProvider.deleteDir()`

---

#### 4. CloudflareR2StorageProvider

`Backend/src/common/storage/cloudflare-r2.provider.ts` — implements `StorageProvider` interface ครบทุก method:

| method | Worker endpoint | หมายเหตุ |
|--------|----------------|---------|
| `put(key, data)` | `PUT /v1/object?key=` | รองรับ Buffer, string, Readable |
| `get(key)` | `GET /v1/object?key=` | คืน Buffer |
| `delete(key)` | `DELETE /v1/object?key=` | 404 = success (idempotent) |
| `deleteDir(prefix)` | `GET /v1/list?recursive=true` + delete each | parallel delete |
| `exists(key)` | `GET /v1/exists?key=` | |
| `list(prefix)` | `GET /v1/list?prefix=` | คืน basenames เหมือน readdir |

---

#### 5. StorageModule — factory switching

```typescript
// ใช้ R2 เมื่อ WORKER_URL + WORKER_SECRET ตั้งค่าไว้
// Fallback เป็น DiskStorageProvider เมื่อไม่มี env vars
```

ทุก consumer ของ `STORAGE_PROVIDER` (`BooksService`, `UploadService`, `PatchStore`) สลับไปใช้ R2 โดยอัตโนมัติ — ไม่ต้องแก้โค้ด caller

---

#### 6. ขั้นตอนที่ user ต้องทำเพิ่ม

```bash
# 1. เพิ่มใน Backend/.env
WORKER_URL=https://mangadock-worker.akkanop2549.workers.dev
WORKER_SECRET=<same value ที่ set ใน wrangler secret put>

# 2. Deploy Worker ที่อัปเดต (เพิ่ม /v1/list endpoint)
cd Cloudflare-Worker && npx wrangler deploy
```

---

#### 7. Phase C — ยังไม่ implement (pending design decision)

**ปัญหาที่พบ:** Worker `/v1/translate` ไม่ compatible กับ Backend translation flow ปัจจุบัน

| | Worker `/v1/translate` | Backend (ปัจจุบัน) |
|--|------------------------|-------------------|
| MIT endpoint | `/translate/with-form/image` | `/translate/with-form/patches` |
| Response | Full image binary (webp) | JSON patches `{xPct,yPct,wPct,hPct,url}` |
| UX | Page ถูกแทนที่ทั้งหน้า | Overlay text bubbles บนหน้าเดิม |

การ route translation ผ่าน Worker จะเปลี่ยน UX จาก "overlay patches" → "full image replacement" ซึ่งเป็น design decision ใหญ่ — รอ confirm ก่อน implement

---

#### ตั้งใจไม่แตะ

- Forum, wallet, unlock, users modules — ไม่เกี่ยว
- Frontend — URL shape เดิมทั้งหมด
- MangaDex CDN URLs — คงเดิม
- `ImageCacheService` (local thumbnail cache) — ยังใช้ disk ตามเดิม (scope แยก)
- `MANGA_TRANSLATOR_URL` ใน Backend — MIT patch translation ยังทำงานผ่าน direct call เหมือนเดิม

---

## 🛠️ V5 Final Hardening (Commit 69712f9)
- **Error Handling:** เปลี่ยน `throw new Error()` เป็น `InternalServerErrorException` ทั้งหมดใน `UnlockService` เพื่อมาตรฐานความปลอดภัย
- **Runtime Validation:** ติดตั้ง `forum.dto.ts` และเปิดใช้งาน `ValidationPipe` (class-validator) แบบ Global ใน `main.ts` ป้องกัน Payload ที่ผิดโครงสร้าง
- **Test Integrity:** แก้ไข `forum.controller.spec.ts` ให้ Mock ข้อมูลตรงตาม Contract จริง `{ items, total }`
<!-- lang:end -->

## 2026-06-09 — Render-parity E2E proof (#176 + #181 + #179 + #166/#170)
Full-stack restart (worker fresh = new code, backend `MIT_EN_COMIC_FONT=1 MIT_SUPERSAMPLING=4`,
frontend, cloudflared tunnel), 3-layer cache cleared + backend L1 reset.
`MIT/tools/ab_parity.py` → benchmark page JA→EN through worker with full parity render config.
Result: 6/6 regions translated + rendered, BubbleSeg 5 balloons/3 tagged, 1 merged patch,
comic font (`comic shanns 2.ttf`) confirmed loaded, 4× supersampling + safe-area narrow column active.
Montage `MIT/tools/_bubble_proof/parity_montage.png` [original | ours | MangaTranslator-ref].
Remaining gaps vs MangaTranslator: ALL-CAPS casing, SFX translate (#168, model dl), bolder weight.

## 2026-06-09 — Render-parity port plan + #168 model approved
Dug MangaTranslator (meangrinch) clone render path → `docs/research/render-parity-port-plan.md`.
Corrections: ALL-CAPS is `pipeline.py:1375 text.upper()` (real code, not prompt); SFX uses
`deepghs/AnimeText_yolo` (matches #168). User APPROVED downloading animetext_yolo (~400MB).
Starting /tdd: A=ALL-CAPS knob → C=font fill (relax cap+squeeze) → B=heavier font → then #168 SFX+outline.

## 2026-06-09 — /tdd render-parity slices A+B+C (opt-in knobs)
A (ALL-CAPS): backend MIT_EN_UPPERCASE → render.uppercase (MIT already honored it, manga_translator.py:1125).
C (bubble fill): new pure helper font_fit.font_high_cap + RenderConfig.font_max_box_ratio (default 0.5
= byte-identical) threaded dispatch→resize→_bubble_fit_font_size; backend MIT_FONT_MAX_BOX_RATIO (frac).
B (font weight): RenderConfig.en_font filename override in _render_font_path (BYO heavier face, MangaTranslator
style); backend MIT_EN_FONT.
Tests: MIT 36 passed (font_high_cap unit + wiring), Backend 26 passed (3 knob pairs); render import verified.
E2E worker-direct `tools/ab_parity2.py` → `parity2_montage.png` [original|v2_comic|v2_aa3|MangaTranslator]:
ALL-CAPS + fuller fill confirmed; weight still below MT (needs CC Wild Words via en_font). SFX = #168 next.

## 2026-06-09 — #168 SFX detector wired (AnimeText YOLO) + E2E
Model auto-downloads (gated deepghs/AnimeText_yolo, HF_TOKEN from MIT/.env via load_dotenv; cache warmed,
119MB). New manga_translator/sfx_detector.py (mirrors bubble_detector.py #170): lazy hf_hub_download → YOLO
→ boxes. Integrated in _run_detection (gated by det_sfx): AnimeText 2nd pass → dedup_sfx_boxes vs DBNet
textlines → survivors appended as empty Quadrilateral textlines → OCR/translate/render.
E2E `tools/ab_sfx.py` → `sfx_montage.png`: [SFXDetect] 8 boxes, +2 new textlines (deduped 6); region フッ→"Hmph"
now appears (DBNet never found it). LIMITATION: heavily-stylized SFX ぬ〜 IS detected but 48px OCR can't read
the hand-drawn katakana → empty → not translated (OCR gap #172/#167, not detection). MangaTranslator's "LOOM"
needs better OCR. Gap F (dedicated SFX outline) deferred — uses default border for now.
Tests: MIT 41 passed (sfx wiring), Backend 66 passed. All render-parity work (A/B/C/#168) opt-in, byte-identical off.

## 2026-06-09 — #180 Knuth-Plass line-break (pure module, step 1)
New manga_translator/line_break.py: find_optimal_line_breaks() — pragmatic Knuth-Plass DP
(badness=slack^3, hyphen_penalty=1000) ported from MangaTranslator text_processing.py:489-579.
Pure, dependency-light (word-width callback). Tests: test_line_break.py 5 passed (balanced break
beats greedy short-last-line, empty, fits-one-line, overwide-lone-token no deadlock, hyphen penalty).
NEXT (step 2, not done): wire into rendering/text_render.calc_horizontal behind a knob (replace the
greedy word-packing loop ~774-845) + E2E — risky integration into the core wrapper, deserves a focused pass.

## 2026-06-09 — #180 step 2 deferred → tech-debt issue #186
Traced rendering/text_render.py::calc_horizontal for the Knuth-Plass wiring: ~270-line monolith
(greedy pack + cross-line syllable hyphenation + single-char rebalance + assembly over shared mutable
state, lines 664-934). Forcing the DP in = high regression risk. Per user, recorded as tech debt instead:
filed #186 (refactor: extract pluggable LineBreaker seam, byte-identical greedy) + commented on #180
that step 2 is blocked-by #186. Pure module (#180 step 1) stays committed & unused (byte-identical).

## 2026-06-09 — MIT tech-debt audit → backlog issues #186–#193
4-agent structural audit of MIT (orchestrator, rendering, detect/ocr/inpaint/translators, config/server/tests).
Filed bilingual tech-debt issues (label MIT): #186 calc_horizontal line-break seam · #187 MangaTranslator god
object · #188 model-lifecycle + translator base abstractions (kill global MODEL state) · #189 glyph-render
dedup (put_char h/v + stroke) · #190 resize_regions + box-padding decomposition + constants · #191 vendored
LDM/YOLOv5 trim (license+maint) · #192 config centralize + cleanup (load_dotenv import side-effect, bare
excepts, TranslatorChain TODO) · #193 worker --start-instance lifecycle (5003/5004 orphan, PID, collision).

## 2026-06-09 — #186 tech-debt: characterization net + first calc_horizontal extractions
TDD refactor-under-test on rendering/text_render.py::calc_horizontal (the #186 monolith).
- Added test/test_calc_horizontal_characterization.py: golden line-break output on 4 representative
  strings (pinned to bundled Arial-Unicode font) = safety net for the whole #186 decomposition.
- Extracted _split_words_and_widths + _split_into_syllables from calc_horizontal (verbatim, byte-identical).
  Net caught a real leak (hyphenator used by Step 2/4) → restored in scope.
Verified byte-identical: characterization + rendering_guard + pure-module suite all green (47 passed).
NEXT on #186: broaden characterization cases (CJK/Thai/zwsp/empty), then extract the greedy packing
(Step 1) into the pluggable LineBreaker seam so Knuth-Plass (#180) can slot in.

## 2026-06-09 — #186 milestone: greedy line-break extracted into a swappable seam
Applied the "test all scenarios first" rule (memory feedback_techdebt_all_scenarios): broadened the
characterization net to 16 cases covering the rarely-hit branches (height-overflow max_width expansion,
max_width<2*font clamp, Step 2 backward hyphenation, mixed EN+CJK, whitespace collapse, char-split,
hyphenate on/off) BEFORE touching code. Then extracted calc_horizontal's Step-1 greedy packing into
text_render._greedy_pack(words, word_widths, syllables, font_size, max_width, ws_off, hyphen_off)
-> (line_words_list, line_width_list, hyphenation_idx_list). Steps 2-4 post-process its output unchanged.
Byte-identical: 26 passed (characterization + guard + pure modules). This IS the #186 seam — #180 step 2
now just adds a Knuth-Plass packer with the same signature + selects it behind a knob.

## 2026-06-09 — #192 slice (a): extract TranslatorChain parsing (pure, tested)
Pulled config.py's `# TODO: Refactor` TranslatorChain parse into manga_translator/translator_chain.py
::parse_translator_chain(string, resolve_translator, valid_translators, valid_languages) — deps injected
so it unit-tests with no translators/ML import. Wired TranslatorChain.__init__ to delegate; byte-identical
(real-deps check: gemini:ENG → same chain/translators/langs/target_lang). Tests: test_translator_chain.py
7 passed (single/multi/empty/unknown-name KeyError/disabled ValueError/unknown-lang ValueError + wiring).
TODO marker resolved. Next #192 slices: dead fields, bare excepts, load_dotenv import side-effect.

## 2026-06-09 — #192 slice (b1): remove dead vestigial fields
Removed self._batch_contexts / self._batch_configs from MangaTranslator.__init__ (manga_translator.py:135-136)
— assigned once, never read anywhere (grep-confirmed). Import OK; 19 tests green. Remaining #192:
bare-except cleanup (20+ sites, per-site policy — its own slice), load_dotenv import side-effect (blast
radius: worker HF_TOKEN auto-download + API keys — needs entry-point tracing, flagged before touching).

## 2026-06-09 — #187 slice: extract pure validation check off the god object
Pulled `_check_repetition_hallucination` (a pure verdict masquerading as an async method that awaited
nothing) out of the 3,200-line MangaTranslator into manga_translator/translation_checks.py
::check_repetition_hallucination — the seam where new post-translation validators attach (feedback_core_boundary)
instead of growing the orchestrator. The async method now delegates; byte-identical (verified vs the pure fn on
4 cases). Tests: test_translation_checks.py 5 passed (char/segment/phrase repetition, empty/short, threshold).
God object shrank ~50 lines. Next: extract _check_target_language_ratio into the same seam.

## 2026-06-09 — #187 slice (b): extract target-language-ratio check off the god object
Pulled `_check_target_language_ratio` (a pure verdict, Issue #109) into translation_checks
::check_target_language_ratio(text_regions, target_lang, script_ratio, min_ratio) — script_ratio injected
so it unit-tests with a stub (the real target_script_ratio passed in production). Async method delegates;
byte-identical (verified vs pure fn). Tests: test_translation_checks.py 10 passed (5 repetition + 5 ratio).
The validator seam now holds both post-translation checks; new validators attach here, not in the god object.

## 2026-06-09 — #187 slice (c): extract duplicated punctuation correction off the god object
The quote/bracket punctuation-correction logic (check_items + replace_items tables + a per-region
mutation loop) was DUPLICATED inline in two places in MangaTranslator (translate + batch paths, ~150 lines
total). Extracted verbatim to manga_translator/punctuation.py::correct_punctuation(source_text, translation)
— pure string logic. Both call sites now delegate via `region.translation = correct_punctuation(region.text,
region.translation)`; the data tables are gone from the god object. Byte-identical (6 golden characterization
cases capturing the smart-quote->corner-bracket conversion, forced replacements, count-mismatch no-ops).
Tests: test_punctuation.py 7 passed (6 behavioral + wiring inspection). Regression suite 36 passed.

## 2026-06-09 — MIT core deep analysis + roadmap reconciliation (answering "did you analyze deeply / follow the roadmap")
Honest gaps: had only audited (file:line), not deep-analyzed the hard core; and had deviated from the
foundation-first roadmap (jumped to #187 easy slices). Fixed via a 6-agent ultracode deep read →
docs/research/mit-core-decomposition-analysis.md: 26 seams (S1-S26) with deps, test strategy, and 16
source-cited landmines (TTL key drift L1, divergent min_ratio 0.3/0.5 + threshold 6/>10 L6, singleton
page-context bleed L9, exit(-1) in a stage L2, cleanup-task leak L14). Reconciled the roadmap: #187/#188
are ~16 interleavable seams (the already-done punctuation/validator/greedy-pack extractions ARE S-seams),
not monolithic Phase-C. Corrected next 3 steps: S1 filter_translated_regions (verbatim 3-way dedup) → S2
apply_translations → S3 ModelUsageTracker (#188 starts early). Landmines must be PRESERVED then fixed behind opt-in flags.

## 2026-06-09 — #187 S1: collapse the verbatim 3-way post-translation region filter
Following the reconciled roadmap's corrected step 1 (the highest-value/lowest-risk dedup the old plan
missed). The should_filter block (drop blank/numeric/filter-matched/identical-to-source translations) was
verbatim-identical in three MangaTranslator paths (single/batch/concurrent). Extracted to
region_filter.filter_translated_regions(text_regions, config); all 3 sites now delegate (should_filter
count: 3→0). Byte-identical incl. none (only-blank) + original (no identical-check) carve-outs.
Tests: test_region_filter.py 7 passed (every branch + carve-outs); regression 35 passed.

## 2026-06-09 — Persist all MIT exploration/analysis/plans (context-loss insurance)
Created docs/reports/mit-refactor-progress.md — the SINGLE resume point: read-order index, governing rules,
the landmines-to-preserve quick-ref, the S1-S26 seam status table (done/next/blocked + commit hashes), the
#186-#193 issue status, and pending items (#180 wiring, glossary assembly). Added memory
project_mit_refactor_resume pointing a fresh session at it. All canonical artifacts already committed
(analysis, plan, dissection, port-plan, report). A reset context can now resume at S2 without re-exploring.

## 2026-06-09 — #187 S2: fold the 4 translation→region assign copies + 3 original-as-translation copies
Following the reconciled roadmap's corrected step 2. The happy-path "assign each translated sentence to its
region + stamp target_lang/_alignment/_direction" loop was near-duplicated in four MangaTranslator paths
(single / batch-memory-fallback / batch shared-index / concurrent), the render-casing logic appeared a fifth
time in the retry path, and an error-fallback "use the source text as its own translation" loop in three
more. Extracted to region_apply.{apply_translations, apply_render_casing, apply_original_as_translation};
all 8 sites delegate (region.translation-assign loops 8→0). Byte-identical: preserves the L10 zip-truncation
invariant (single/batch zip; concurrent's i<len guard yields the same kept-set so it collapses to the same
zip), the single-path-only casing (apply_casing flag — batch/concurrent/memory-fallback never cased), and
the batch shared-index by returning the consumed count so the caller advances text_idx itself. New branch
off main (refactor/mit-seam-s2-apply-translations).
Tests: test_region_apply.py 9 passed (assign+metadata, casing on/off, in-place re-case, L10 truncation,
extra-dropped, shared-index threading, original-as-translation no-casing); region_filter 7 + translation-
path regression 32 passed; full suite 177 passed (the 19 async-not-supported failures are pre-existing —
verified identical on the stashed base).

## 2026-06-09 — #187 S3 / #188 starts: ModelUsageTracker (wrap _model_usage_timestamps)
First #188 seam (interleaved early per the reconciled roadmap). The model-usage TTL dict was stamped from 8
inline _run_* sites (self._model_usage_timestamps[(tool, model)] = current_time) and swept in
_detector_cleanup_job with a list(items()) loop + mid-iteration del. Extracted to
model_usage_tracker.ModelUsageTracker — touch(tool, model, now) / expired(ttl, now) / forget(tool, model),
clock injected so it tests in <1s with no ML stack. All 8 sites now call touch(...); the sweep is
`for tool, model in tracker.expired(self.models_ttl, now): await _unload_model(...); tracker.forget(...)`.
Byte-identical: keys NOT normalised so the L1 key-drift is pinned verbatim ('colorizer' never matching
_unload_model's case 'colorization'; 'textline_merge'/'rendering' no-case) — golden'd before S4 freezes the
unload routing; strict `> ttl`; insertion-order list(...) snapshot so mid-sweep forget is safe (L13). 0
remaining _model_usage_timestamps refs. Stacked on the S2 branch (refactor/mit-seam-s3-model-usage-tracker).
Tests: test_model_usage_tracker.py 7 passed (strict-> boundary, insertion order, forget, safe-forget-during-
iteration, re-touch refresh); full suite 184 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S4 / #188: ModelUnloader (routing table replaces _unload_model match/case)
The 6-arm `match tool:` in _unload_model became model_unloader.ModelUnloader — an injected
{tool: async unload_fn} table + empty_cache/cuda_available hooks; _unload_model is now a one-line delegate
(await self._model_unloader.unload(tool, model)). The ctor wires the table from the real unload_* imports
(colorization/detection/inpainting/ocr/upscaling/translation) + torch.cuda.empty_cache/is_available. Routes
injected → module pulls in no ML stack, tests via asyncio.run (pytest-asyncio not active here). Byte-identical:
same log line, same fall-through-then-empty_cache order, and crucially the L1-drifted keys the tracker stamps
('colorizer' vs the table's 'colorization', plus 'textline_merge'/'rendering') route to NOTHING — the same
latent no-op the match/case had, now pinned by a test (3× empty_cache, 0 unloads) before the routing is
frozen. Stacked on S3 (refactor/mit-seam-s4-model-unloader). S3+S4 together lift the model-lifecycle state
(tracker + unloader) out of the god object — the #188 foundation; next #188 seam is S20 ModelReaper (the TTL
loop) after S5.
Tests: test_model_unloader.py 4 passed (known-tool route+cache, L1-drift no-op ×3, no-empty-cache-when-cuda-
unavailable, per-tool routing); full suite 188 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S5: release_memory (fold the 4 verbatim gc.collect + empty_cache copies)
The `gc.collect()` + `if torch.cuda.is_available(): torch.cuda.empty_cache()` cleanup was repeated verbatim in
4 MangaTranslator spots (>85% pre-processing guard, MemoryError fallback, per-page individual cleanup,
per-batch tail). Extracted to memory_guard.release_memory(cuda_available, empty_cache) — the two torch hooks
injected so it unit-tests with no torch. All 4 sites → release_memory(torch.cuda.is_available,
torch.cuda.empty_cache); 0 remaining gc.collect/import gc in the god object. Byte-identical (same
collect-then-empty order, same cuda gating). Surgical-scope note: the psutil virtual_memory().percent > 85
pressure check is single-use, so it was NOT extracted (nothing to de-duplicate; the analysis's
under_memory_pressure() is deferred until a 2nd site appears — folding a single-use block would add a function
without collapsing drift, against the North Star). Stacked on S4 (refactor/mit-seam-s5-memory-guard).
Tests: test_memory_guard.py 2 passed (collect-then-empty when cuda available; collect-only when not); full
suite 190 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S7: context_page_counts (fold the 2 context-carry accounting blocks)
The (pages_used, skipped) accounting — "how many recent non-empty pages to carry, how many expected pages
skipped for being empty" — was identical in single dispatch (_dispatch_with_context) and concurrent dispatch
(_batch_translate_texts), each feeding the "Carrying N" / "Skipped N" log lines. Extracted to
context_counts.context_page_counts(context_size, done_pages); both sites → one-line call so the two paths'
logged numbers can't drift. Byte-identical: both counts capped at context_size, blank-page detection
any(sent.strip() ...) preserved. Scope note: _build_prev_context recomputes its OWN non_empty_pages/pages_used
to slice the context tail — that's the S6 seam, left untouched. Stacked on S5
(refactor/mit-seam-s7-context-counts).
Tests: test_context_counts.py 7 passed (context_size=0, no-pages, all-non-empty, blank-skipped, budget-caps-
so-empty-not-skipped, budget-above-non-empty, page-empty-only-if-all-blank); full suite 197 passed (same 19
pre-existing async failures); context regression (test_page_context/test_series_context) green.

## 2026-06-09 — #187 S8: apply_post_dictionary (fold post-dict apply+log; move dict helpers to dictionary.py)
The post-translation dictionary apply+log block was verbatim in single (_translate) and batch
(_apply_post_translation_processing). Extracted to dictionary.apply_post_dictionary(text_regions,
post_dict_path) — applies post-dict to each region.translation in place, collects "before => after" records,
logs per-line + summary (or "No post-translation replacements made."), returns the list. The pure
load_dictionary/apply_dictionary helpers were MOVED out of manga_translator.py into the same new dictionary.py
(they only use os/re/logger, no MangaTranslator deps) so the stage tests with no ML stack; manga_translator
re-imports all three, so `from .manga_translator import load_dictionary` still resolves and __main__.py is
untouched (verified: load_dictionary.__module__ == manga_translator.dictionary). Byte-identical: same records,
same logs, same `import regex as re` semantics. Completes the Phase-A low-risk cluster (S1-S5,S7,S8); S6
build_prev_context (med-risk) is next. Stacked (refactor/mit-seam-s8-post-dictionary).
Tests: test_dictionary.py 6 passed (replace, token-delete, summary+per-line logs, no-replacements message,
empty-path no-op, moved-helper parse/apply); full suite 203 passed (same 19 pre-existing async failures).

## 2026-06-09 — E2E smoke-validation of the S2-S8 stack (live pipeline, hayateotsu.space)
User brought up MIT on the refactored working tree + ran a real translation (OPM benchmark page). Result: full
pipeline ran end-to-end clean — translate → region-assign + uppercase casing (S2, visibly correct) → post-dict
(S8) → model lifecycle (S3/S4/S5) → render; no crash, all bubbles populated & placed, hyphenated. Output is
markedly better than the pre-render-parity "before" shot (no edge-clipping). Confirmed the refactor caused NO
regression. The remaining gap to the MangaTranslator target (translation wording/naturalness, missing space
after punctuation — present in the "before" shot too, ぬっ SFX→"LOOM" not rendered, minor fit) are pre-existing
translation/SFX(#168)/line-break quality issues ORTHOGONAL to the byte-identical decomposition. Decision: finish
the refactor workstream first (no PR / no quality work yet).

## 2026-06-09 — #187 S6: build_prev_context (pure fn; per-mode index policy explicit)
MangaTranslator._build_prev_context (the ~50-line per-mode context-string builder) extracted to pure
prev_context.build_prev_context(all_page_translations, original_page_texts, context_size, *, use_original_text,
current_page_index, batch_index, batch_original_texts); the method is now a thin delegate so its 2 call sites
are untouched. Byte-identical: preserves the L7 available_pages.index(page) FIRST-MATCH (duplicate-content pages
map to the earliest original), the pages_used==0 / not-available_pages empty short-circuits, and the concurrent
`pass` (no append when not using original text). hasattr(self,'_original_page_texts') -> `is not None` (equiv —
the attr is always init'd []). Process note: Serena replace_symbol_body mis-detected the method start line and
produced a duplicate def + ate part of _dispatch_with_context; caught by grep, reverted file to S8 state, redid
with an anchored regex. Stacked (refactor/mit-seam-s6-build-prev-context).
Tests: test_prev_context.py 11 passed (numbered output, context_size<=0, no-pages, blank-skip+cap,
current_page_index slice, use_original pull, L7 duplicate first-match, original-fallback, concurrent append vs
pass); context regression (test_page_context/test_series_context) green; full suite 214 passed (same 19
pre-existing async failures, no new breakage).
## 2026-06-09 — #187 S9: none-translator front-matter guards (L12 + L3)
Two landmine pieces of _run_text_translation's front-matter extracted to none_translator.py:
apply_prep_manual_override(config, prep_manual) (L12 — prep_manual forces translator=none by mutating
config.translator.translator in place; poisons a reused Config, preserved verbatim) and
stamp_none_translations(text_regions, config) (L3 — blanks every region.translation + stamps metadata; caller
returns ALL regions unfiltered vs the filtered normal path). Call-site order preserved EXACTLY (override →
tracker.touch → if-none stamp + return ctx.text_regions) so touch still fires for the none path. Byte-identical.
Stacked (refactor/mit-seam-s9-none-translator).
Tests: test_none_translator.py 4 passed (prep_manual true/false, none-stamp metadata, empty-list no-op); full
suite 218 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S10: translation side-channel I/O (load/save_text)
The --load-text/--save-text JSON read/write in _run_text_translation extracted to
translation_store.{read_translations, write_translations} (byte-identical: indent=4, ensure_ascii=False). The
print(...) + bare exit(-1) (L2) and the input_files[0] filename derivation are LEFT INLINE (exit is a
process-control landmine clearer when visible); no IndexError guard added (would change behaviour). Latent bug
surfaced + preserved: the inline open(...,"w") had no encoding=, so on cp1252-default Windows ensure_ascii=False
non-ASCII raises UnicodeEncodeError — candidate fix (encoding="utf-8") deferred to an opt-in change; logged in
the progress doc. Stacked (refactor/mit-seam-s10-translation-store).
Tests: test_translation_store.py 3 passed (round-trip, indent-4 array, non-ASCII unescaped ensure_ascii=False);
full suite 221 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — #187 S11: ImageDebugContext (full class — debug-folder path lifecycle)
The invasive one (user chose full extraction for long-term tech-debt reduction). Consolidated the scattered
_current_image_context / _saved_image_contexts state + _set/_get/_save/_restore_image_context helpers +
_result_path + the 2 manual save/restore swap closures into image_debug_context.ImageDebugContext
(set/subfolder/save/restore/clear_saved/with_context/result_path). Approach: state+logic moved into the class;
the 5 methods became THIN DELEGATES (so their ~call sites are unchanged); ~18 direct self._current_image_context
reads -> self._image_debug.current (mechanical rename, dict shape preserved); the 2 swap closures
(original=...; ...=X; try: result_path; finally: ...=original) -> `with self._image_debug.with_context(X):
return self._result_path(path)`. Byte-identical: same subfolder format, same verbose/web/result_sub_folder path
branches incl. the no-context default {ts}-unknown-1024-unknown-unknown, same makedirs, same getattr defaults.
0 orphan refs; diff reviewed call-site-by-call-site. Stacked (refactor/mit-seam-s11-image-debug-context).
Tests: test_image_debug_context.py 13 passed (subfolder, save/restore round-trip+miss, no-current save no-op,
with_context swap + exception-restore, 5 result_path goldens, set with/without image + getattr defaults); full
suite 234 passed (same 19 pre-existing async failures, no new breakage).

## 2026-06-09 — PR #195 merged + #187 S12 (globals half): apply_global_settings
PR #195 (seams S2–S11, 10 byte-identical extractions) addressed the github-code-quality finding (dual-import
style in test_image_debug_context → single `idc.` form) and was **merged to main** (merge `88a01eb`). Resolved a
merge collision in Backend/.env.example by keeping main's canonical Cloudflare Worker config (akkanop-x domain).

Then S12 (globals half): the process-global construction side effects — conditional ModelWrapper._MODEL_DIR
override (was in parse_init_params) + the two torch.backends.*.allow_tf32=True flags (were in __init__) →
pipeline_params.apply_global_settings(params), called once after parse_init_params. Removed the now-unused
ModelWrapper import (0 refs left). Byte-identical: nothing reads _MODEL_DIR between its old (mid-parse) and new
(post-parse) position, models load lazily at translate time, TF32 flags + relative order preserved. The
PipelineParams value object for the ~20 parsed fields is DEFERRED until #192 (entangled with device/using_gpu/
raise + ordering — the analysis gates it on config-centralisation). Branch refactor/mit-seam-s12-pipeline-params.
Tests: test_pipeline_params.py 3 passed (model_dir override / absent-or-empty no-op / TF32 flags); full suite
237 passed (same 19 pre-existing async failures, no new breakage). Next actionable seam: S20 ModelReaper (deps
S3+S4 done).

## 2026-06-09 — #187 S20 / #188: ModelReaper (TTL loop off the god object)
_detector_cleanup_job (the background model-TTL polling loop) extracted to
model_reaper.ModelReaper(tracker, unloader, get_ttl): _loop polls the testable reap_once(now) once/sec; the 2
task-creation sites now call self._model_reaper.start() behind their existing `is None` guard; the method is
gone. Wraps the S3 tracker + S4 unloader (both on main). Byte-identical: ttl==0 short-circuit preserved,
list(...) snapshot (L13) intact via tracker.expired, unload-before-forget order kept; reaper calls
unloader.unload directly (== the old _unload_model delegate). L14 fix is OPT-IN: stop() cancels the task but
nothing calls it by default → the cleanup-task leak is preserved verbatim until a caller opts in. Stacked on S12
(refactor/mit-seam-s20-model-reaper).
Tests: test_model_reaper.py 5 passed (unload→forget order, ttl==0 no-op + expired-not-queried, start creates
task, stop cancels, stop-no-task no-op); full suite 242 passed (same 19 pre-existing async failures, no new
breakage). Next: S15 Stage protocol (#187 core begins; deps S3 done).

## 2026-06-09 — #187 S13 / #168: DetectionPostProcessor (move SFX second-pass merge off the god object)
_merge_sfx_detections + _textline_aabb (the AnimeText SFX second-pass, gated by config.detector.det_sfx)
extracted to detection_postproc.{merge_sfx_detections, textline_aabb}; _run_detection now calls
merge_sfx_detections(ctx, result, self.device); the 2 methods + the now-unused Tuple import removed. Done
without S15 (call-site gate unchanged). Byte-identical (same IoA dedup, empty-Quadrilateral append, [SFXDetect]
log, str(device or 'cuda')). Stack (refactor/mit-seam-s13-detection-postproc).
Stale-test fixes surfaced by the full-suite run (both are source-inspection wiring tests repointed to the new
module locations): test_sfx_merge (merge body moved to detection_postproc.py) and — PRE-EXISTING since S2 merged
— test_safe_area::test_en_uppercase_lettering_is_wired (S2 moved casing to region_apply.py but the test still
grepped manga_translator.py). MIT test baseline is now 18 async-only failures (was 19; one was this stale test).
Tests: test_detection_postproc.py 2 passed (AABB golden, no-SFX identity short-circuit); full suite 245 passed
(18 pre-existing async failures, 0 real failures). Next AFK seam: S16 TranslationMemory.

## 2026-06-09 — #187 S16: TranslationMemory (name the cross-page bleed boundary)
The two cross-page lists (all_page_translations + _original_page_texts) + reset_page_context extracted to
translation_memory.TranslationMemory (all_page_translations, original_page_texts, reset()). self._translation_
memory holds them; ~16 direct refs renamed mechanically (lists stay plain lists → append/len/index/slice
identical); reset_page_context delegates to .reset(). Makes the #136/#140 worker-singleton bleed boundary an
explicit object (L9). Byte-identical: append sites still caller-driven (L7 asymmetry), reset still only from
translate_patches (L9), reset rebinds not .clear() verbatim. Updated test_page_context's _bare_translator to the
new memory location (it set the old attrs directly + reset now delegates). Stack
(refactor/mit-seam-s16-translation-memory).
Tests: test_translation_memory.py 4 passed (empty init, appendable, reset clears, reset-rebinds-not-clears);
context regression (test_page_context/test_series_context) green; full suite 249 passed (18 pre-existing async
failures, 0 real failures). Next AFK seam (last before core): S19 gather_per_context.

## 2026-06-09 — #187 S19: gather_per_context (concurrent gather + per-exception placeholder)
The concurrent driver's asyncio.gather(return_exceptions=True) + per-exception keep-original placeholder loop
extracted to gather_per_context.gather_per_context(tasks, contexts_with_configs, ignore_errors); the inline
~20-line block → one `final_results = await gather_per_context(...)` (bracketing Starting/Completed logs kept).
Byte-identical: same return_exceptions=True, re-raise-unless-ignore_errors, apply_original_as_translation
placeholder gated on ctx.text_regions, index alignment + logs. apply_original_as_translation still used at its
other (batch error-fallback) sites — no orphan. Stack (refactor/mit-seam-s19-gather-per-context).
Tests: test_gather_per_context.py 4 passed (all-succeed order, exception+ignore→placeholder index-aligned,
exception+not-ignore→reraise-original, no-regions skips-apply); full suite 253 passed (18 pre-existing async).

## 2026-06-09 — AFK decomposition batch done (S12-globals, S20, S13, S16, S19) — STOP before the core
Per the dev's "do the normal seams AFK, stop at the hard ones": after PR #195 (S2–S11) merged, five more
byte-identical seams landed on a stack — S12-globals (apply_global_settings), S20 (ModelReaper), S13
(detection_postproc), S16 (TranslationMemory), S19 (gather_per_context). STOPPED before the high-risk
async-orchestration core (S15 stage-protocol + S17/S18/S21/S22/S23/S24/S25/S26) which the analysis flags for
E2E-per-step. Test baseline corrected to 18 async-only failures (a stale uppercase-wiring test from S2's casing
move was fixed in S13). Full suite 253 passed, 0 real failures. Stack ready to PR.

## 2026-06-09 — #187 S21 / #188: ModelLifecycle facade (first core seam; preload + ensure_running fold)
After pushing a rollback point (main + PR #196) the dev said continue, so started the core. S21: the duplicated
eager-preload block (×2, gated models_ttl==0) + the duplicated cleanup-task guard (×2) → model_lifecycle.
ModelLifecycle(reaper, prepare_fns) with preload(config, device, models_ttl) + ensure_running(); the guard's
idempotency moved into ModelReaper.ensure_started(). self._detector_cleanup_task removed (the reaper owns its
task; 0 refs left). Facade wraps the reaper; tracker(S3)+unloader(S4) stay direct (used by _run_* touch + reaper)
— absorbing them is high-churn/low-value, deferred. Byte-identical (same preload order, upscale_ratio/Colorizer.
none conditions, device threading, models_ttl==0 gate; prepare_* injected as a table → ML-free tests). Stack on
PR#196 (refactor/mit-seam-s21-model-lifecycle).
Tests: test_model_lifecycle.py 4 passed + test_model_reaper ensure_started idempotent; full suite 258 passed
(18 pre-existing async, 0 real). Remaining core = the hardest (S15/S17/S18/S22/S23/S24/S25/S26) — pausing to
report before the L6/L8/L9-touching async-orchestration seams.

## 2026-06-09 — #187 S17: TextTranslationDispatcher (collapse the duplicated chatgpt translator switch)
The hardest seam. The duplicated ChatGPT/ChatGPT2Stage handling in _dispatch_with_context (single) +
_batch_translate_texts (batch) → text_translation_dispatcher.{build_chatgpt_translator, dispatch_translate}.
Split into TWO functions because construction order is load-bearing: OpenAITranslator.__init__ can warn about
the glossary, and single constructs AFTER the context log while batch constructs BEFORE — so each caller calls
build_chatgpt_translator at its own point (order preserved) and dispatch_translate does the order-invariant
parse/set-context/log/translate. Divergences preserved & parameterised: result_path_callback (single = bound
_result_path direct-set; batch = with_context swap closure), batch_contexts wiring (on_2stage_batch_setup,
batch-only), and the context-computation placement (single unconditional incl. non-chatgpt log; batch only in
its chatgpt branch — both kept at the call sites). Only reorder: parse_args now after the silent
build_prev_context → identical observable log sequence. Stack on S21 (refactor/mit-seam-s17-text-translation-
dispatcher). Pushed for rollback.
Tests: test_text_translation_dispatcher.py 6 passed (build→openai/2stage, parse/set/translate w/wo ctx,
2stage callback+batch-setup, chatgpt-skips-batch-setup, carry/skip logs) via fake translators + sys.modules
stubs; full suite 264 passed (18 pre-existing async, 0 real). E2E PENDING — this high-risk seam wants a live
translation pass (single + batch + concurrent + chatgpt_2stage) before merge.
