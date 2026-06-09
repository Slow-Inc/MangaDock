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
