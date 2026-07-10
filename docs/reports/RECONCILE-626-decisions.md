# #626 landing→main render/translation feature-merge — per-slice decisions log

Running log of the hand-merge on `integrate/render-reconcile` (off `origin/main`, merging
`origin/landing/render-phase0`). Reconciled at function granularity. Consolidated into
`docs/reports/system-impact-report.md` at the end of the merge. See `docs/RECONCILIATION-PLAN.md`.

Verification model: the 175-test characterization net imports the conflicted modules, so it can
only run green once ALL source+test markers are resolved. Per slice → AST/syntax check (no broken
code left behind); full behavioral net after slices 1–5; goldens regenerated from reconciled code
(slice 6); render + translation benchmark gates before Phase E.

## Slice 1 — flag contract (config.py + mit-config.ts) ✓
- `config.py` conflict: kept **main's superset** (`reference_layout` #178 + `knuth_plass` #180);
  landing had only `knuth_plass`. Grafted landing's render-parity note into the KP docstring.
- `mit-config.ts` hunk 1: kept main's multi-provider `translator:'chatgpt'` block (landing lacks);
  merged the concise-bubbles comment. Hunk 2: kept main's `MIT_REFERENCE_LAYOUT` mapping (landing lacks).
- **Gap fixed:** landing's `selective_flux` (#421, InpaintConfig) had NO Backend env mapping while
  every sibling inpaint flag did → it was dead. Added `MIT_SELECTIVE_FLUX` (flagEnv-gated, default
  OFF → prod-safe per VRAM landmine #3; drivable for Phase-D). `MIT` itself never read it from env.

## Slice 2 — crux `rendering/__init__.py` + `text_render.py` ✓
Method: base→main = 481 changed lines, base→landing = 264. main is the **structural superset** —
it received landing's render stack via the completed Stage-C port (#67, measured no-regress) AND
adds its own `reference_layout` machinery. So resolved the crux to **main's version wholesale**
(port-verified spine) and grafted only landing's genuine, render-affecting deltas:
- **GRAFTED — `#436` dedup refinements** (render-affecting; main lacked): equal-translation →
  blank the LARGER box; repeated free-floating onomatopoeia (same translation) → keep largest,
  blank rest. Set `render_suppressed_reason` at the blank site (cheap, aids `/patches` attribution).
- **DROPPED — landing's `bubble_fit_tall` branch.** Trace: main's `_bubble_fit_layout` already
  produces the tall-narrow column via height-bounded `bubble_fit_bounds` + monotonic re-open —
  the *general* solution to the same "tall rectangular interior" case landing special-cased by
  rerouting to `_clean_layout_dst`. Grafting it would add a competing layout mechanism. **Phase-D
  render benchmark MUST confirm no tall-interior (Otome "THIS SCUMBAG" class) regression** — if it
  regresses, revisit.
- **DEFERRED — landing's per-branch layout telemetry** (`render_branch`/`render_font_px`/
  `render_dst_box` at ~5 layout branch exits). main already has a **richer** telemetry
  (`_emit_trace` with route + full fit params, feeds #462 replay). landing's attrs feed a different
  consumer (`text_layer.py`→`/patches` payload, `patch_renderer.py`). Both consumers are
  **getattr-safe** → absence only omits diagnostic fields; render/translation byte-identical.
  Grafting 15+ lines into 5 layout branch exits of the baseline-critical file for a diagnostic-only
  benefit violates surgical/fewest-moving-parts. → **FOLLOW-UP ISSUE: unify MIT render telemetry**
  (graft the attrs OR adapt text_layer/patch_renderer to read `_emit_trace`).
- `text_render.py`: docstring-only conflict; kept HEAD (documents the `language=` param the merged
  signature `longest_token_width(font_size, text, language='en_US')` actually has).

## Slice 3 — inpaint/rescue wiring (7 files) ✓
Per-file base-diff showed a MIXED superset (not uniformly "take landing"): render_overlap/patch_geometry
→ main; patch_renderer/detection_postproc → landing; manga_translator → true two-way.
- **render_overlap.py**: main's version wholesale — superset (9 funcs landing lacks, 0 landing-unique;
  only cosmetic docstring/annotation diffs). Exports all 14 names the crux imports (verified).
- **patch_geometry.py**: **dropped main's duplicate unwired block** (protect_figure_ink /
  assemble_fullpage_erase_mask / adaptive_dilate_mask / restrict_mask_to_render_regions — main's
  "wiring in follow-up" copies) — landing's WIRED copies already auto-merged at 132-233 (verified
  identical for the 2 that matter). Prevents double-def.
- **patch_renderer.py**: kept HEAD's `exc_info=True` logging (cleaner than landing's inline
  `traceback.format_exc()`; `traceback` still used elsewhere).
- **detection_postproc.py**: H1 kept HEAD's `Quadrilateral(...,is_sfx=True)` constructor form
  (ctor accepts it); H2 dropped main's now-stale "wiring in follow-up" comment; H3 took landing's
  wired `merge_empty_balloons` (#535). Call site `stages.py:53` is gated by `det_bubble_seg`
  (`MIT_BUBBLE_SEG`, OFF by default) → VRAM landmine #3 satisfied.
- **textline_merge/__init__.py** (LANDMINE #1): main stored det_sfx provenance as
  `region.from_sfx_detection` but the crux's `display_sfx()` reads `region.is_sfx` → main's #431
  display-SFX arm was dead-by-typo. Resolved by populating BOTH attrs from the one `from_sfx` value
  (from_sfx_detection for the rescue gate at manga_translator:806; is_sfx for the crux sizing arm).
  Activating is_sfx is the intended #278 behavior (landing's baseline). Unifying to one
  `is_display_sfx_region` helper = tracked follow-up.
- **stages.py**: kept HEAD's `reference_layout=config.render.reference_layout` kwarg (crux signature
  needs it).
- **manga_translator.py** (5 hunks): H1 dropped stray blank; **H2 kept HEAD's SFX rescue** —
  provenance-gated `should_rescue_sfx(...,from_sfx_detection,...)` PLUS the det_sfx false-positive
  drop (`ocr_read_real_text`→drop) that stops garbled fragments over dialogue (protects the
  TRANSLATION gate); landing's `should_sfx_rescue` had 0 other refs. H3 **merged both import lines**
  (main's `acceptable_synth_bubble` #170/#178 + landing's `expand_balloons_with_white_boxes,
  white_box_candidates` — both have call sites). H4 kept HEAD's design NOTE. **H5 took landing's
  wired `selective_flux` (#421)** block — gated `if config.inpainter.selective_flux` (OFF by default
  via the slice-1 `MIT_SELECTIVE_FLUX` flag); deps verified (`Inpainter.flux_klein`,
  `apply_selective_flux_repair` async def, `_flux_lock`, `traceback` all present).
- **Validation:** full crux import chain (rendering + render_overlap + detection_postproc +
  patch_geometry + textline_merge) imports clean; all 14 crux imports resolve.

## Slice 4 — translators (numbered_contract + custom_openai #623 fold) ✓
- **numbered_contract.py**: took landing's TOLERANT parse (both hunks) — `_BLOCK_RE`
  `<\|\s*(\d+)\s*\|?>?` + `_STRAY_MARKER_RE` accept a malformed marker (`<|10|` / `<|10>`,
  live Otome) so it still SPLITS (no leaked marker, no index shift). Strictly more robust than
  main's `<\|(\d+)\|>` → a translation-quality improvement (protects the gate).
- **custom_openai.py**: auto-merged clean to landing's #535 version (`parse_numbered_translations`).
  **Folded #623 thinking control** (was perf-only, d05fb4dc; absent from main+landing → without it the
  integration branch would REGRESS to the qwen3 `content=None` 500 on dense pages). Added `import os`
  + `resolve_enable_thinking(env)` + `thinking_extra_body(enable_thinking)` + wired `extra_body`
  into the create call. Default **thinking OFF** (matches perf prod; avoids the 500). Ported #623's
  test `test_custom_openai_thinking.py` FIRST (RED: ImportError) → added funcs → GREEN (5 thinking +
  4 parse = 9 passed).
- **OPEN (translation gate, Phase D):** #623 default thinking-OFF vs thinking-ON-with-raised-max_tokens
  must be A/B benchmarked on the One-Punch page before Phase E — the flag stays configurable; do not
  silently ship thinking-off as the final quality trade without the benchmark.

## Slice 5 — 7 test files reconciled to source ✓
Rule: each test matches its reconciled SOURCE side; where both sides added tests at one append
point, verified they were overlapping-name (take superset) not complementary.
- **test_render_overlap.py**: HEAD (main superset — tests processing_scale/font_bounds/display_sfx/
  bubble_fit_bounds/etc.; landing's 8 unique tests were redundant coverage of shared funcs).
- **test_ocr_vlm.py**: HEAD (main superset — should_rescue_sfx/ocr_read_real_text provenance rescue).
- **test_numbered_contract.py**: landing (HEAD empty; tolerant-parse tests match landing source).
- **test_stages.py**: HEAD both hunks (assertions expect `reference_layout` in kwargs — matches source).
- **test_patch_geometry.py**: HEAD (superset, +5 tests; net verifies against landing's wired bodies).
- **test_detection_postproc.py**: landing all 3 hunks (HEAD empty/shorter; landing adds `_ink_map`
  stub + fuller comments the 18 shared tests need).
- **test_resize_regions_characterization.py** (CRUX NET): MERGED — HEAD's env-aware golden infra
  (sys/PIL.features/golden_verdict/freetype+platform gating, #541/#503) + landing's unique
  `test_resize_regions_thai_byte_identical` (#499 EN→TH hot path).
- **Goldens**: removed the 3 conflicted binaries; regenerated from RECONCILED code (never accept a
  side). Net: **193 passed, 0 skipped** (first run saved goldens as `sss`, second asserts green).
  4 goldens now: bubble_fit/clean_layout/legacy + new `resize_regions_thai.npz`. Green = source
  coherent + deterministic; render QUALITY vs baseline = Phase-D GPU benchmark (pending).

## Phase D + PIVOT (2026-07-10) — render == baseline, per dev hard constraint
Render gate (deterministic CPU dump-replay, Gal Yome EN→TH) first showed reconciled (main render
spine) differed **3.96%** from landing baseline — filled balloons larger. Dev constraint:
**"คุณภาพต้องเหมือน baseline เท่านั้น"** → **baseline is authority for all quality**.
- **PIVOTED render-geometry subsystem to landing's exact code**: rendering/__init__.py, render_overlap.py,
  rendering/text_render.py, patch_geometry.py, patch_renderer.py, text_layer.py, stages.py + their
  render tests + goldens regenerated from landing. Render A/B now **0.0000% diff (byte-identical)**.
- **Consequence:** main's render campaign (reference_layout #178 / KP #180 / width-squeeze #183) is
  NOT in the default output — shelved. Inert leftovers: config `reference_layout` field +
  MIT_REFERENCE_LAYOUT mapping (do nothing), orphaned reference_layout.py / render_replay.py /
  sizing_trace.py. These can be cleaned up (follow-up).
- **Kept from main (non-render):** translators + #623 thinking fold, tolerant numbered-parse,
  Backend/Frontend, config additions, CI-infra (#359 lazy-import / ADR 029), textline_merge is_sfx.
- **Bonus:** landing's crux sets `render_branch`/`render_font_px`/`render_dst_box` natively → the
  deferred telemetry gap (#628) is resolved for the render path (landing already wired it).
- Net: **159 passed** (landing render suite is smaller than main's superset; all green).
- **Translation gate** (#623 A/B + detect/ocr text == baseline) still needs a GPU translate run.

## Translation gate — BLOCKED by external LLM gateway (2026-07-10)
Attempted the #623 live A/B (thinking OFF vs ON on a dense JPN→ENG request) via the remote LLM
(`gateway.9arm.co`, `qwen3.6-35b-a3b` — no local GPU needed; the translator LLM is API-based per
`project_mit_qwen_via_api`). **The gateway returns EMPTY content (finish=stop, completion_tokens=1)
for EVERY request — even "Say the single word: HELLO"** — regardless of the thinking flag. This is an
external gateway/model-serving outage, not code and not the #623 thinking behavior (thinking would
emit reasoning tokens; completion=1 = just EOS). Confirmed on 2 samples.
- **#623 logic is unit-verified** (`test_custom_openai_thinking.py`, 5 green: default OFF, env toggles,
  extra_body shape). The LIVE text-quality A/B is deferred until the gateway serves again.
- Harness ready: `MIT/tools/_thinking_ab.py` (re-run when the gateway is up).
- **#623 default = thinking OFF** is the safe ship (matches perf prod, which works; avoids the
  content=None 500). Flip via `CUSTOM_OPENAI_ENABLE_THINKING=true` for the A/B when live.

## Translation gate — RESOLVED: thinking-off == baseline quality (2026-07-10, gateway recovered)
Gateway `gateway.9arm.co` recovered enough to run the #623 A/B. Same 6 dense JPN→ENG segments,
thinking OFF vs ON: **both 6/6, 0 empty, equivalent quality** (minor wording only; ON marginally
better on [3] "one punch"). completion_tokens LOW both ways → #623 budget-exhaustion did NOT trigger.
**Gate PASS: thinking-off does NOT regress vs baseline** (disproves "thinking-off felt worse"). #623
stays configurable, default OFF = dense-safe. PNG+MD: docs/reports/benchmarks/2026-07-10-626-translation-thinking-ab.*.
CAVEAT: gateway is FLAKY — intermittent empty content (completion=1) on the complex numbered prompt,
affecting BOTH thinking modes equally = infra reliability issue (not a thinking-off regression, not
blocking; watch in prod). Harness MIT/tools/_thinking_ab.py.

## Scrutinize (pre-Phase-E) — 2026-07-10
Verdict: **SHIP** (dev-gated merge to main). Key checks:
- **Render == baseline PROVEN for ALL inputs:** all 7 render-geometry files (rendering/__init__.py,
  render_overlap, text_render, patch_geometry, patch_renderer, text_layer, stages) + their tests +
  goldens are **byte-identical to `origin/landing`** (`git diff origin/landing HEAD` empty). The
  0.0000% dump-replay A/B was a spot-check; the identical CODE is the real proof — every render path
  (dialogue/SFX/narration/vertical/clean-layout) matches baseline, not just the sampled Gal Yome page.
- **Non-render seam intact:** #623 thinking present in custom_openai; textline_merge sets `is_sfx`
  (feeds landing render's display-SFX path); `MIT_SELECTIVE_FLUX` backend mapping present. Net 159 green.
- **Residual risk (covered):** main detection/OCR feeding landing render — the unit net covers the
  interfaces (standard region attrs: translation/is_sfx/bubble_box/xyxy). A full E2E translate is the
  final confirmation (gateway-flaky; #623 A/B passed when it responded).
- **Tracked debt not blocking:** #628 (telemetry), #629 (is_sfx helper), #630 (shelved render-campaign
  code removal). Branch/git tech-debt cleaned (#627 closed).

## Formal /scrutinize + clink-brainstorm (2026-07-11)
Ran the full scrutinize workflow (Intent→Trace→Verify→Report) + a multi-agent pass (codex codereviewer
returned; antigravity timed out at 313s). Verdict: **FIX-THEN-SHIP** (fixes were doc/comment-level; no code bug).
- **MAJOR (scope correction):** "render == baseline byte-identical" is exact for the RENDER STAGE given
  identical regions (proven: 7 render files byte-identical + dump-replay 0%). It does NOT prove full-page
  equivalence — the UPSTREAM (detection/OCR/rescue/filter) is main's, not landing's, so a real translate
  may differ from the landing baseline page. By design (keeps main #278/#623/#359); the E2E translate
  closes this (gateway-pending). Documented in ADR 030 §Scope. DEV to confirm main-upstream is acceptable
  vs "baseline for ALL quality".
- **MEDIUM (codex, confirmed):** landing render uses `sfx_rescued` only, never `is_sfx`; a det_sfx region
  not VLM-rescued lays out as normal text (landing's baseline behavior — correct for the constraint, a
  change from main's `display_sfx`). `region.is_sfx` is inert in the live path (only the un-wired
  `sfx_merge.should_sfx_rescue` reads it). FIXED the misleading comment in textline_merge; unify tracked #629.
- **VERIFIED OK (codex + trace):** `_run_text_rendering → stages.run_text_rendering → rendering.dispatch`
  signature-compatible (stages passes exactly the knobs landing's dispatch accepts); #623 thinking wired
  right (default OFF, extra_body only when disabled); landing render pkg exports all main-imported symbols
  (ballon_extractor, dispatch, dispatch_eng_render); `sfx_rescued` survives translate via restore_sfx_translations.
- **NOT verified (external):** full E2E translate (gateway flaky) — the only thing that closes the MAJOR scope gap.
