# MIT Master Plan 2 — toward human-level translation quality

> Status: planning document (round 2). Branch context: `perf/mit-layout-fit-and-merge` / worktree `feat-mit-font-s1`.
> Supersedes the round-1 scope of `docs/prd/mit-render-defect-master-plan.md` (render-defect campaign). Round 1 largely closed the *render* axis; round 2 widens scope to the whole pipeline (detection → OCR → translation → layout → render → inpaint) with the explicit target of **human-level translation quality**, not just non-broken rendering.

---

## 1. Vision & goal

**Vision.** A reader opening a MangaDock-translated chapter should not be able to tell, at a glance, that a machine typeset it. Names, honorifics, and terminology stay consistent across the whole chapter; every bubble is legible and filled the way a human typesetter would fill it; no original text is silently dropped, shrunk to invisibility, or spilled past a curved balloon edge; SFX and display text are translated, not left as raw Japanese.

**What "human-level" decomposes into (the five quality axes):**

1. **Nothing lost** — every source glyph becomes a translated, legible glyph. No sub-legible shrink, no dropped region, no untranslated SFX/display class.
2. **Consistent** — names/honorifics/pronouns/terminology are stable across pages of a chapter (cross-page context is alive).
3. **Well-typeset** — font size fills the bubble safe-area (mask-aware, not source-box fit-shrink); text is bounded by the true bubble polygon, not a rectangle; line breaks are neat and never split a word/name mid-token.
4. **Accurate** — the LLM output is faithful (no garble/hallucinated tokens, no un-localized romaji shouts), and reproducible (determinism gate honored).
5. **Clean plate** — erase/inpaint is at full tuned resolution (no downscale blur/halo).

**What "done" means (the gate, per `feedback_definition_of_done` + the benchmark rules in §6).** A cluster is *not* done when tests are green or output "looks better." It is done only when:

- a **deterministic** benchmark (offline replay, no non-deterministic translator) is **bound to the specific md defect**, showing `before = symptom present` → `after = symptom gone` on named fixtures;
- a committed MD report lives at `docs/reports/benchmarks/<date>-<cluster>.md` with a numeric before→after table **and** an embedded full-res comparison image;
- no protected-target regression (Thai Gal-Yome + EN One-Punch golden envelopes still pass);
- an ADR + system-impact-report entry is written for any quality/perf-affecting change;
- the developer is notified and, for render-visible changes, sends the rendered result for user confirmation (user-in-the-loop).

---

## 2. What round 1 delivered + what carried over

### 2.1 Delivered in round 1 (render campaign)

- **Both-axis oversize / clipped-spill fixed** (hotfix `df30e25e`, ADR 023/024): free-text/narration font can no longer grow past cap and spill art on both axes.
- **Under-fill diagnosed as a benchmark artifact, not code** — dialogue under-filling a big balloon was the untagged `/image` endpoint (`has_bubble=False` for every region because only `translate_patches` calls `_tag_regions_with_bubbles`). On the `/patches` path dialogue fills bubbles. This produced the single biggest process rule (see §6).
- **`reference_layout` engine ported** as a ~200 LOC pure module (safe-box → binary-search-from-cap → both-axis fit → mask-squeeze ×0.90 ≤3× → fail-loud), corpus-validated, wired end-to-end **behind a flag, OFF by default**, byte-identical golden preserved.
- **Deterministic replay harness** (`MIT/manga_translator/render_replay.py` + `MIT/test/test_render_replay.py`, #462): dump region state once, replay font-sizing offline with no translator non-determinism.
- **`fills_bubble_width` discriminator** corpus-validated: `interior_w/det_w = 1.4` threshold cleanly separates fills (1.07–1.20) from narrow (1.61–3.43), nothing in the [1.20, 1.60] margin (17 regions / 4 fixtures).
- **SFX/OSB pipeline built** (AnimeText YOLO detect → OCR-VLM rescue/sanitize → OSB contrast-outline render) but shipped **opt-in / AFK-gated**, not production default.
- **Render parity vs reference** moved ~40–50% → ~90–95% on the fixed-page A/B scorecard.
- **`safe_area.py`** ported the distance-transform + pole-of-inaccessibility anchor.

### 2.2 Carried over from plan 1 (the reason round 2 exists)

Round 1's own §7j conclusion: *render is substantially met; the remaining real quality defects are translation (LLM garble, untranslated shouts, romaji), detection (SFX), and — newly surfaced 2026-07-03 — two render defects the deterministic metric could not see.* Specifically carried forward:

- **The #1 unshipped fix: readable-floor** — minimum-legible font with slight-overflow / word-squeeze fallback for narrow columns. Not yet implemented.
- **Fill/spill must be bounded by the true bubble mask/polygon, not the interior bounding box** — needed for oval bubbles; the harness metric (`overflow_vs_det_w`) measures spill vs the *detection box*, a **known blind spot** (2026-07-03) that missed both Thai oval over-fill and tall-narrow text-loss.
- **`reference_layout` promotion to default** — pending corpus-growth, the polygon metric, and Knuth-Plass wiring.
- **Techniques ported-but-off**: Knuth-Plass line-break (#180/#186), real vertical layout (`calc_vertical()` is dead code, #182), AnimeText SFX as default (#168).
- **Two zero-code config wins** recovering the biggest default-mode losses: `MIT_DETECTION_SIZE=2560`, `MIT_INPAINTING_SIZE=2048`.
- **Cross-page rolling context** built (`server/rolling_context.py` + `batch_runner.py`, ADR 010) but **default-off** — an operator decision never taken.
- **Deliberately out of scope** (VRAM-constrained, intentional per memory): SAM2/3 segmentation, Flux inpaint (kept LaMa). These remain the largest gap vs the ~22-model upstream stack but are **not** round-2 targets.

---

## 3. Unified defect inventory

Severity: critical / high / medium / low. Frequency is the observed recurrence. Cluster maps each defect to its workstream (§4).

| # | Defect | Domain | Sev | Frequency | Cluster | Status |
|---|--------|--------|-----|-----------|---------|--------|
| 1 | Narrow/small-bubble text shrinks below a readable floor (reads as text-loss) | render | **critical** | 5/10 pages (ds4, ds11, ds20, m2-1cc, m4-ce4); verified NOT a pipeline drop | readable-floor | open |
| 2 | Font floor derived from the small crop, not the page (~3-4px vs ~16px) → unreadable fallback | render | high | fallback path (vertical / occupancy>1 / no balloon / SFX) | readable-floor | open |
| 3 | Cross-page rolling context dead in prod patch path → name/honorific/pronoun/terminology drift | translation | **critical** | every page (reset_page_context per page) | translation-context | open |
| 4 | Font sizing is fit-shrink into source textline box, not binary-search to fill bubble mask safe-area | layout | high | corpus-wide | mask-aware-sizing | not-started |
| 5 | `reference_layout` ported+validated but flag OFF → prod still ships ~3.0x oversize narration | layout | high | every narration/display region on default path | mask-aware-sizing | partially-fixed |
| 6 | Clipped/overflow + both-axis oversize (spills art) | render | **critical** | was on free-text/narration | mask-aware-sizing | **fixed** (df30e25e) |
| 7 | Under-fill: dialogue small inside a big balloon | render | high | artifact of untagged `/image` endpoint | mask-aware-sizing | **fixed** (was #2 endpoint) |
| 8 | UI-strip bloat + `fills_bubble_width` discriminator & SFX-bound residuals | layout | medium | #430 hotfix follow-ons; Thai over-fill/tall-narrow | mask-aware-sizing | open |
| 9 | Balloon safe-interior box + anchor misfires on conjoined/irregular balloons | layout | medium | conjoined/narrow-neck balloons | mask-aware-sizing | open |
| 10 | `fit_to_box` 24px upward-rescan window heuristic can miss a fit or fail to tiny floor | layout | medium | word-wrap non-monotonic cases | mask-aware-sizing | open |
| 11 | `reference_layout` fills interior BOX not polygon → rectangular block spills oval edge | layout | high | oval/curved bubbles (user-caught live 2026-07-03) | bubble-polygon-fill | open |
| 12 | Harness blind spot: spill measured vs detection box, not polygon → 'fill=good' while text overflows/loses | other | high | root cause the metric missed oval over-fill + text-loss | bubble-polygon-fill | open |
| 13 | `detection_size` overridden to 2048 (< tuned 2560) → ~36% fewer px, small/faint JP untranslated | detection | high | every page with small/faint glyphs | config-defaults | open |
| 14 | `inpainting_size` overridden to 1536 (< tuned 2048) → blurry erase / screentone halos | render | medium | >1536px pages; erase fidelity only | config-defaults | open |
| 15 | SFX/OSB detect+render opt-in only (AFK-gated) → display text/onomatopoeia untranslated by default | detection | high | 3/10+ pages (ゴゴゴ, ヴィ, ペ ガ, カ) | sfx-osb | partially-fixed |
| 16 | Phantom/duplicate SFX + second-pass merge & IoA-dedup robustness | detection | medium | SFX second-pass edge cases | sfx-osb | open |
| 17 | OCR-VLM SFX rescue/localize/sanitize gate quality (garbled/romaji SFX) | ocr | medium | stylized SFX glyphs | sfx-osb | open |
| 18 | LLM garble / hallucinated tokens laid out faithfully (JDB→งาน, '3','<', truncated) | translation | medium | ds4/ds18/m5; render is correct — this is LLM | llm-translation-quality | open |
| 19 | Untranslated/unlocalized leftovers: romaji names, shouts left as-is (WHA-!?, NO!, Toujou Fuyuki) | translation | low | scattered | llm-translation-quality | open |
| 20 | Few-shot in-context example lost for exotic target subtags (dict lookup returns [] on miss) | translation | low | not triggered in prod (THA/ENG only) | llm-translation-quality | open |
| 21 | Translator non-determinism (OCR-VLM/LLM sampling) → text+length vary run-to-run | translation | medium | every re-run | llm-translation-quality | open |
| 22 | Mid-word/name split at wrap; column narrower than word (กินข้/าว, คุณฟ/ยุกิ, BUSINE-SS) | render | medium | ds4/ds12/ds25/m5 | line-break-wrap | open |
| 23 | Knuth-Plass optimal line-breaking not wired to default render (greedy still default) | layout | medium | all multi-line wraps | line-break-wrap | planned |
| 24 | Multi-lobe bubble mis-sizing + overlap between adjacent regions | layout | medium | multi-lobe / adjacent bubbles | geometry-overlap | not-started |
| 25 | Region drop / empty bubble (patch occlusion) — text-missing checklist #1 | layout | high | NOT deterministically re-verified; audits showed no loss | geometry-overlap | open |
| 26 | Textline→region over/under-merge drives bad downstream routing (occupancy>1 shared-fit) | detection | medium | over-merge → shared-footprint fit | geometry-overlap | open |
| 27 | No real vertical CJK/Latin layout; `calc_vertical()` is dead code in patch path | layout | medium | all vertical dialogue | vertical-text | open |
| 28 | 48px CNN OCR weaker than LLM-vision / manga-ocr on stylized/handwritten/low-contrast | ocr | medium | stylized/faint text; model-class gap not a regression | ocr-model | open |
| 29 | Inpaint fade / pixelation / ghost seams (LaMa) — erase-plate artifacts | other | medium | screentone/dense regions; out of render scope | inpaint-quality | not-started |

**Read of the inventory:** 2 critical open (1, 3), 6 high open (2, 11, 12, 13, 15, 25), the biggest render defect (6) already fixed, and the single densest fix site (mask-aware-sizing, 7 defects) mostly reduces to *promoting code that already exists*. The two highest-leverage items are a font-floor constant and an env flag — not new algorithms.

---

## 4. Clusters, ranked by priority

Each cluster below carries: recommended fix approach, effort, a **deterministic fixture + test that proves the defect gone**, and issue mapping. Every render/layout cluster's benchmark obeys §6.

---

### Priority 1 — `readable-floor` (defects 1, 2) · **critical**

**Why first.** Text shrinking to ~3–4px is the single worst blocker of human-level readability: the output *silently loses information*. Verified on 5/10 pages, deterministically confirmed **not** a pipeline drop. Both named defects are one bug from two angles — the floor is derived from the small crop (`img.shape` ≈ 700px perimeter → ~3-4px) instead of the page (~2600px → ~13px), and because the floor is tiny the binary searches shrink narrow columns down to it.

**Recommended — Approach A: page-derived readable floor + absolute legibility constant, riding the existing fail-loud floors.** The "return the floor when nothing fits (slight overflow beats invisible text)" behavior *already exists* in `font_fit.py:44` and `reference_layout.py:44`. Make the floor a genuine page-derived value and that existing path renders legible slight-overflow text with **no new fallback machinery**:

- At `rendering/__init__.py:387-388`, compute the `-1` auto floor from `page_shape` when threaded (fall back to `img.shape`): `_fs = page_shape or img.shape; font_size_minimum = round((_fs[0]+_fs[1])/200)`, then clamp up: `font_size_minimum = max(font_size_minimum, MIN_LEGIBLE_PX)` (~11).
- Extract a pure `readable_floor(page_h, page_w)` helper into `render_overlap.py` (alongside `processing_scale`) so it is unit-testable.
- No change to the fit cores. `squeeze_width` (`render_overlap.py:87`) already narrows the column (more lines) first in the bubble-fit path. `font_size_minimum` is computed once at the top of `resize_regions_to_font_size` and threaded to **all 5 routes** — single source, one fix.
- Approaches B (squeeze-then-condense-then-overflow in the fit core) and C (page floor + bounded overflow budget) add machinery; **layer them only if the benchmark shows the raised floor spills past the polygon beyond tolerance.**

**Effort:** S — ~10-20 LOC + one constant + one helper + harness extension + benchmark. ~half a day. No new deps/knobs.

**Fixture + test (deterministic, offline, no translator):** extend `render_replay.py` + `test_render_replay.py`.
1. **Reproduce:** parametrize `replay_clean_layout` to take a per-region **crop** `img_shape` separate from `page_shape`, and pass `font_size_minimum=-1`, mirroring the production patch path (today `render_replay.py:66` wrongly feeds the page shape and line 48 hardcodes `fs_min=8`, so the bug is invisible to the harness). Fixtures: the 5 recurring pages (`thai-gy-ds4-layout.json` exists; add ds11/ds20/m2-1cc/m4-ce4). Assert **before**: min `final_fs` ≈ 3-4px. Assert **after**: every region `final_fs >= readable_floor(page)` (~11-13px) and `readability_ratio` (already emitted at `render_replay.py:99`) `>= floor`.
2. **Bound the tradeoff (also closes the priority-4 blind spot):** add `spill_fraction_vs_polygon` — rasterize the region's `bubble_polygon` (already in fixtures) and compute the fraction of the sized block outside it. Corpus golden asserts `spill_fraction_vs_polygon <= ~0.15`.
3. **Committed report:** `docs/reports/benchmarks/<date>-readable-floor.md` — before→after `final_fs`/`readability_ratio`/`spill` table + embedded rendered comparison (readable vs 3px), asserting no regression on existing spill guards (`_SPILL_CEILING=1.35` still passes).

**Issue:** new focused "readable-floor" issue; cross-link #430/#462 and the #178 reference_layout work — do not fold in.

---

### Priority 2 — `translation-context` (defect 3) · **critical**

**Why.** Consistency of names/honorifics/pronouns/terminology across a chapter is core to human-level translation. Upstream joins all batch pages into one numbered prompt; we throw the carried context away each page. Structural, affects every page, distinct fix site from render.

**Recommended — Approach 1: enable the existing per-batch `RollingContext` (env + docs + comment fix). No code resurrection.** The rolling-context engine (`server/rolling_context.py` + `batch_runner.py`, threaded via `config.translator.prev_context → config_gpt.chat_system_template` for every GPT-family translator) is **complete and unit-tested**; ADR 010 records it ships default-off and enabling it is an operator decision. Production `MitBatchStream` always uses webhook mode → `run_batch_with_callbacks → RollingContext`, submitting all uncached chapter pages in one batch — so flipping the knob gives whole-chapter continuity with zero new plumbing.

- (a) Set `MIT_CONTEXT_PAGES=3` and `MIT_CONTEXT_MAX_CHARS=1500` in the prod MIT worker env and document both in `MIT/.env.example` (currently undocumented — the reason it was never turned on).
- (b) Correct the misleading `buildMitConfig` comment: context is carried via the worker's `MIT_CONTEXT_PAGES` + `RollingContext`, **not** via a `buildMitConfig`-emitted `context_size`; `reset_page_context`/`context_size` are the deliberate **L9 cross-job bleed boundary** (`manga_translator.py:1485`, ADR 010, prevents #136). Link ADR 010.
- (c) Prefer keep-default-off + explicit prod env (honors ADR 010's byte-identical contract).
- **Do NOT** resurrect the in-worker `context_size`/`TranslationMemory` (the inventory's literal touch_point) — the worker is a process-lifetime singleton; accumulating across page requests reintroduces the **#136 cross-job bleed** ADR 010 exists to prevent. Explicitly rejected.

**Effort:** S — mostly env/config + docs + one defect-tying test; mechanism exists and is tested.

**Fixture + test (deterministic, no ML — harness mostly exists):**
1. Reuse `test_batch_runner.py::test_rolling_context_seeds_the_next_page_with_prior_page_translations` (ON → page 2 carries page 1's `dst` as a numbered `<|1|>` block) and `test_rolling_context_off_by_default_keeps_the_call_byte_identical` (OFF → no `prev_context`).
2. **Add the defect-tying prompt-layer assertion** (extend `test_prev_context_prompt.py`): feed `config.translator.prev_context` a rendered block and assert it lands in `config_gpt.chat_system_template` for a GPT-family translator — proving carried context reaches the actual LLM system prompt, not just a loop var.
3. **Add a 3-page fixture benchmark:** page 1 establishes a name+honorific (dst 'Ichiro'/'Onii-chan'); stub `_translate_page` to echo the `prev_context` received; assert knob-OFF → pages 2/3 contain **no** prior-name block (symptom present), knob-ON → they contain page 1's exact name lines (symptom gone). Binds benchmark→defect deterministically, sidestepping translator non-determinism. Report to `docs/reports/benchmarks/`.
- **Note:** the polygon-spill metric is **not** applicable here — this is a translation-prompt/text-consistency defect, not geometry. Optional confirmatory-only E2E: one chapter translate, knob on, eyeball a repeated name renders identically across pages.

**Issue:** new (ADR-010 follow-up + #159 production enablement; **not** a code-resurrection of `context_size`).

---

### Priority 3 — `mask-aware-sizing` (defects 4, 5, 6✓, 7✓, 8, 9, 10) · high · densest site

**Why.** The single biggest visual-fidelity gap (#166/#178/#430), corpus-wide, 7 deduped defects sharing `rendering/__init__.py:resize_regions_to_font_size` + `reference_layout.py:fit_to_box` + `safe_area.py:safe_area_box`. The both-axis hotfix (defect 6) landed; under-fill (defect 7) was a benchmark artifact. The remaining leverage is **promoting code that already exists**: `grep` proves there is **NO Backend `MIT_REFERENCE_LAYOUT` knob**, so `config.render.reference_layout` is permanently `False` in production — that *is* the literal "flag OFF → still ships ~3.0x oversize."

**Recommended — Approach A: promote the proven engine to default + make the polygon gate honest.** Don't rebuild what works:
- Add `MIT_REFERENCE_LAYOUT` to `Backend/src/books/mit-config.ts` (emit `reference_layout:true`, requiring `clean_layout` + `bubble_area_fit` like sibling knobs); set it in `Backend/.env`.
- Extend `render_replay.py` with `spill_vs_polygon` (rasterize the already-captured `bubble_polygon`); re-point the existing `@slow test_reference_layout_safety_envelope_over_corpus` at `spill_vs_polygon`. **Green corpus = promote.** No change to `fit_to_box`/`safe_area`.
- Approaches B (root-fix the fit primitives — polygon-aware `safe_area_box`, line-height-derived rescan window) and C (collapse the 5 sizing routes into one mask-aware fit) are deferred: B touches a search the corpus already passes; C is #187/#188 decomposition territory with wholesale byte-identical breakage. **The polygon blind spot is the one genuine gate on promotion (priority 4), and it is a ~15-line harness metric, not a `safe_area` rewrite.**

**Effort:** M — ~1 Backend knob + 1 harness metric + env + benchmark; no new sizing algorithm.

**Fixture + test (deterministic offline replay over committed corpus):**
1. Extend harness: rasterize serialized `bubble_polygon` → mask; add `spill_vs_polygon` (fraction of rendered block rect outside polygon; fall back to `overflow_vs_det_w` where no polygon).
2. One-Punch narration (`test/fixtures/onepunch-layout.json`): OFF → `overflow_vs_det_w ≈ 2.3-3.0` AND `spill_vs_polygon > 0` (symptom); ON → `overflow_vs_det_w ≤ ~1.0` AND `spill_vs_polygon ≈ 0` (gone).
3. Under-fill guard: `thai-galyome-layout.json` dialogue still fills (`final_fs ≥ 24`).
4. Fit-miss guard: `readability_ratio ≥ 0.6` floor on non-fill regions.
5. **Promotion gate:** `@slow test_reference_layout_safety_envelope_over_corpus` re-pointed at `spill_vs_polygon` must be green across **all** `*-layout.json` before the Backend flip.
6. Report: `docs/reports/benchmarks/<date>-reference-layout-default.md` with before→after ratio table + committed OFF-vs-ON comparison image of the One-Punch narration box.

**Issue:** #178 (+#166/#179/#430 umbrella; new Backend-wiring sub-issue).

---

### Priority 4 — `bubble-polygon-fill` (defects 11, 12) · high · **de-risk gate for priority 3**

**Why.** High severity **and** the hard gate on promoting `reference_layout`. The box-vs-polygon shortcut is the root cause the deterministic metric **missed** both the oval over-fill and the text-loss cases — so it compromises verification integrity, not just rendering. This cluster must land its metric before priority 3 flips the default (see §5).

**Recommended — Approach A: corner-inscribe the safe box (proportional anchor shrink) + polygon-spill harness metric.**
- `safe_area.py`: after computing ray half-extents `rx=min(left,right)`, `ry=min(up,down)`, binary-search the largest `t ∈ (0,1]` such that all 4 corners `(ax±t·rx, ay±t·ry)` are inside the mask; return the shrunk box. Rectangular/rounded-rect bubbles keep `t=1` (no-op); only round/oval bubbles shrink, yielding the inscribed axis-aligned rectangle at the bubble's aspect, centered on the existing reading anchor.
- `render_replay.py`: capture the anchor from `_reference_layout_intent`, rasterize `bubble_polygon`, place the `block_w×block_h` rect at the anchor, emit `spill_frac_poly = (block pixels outside mask)/(block pixels)`. Corpus ceiling `spill_frac_poly ≈ 0`.
- Approach B (uniform ×0.8 safety factor) is rejected — over-shrinks rectangular bubbles (regresses priority 3), doesn't operate on the true polygon. Approach C (exact largest-inscribed rectangle via O(H·W) DP) is overkill and can pick an off-center strip that fights the anchor `render()` depends on.
- **Self-limiting:** box-like bubbles no-op, so it cannot regress the demoted-narrow-column/fill cases priority 3 depends on; only spilling ovals are corrected.

**Effort:** S–M — ~20 LOC in `safe_area.py` + ~15 LOC metric in `render_replay.py` + tests + report/image. ~half a day.

**Fixture + test (deterministic, offline, no ML):**
1. Add `spill_frac_poly` to `replay_clean_layout` (rasterize `bubble_polygon`, center block at reference anchor, fraction outside mask).
2. Symptom-bound test on a round/oval fixture bubble: **before** `spill_frac_poly > 0` (corners past the oval — the exact md defect), **after** `≈ 0` (gone).
3. Extend `test_reference_layout_safety_envelope_over_corpus` with a `spill_frac_poly` ceiling (~0.0) — the metric now gates the true polygon, not `det_w`.
4. No-regression: `thai final_fs ≥ 24`, `readability_floor 0.6`, `overflow_vs_det_w ≤ 1.35` all stay green.
5. Report: `docs/reports/benchmarks/<date>-bubble-polygon-fill.{md,png}` — before/after image drawing the fit box over the rasterized polygon + numeric `spill_frac_poly` before→after table.

**Issue:** new (promotion-gate sub-issue of #178/#462; blocks priority-3 `reference_layout` default).

---

### Priority 5 — `config-defaults` (defects 13, 14) · high leverage, zero code

**Why.** Two env fixes recover the biggest default-mode losses — the Backend was pushing values **below** MIT's own tuned defaults. `detection_size` directly causes untranslated original text (human-level blocker); highest effort-to-impact ratio in the inventory. **The code fix already landed** (PR #252, commit `d6fca527`, present on this branch): config-building moved to `Backend/src/books/mit-config.ts` (`:234` `detection_size` default 2560, `:264` `inpainting_size` default 2048), env-overridable, triple unit-locked in `books-mit-config.spec.ts`. The stale touch_point (`books.service.ts:640/667`) no longer exists.

**Recommended — Approach A: verify-and-close. No production code change.** Confirm defaults unchanged and unit-locked, confirm no lower `Backend/.env` override in the deployed config, run the stage-isolated offline benchmark tying each metric to its defect, write the report. Optional Approach B (loud startup **warning** — not a hard clamp — when sizes are below tuned defaults) is defense-in-depth for the VRAM-tight dev box; Approach C (single-source in `config.py`) is rejected (removes per-host override, and the sizes fold into `renderConfigHash` — dropping them busts patch caches).

**Effort:** S — no prod code; ~1 offline benchmark script + 2 committed fixture pages + MD report.

**Fixture + test (two offline, stage-isolated, in-process runs — deterministic; no LLM/OCR-VLM sampling in either stage):**
1. **Detection:** run detection stage only on a fixed small/faint-JP page at `detection_size=2048` vs `2560`; metric = DBNet textline region count + total text-mask pixel area. Assert 2560 recovers the specific small-glyph region(s) 2048 drops (`region_count_2560 > region_count_2048`, target faint line's mask non-empty only at 2560). Proves "small/faint glyphs never become textlines → JP untranslated" is gone.
2. **Inpaint:** run inpaint stage only on a fixed page+mask with a screentone-background bubble at `inpainting_size=1536` vs `2048` (LaMa deterministic at fixed bf16+size); metric = Laplacian-variance sharpness inside the erase mask + edge-energy of the mask-boundary ring. Assert 2048 has higher interior sharpness + lower boundary edge-energy (less halo).
3. Before/after MD report with embedded crops to `docs/reports/benchmarks/`, tying each metric to its defect line. **Snapshot the running MIT config in the report** (the benchmark asserts the *default*, not the deployed env — a stale `.env` on the VRAM-tight box could silently re-regress).

**Issue:** #247 (code fix already merged via PR #252; this is verify-and-close only).

---

### Priority 6 — `sfx-osb` (defects 15, 16, 17) · high

**Why.** An entire class of text (SFX/onomatopoeia/large display) is untranslated on the default path — the pipeline shipped behind an AFK-gated opt-in knob (#168/#169) and display-text fidelity is incomplete. 3/10+ pages recurring (ゴゴゴ, ヴィ, ペ ガ, カ). Spans 3 files but one coherent workstream: `det_sfx`/`detection_postproc.merge_sfx_detections` (AnimeText YOLO) → `ocr_vlm` rescue/sanitize → OSB contrast-outline render gating in `resize_regions_to_font_size`.

**Recommended approach.** Promote SFX detection+render to production default behind a Backend knob (mirroring priority-3's promotion pattern), gated on: (a) `merge_sfx_detections` dedup robustness — the `dedup_sfx_boxes` IoA threshold and provenance flag (#278/#3) must not emit phantom/duplicate SFX; (b) the OCR-VLM rescue/sanitize gate (`should_rescue_sfx`, `vlm_localize_sfx`, `sanitize_sfx`, `restore_sfx_translations`) producing clean reads (no garbled/romaji). Keep the OSB two-tier bounds (10–64) and 3px contrast-outline render. This is a promotion + hardening, not a new detector.

**Effort:** M — Backend knob + env + dedup/sanitize hardening + benchmark. Larger than the render clusters because it spans detect→OCR→render and needs the AnimeText YOLO model available on the prod worker.

**Fixture + test (deterministic offline, stage-isolated where possible):** capture fixtures for the 3+ recurring SFX pages. (1) Detection stage: assert AnimeText YOLO produces textlines for the named SFX glyphs (ゴゴゴ etc.) that the default path currently drops (before=0 SFX regions, after=N). (2) Dedup: assert `merge_sfx_detections` on a synthetic double-detection emits one box, not phantom duplicates (IoA-dedup unit test). (3) `sanitize_sfx` unit test on known garbled/romaji reads → clean output. (4) Render: replay-harness OSB region renders with contrast outline within bounds, no spill (reuse `spill_vs_polygon`). (5) Report `docs/reports/benchmarks/<date>-sfx-osb.md` with before/after page image showing translated SFX. **Note the OCR-VLM rescue is a non-deterministic stage** — pin/stub it for the deterministic gate; live VLM reads are confirmatory-only.

**Issue:** #168/#169 (+#172 render, #278/#3 dedup); new production-default promotion sub-issue.

---

### Priority 7 — `llm-translation-quality` (defects 18, 19, 20, 21) · medium

**Why.** The render-looked-broken defects were re-classified as faithful layout of bad LLM text (§7j: 'JDB' was an LLM garbage token, not render). Fixing garble/romaji/shouts and lowering temperature toward the numbered-contract raises accuracy; non-determinism (21) also **blocks reliable render A/B and fixture replay**. Much is reachable via existing `gpt_config`/glossary seams with near-zero code.

**Recommended approach.** (a) Adopt the numbered translation contract with low temp (~0.1) + parse-time repair (`[Missing item N]`, enforced `[OCR FAILED]`, per-page count padded/truncated to exactly N) via `gpt_config` — MIT can set this today without touching translator defaults. (b) Glossary contract `- X -> Y` + pre-dict/post-dict (`OPENAI_GLOSSARY_PATH`) for recurring romaji names/shouts (Toujou Fuyuki, WHA-!?, NO!) — investigate OCR vs glossary per case. (c) **Determinism gate:** cache/replay only when `temp==0 OR top_k==1 OR top_p==0` — this is the enabler for reliable render A/B across all render clusters. (d) Few-shot exotic-subtag miss (defect 20) is low/not-triggered-in-prod (THA/ENG only) — fix the dict lookup fallback opportunistically, do not prioritize.

**Effort:** S–M — mostly `gpt_config`/glossary config + determinism gate; near-zero code for (a)/(b)/(c).

**Fixture + test.** (1) Numbered-contract unit test: feed N source lines, assert exactly N outputs with repair tokens for misses. (2) Glossary unit test: known romaji/shout inputs → localized outputs. (3) **Determinism gate test:** same fixture twice at `temp==0` → byte-identical text+length (this is the gate that makes every other cluster's replay trustworthy). (4) Garble regression: a captured 'JDB'-class case — assert the contract/temp change suppresses the garbage token. Report to `docs/reports/benchmarks/`. Note: no BLEU/COMET accuracy benchmark exists yet (see §7) — these tests gate *reproducibility and contract compliance*, not absolute translation quality.

**Issue:** new translation-quality issue (touch `translators/chatgpt.py` + `config_gpt.py` + `gpt_config` + glossary); cross-link #160/#161 glossary, #157 series_context.

---

### Priority 8 — `line-break-wrap` (defects 22, 23) · medium · pairs with priority 1

**Why.** Greedy wrap splits names/words mid-token (กินข้/าว, คุณฟ/ยุกิ, BUSINE-SS) and yields uneven columns that don't match the reference narration shape — the main reason `reference_layout` narration columns don't match target. The #186 pluggable `LineBreaker` seam and #180 `KnuthPlassLineBreaker` adapter **exist but are off**.

**Recommended approach.** Wire the existing `LineBreaker` seam (`text_render.calc_horizontal → LineBreaker`, #186) to the default render path and enable the `KnuthPlassLineBreaker` adapter (#180, badness = slack³ + hyphen penalty, per-language kinsoku CJK / Hangul forbidden-start / Latin midpoint-out hyphenation). Add a **word-whole floor** in `calc_horizontal`/`_safe_char_split` (#9) so a column narrower than an atomic word never splits it mid-token (defers to slight-overflow / more-lines, dovetailing with priority-1's readable-floor policy). No new algorithm — the KP adapter is written; this is wiring + the word-whole guard.

**Effort:** M — wire seam + enable KP + word-whole floor + benchmark. Changes byte-identical output on all multi-line wraps, so leans on the corpus golden.

**Fixture + test (deterministic offline).** (1) Word-whole unit test: a column narrower than a name asserts the name renders unbroken (before=`คุณฟ/ยุกิ` split, after=whole with more lines / slight overflow). (2) KP-vs-greedy corpus test: on narration fixtures assert KP columns are more even (line-length variance drop) and match the reference narration shape better than greedy. (3) No-regression on protected targets. Report with before/after image of a split-name page. **Sequence after priority 1** — shares the slight-overflow floor policy.

**Issue:** #186 (seam) + #180 (KP adapter) + #9 (word-whole floor).

---

### Priority 9 — `geometry-overlap` (defects 24, 25, 26) · medium

**Why.** Multi-lobe/overlap geometry and grouping errors originate at the merge stage (`textline_merge/__init__.py:merge_bboxes_text_region`, `dispatch`, `split_text_region`) and drive downstream routing (occupancy>1 shared-fit). **Region-drop (25) is high-severity but unconfirmed** — no deterministic repro on audited pages.

**Recommended approach.** Per the debug-mantra (no repro → don't guess): **capture before fix.** (a) For region-drop, first build a targeted deterministic capture via `MIT_DUMP_REGIONS` proving region count → patches → centers covered, to isolate an actual drop from render over-shrink — do **not** TDD-fix until a repro exists. (b) For multi-lobe mis-sizing/overlap, use the `render_overlap` `anti_overlap` clamp + bubble grouping (#436/#183) with a deterministic adjacent-region fixture. (c) For over/under-merge, unit-test `merge_bboxes_text_region`/`split_text_region` routing decisions.

**Effort:** M — capture-first for region-drop, then targeted fixes.

**Fixture + test.** (1) Region-drop: `MIT_DUMP_REGIONS` coverage assertion (every detected region → a rendered patch center) on the audited pages — currently passes, so this is a *guard against regression* until a real repro appears. (2) Overlap: adjacent-region fixture asserts `anti_overlap` clamp keeps rendered alpha bboxes non-overlapping. (3) Merge routing: unit test asserting occupancy classification (sole → bubble_fit, shared>1 → own-footprint) is correct on synthetic merges. Report to `docs/reports/benchmarks/`.

**Issue:** #436/#183/#5/#7 (+#1 text-missing checklist for region-drop).

---

### Priority 10 — `vertical-text` (defect 27) · medium · deferred self-contained feature

**Why.** A decided direction (render vertical like MangaTranslator) but deliberately deferred as a separate target-orientation concern from wrap-width work. `calc_vertical()` exists but is **dead code in the patch path**, so vertical dialogue currently falls back to the tiny crop floor (interacts with priority 1).

**Recommended approach.** Wire `text_render.calc_vertical()` (currently uncalled) into the patch render path via the reference `_build_vertical_layout` (#182) — real per-character CJK/Latin stacking with advance/tracking. Self-contained future feature; ensure vertical regions get the priority-1 readable floor in the interim so they are at least legible before real vertical layout lands.

**Effort:** M–L — real vertical layout is a self-contained module, not a tweak.

**Fixture + test (deterministic offline).** Capture a vertical-dialogue fixture. (1) Interim guard: assert vertical regions hit `readable_floor`, not the ~3px crop floor (ties to priority 1). (2) Real layout: replay-harness asserts `calc_vertical()` is called and produces stacked glyphs filling the safe-area (before=dead code / crop floor, after=real vertical fill). Report with before/after vertical-bubble image.

**Issue:** #182.

---

### Priority 11 — `ocr-model` (defect 28) · medium · model-class gap

**Why.** The 48px CNN OCR is weaker than LLM-vision/manga-ocr on stylized/handwritten/low-contrast glyphs — a **model-class gap, not a regression** (dispatch is byte-identical to upstream). Better OCR feeds every downstream stage, but swapping model class is a larger, lower-frequency change than the config/floor wins above.

**Recommended approach.** Evaluate routing stylized/faint regions to `ocr_vlm.py:ocr_read_real_text` (LLM-vision) instead of the 48px CNN, gated by a confidence/contrast heuristic so the CNN stays the fast default for clean text. Do **not** rip out the CNN dispatch (byte-identical to upstream — a protected 'don't chase' target). Scope this as a measured experiment, not a blind swap.

**Effort:** L — model-class evaluation + routing heuristic + accuracy measurement.

**Fixture + test.** Capture stylized/faint-glyph fixtures where the CNN mis-reads. Assert VLM-routed reads are correct where CNN fails (before=garbled CNN read, after=correct VLM read), with a false-positive guard that clean text still routes to the CNN. **VLM is non-deterministic** — pin/stub for the gate; live reads confirmatory-only. Report to `docs/reports/benchmarks/`.

**Issue:** new OCR-routing issue (`MIT/manga_translator/ocr` 48px CNN vs `ocr_vlm.py`).

---

### Priority 12 — `inpaint-quality` (defect 29) · medium · **explicitly out of font/layout scope**

**Why.** Lowest human-level-quality leverage of the set: erase fidelity only (does **not** affect text accuracy). LaMa-vs-Flux is a deliberate VRAM-constrained choice (ADR 003/005). Classified separately so these are **never forced into render fixes** (round-1 Cluster-E lesson: fade/pixelation/ghost are inpaint/patch defects, not render).

**Recommended approach.** Out of scope for the font/layout branch. If pursued: LAB luminance-match after inpaint (remap inpainted `L=(L-gen_mean)*scale+orig_mean`, neutralize a/b chroma) to kill color cast/seams on B&W manga (#4/#10/#11/#437/#268-270) — useful discipline even for LaMa seams. Priority-5's `inpainting_size=2048` fix already recovers the downscale-blur portion. Do **not** adopt Flux/SAM (VRAM, intentional).

**Effort:** M — LAB match + seam handling; separate workstream.

**Fixture + test.** Screentone/dense-region fixture. Assert LAB match reduces color-cast/seam edge-energy over the erased plate (before=cast/ghost seam, after=neutral). Report to `docs/reports/benchmarks/`. Reuses priority-5's inpaint sharpness/edge-energy metrics.

**Issue:** #4/#10/#11/#437/#268-270 (deferred; out of this branch's scope).

---

## 5. Sequencing / roadmap

**Governing principle:** the harness must be able to *see* a defect before we fix or promote against it. The polygon-spill metric is the keystone — it unblocks three clusters. Independent, zero-code, or translation-side clusters run in parallel with the render chain.

### The hard de-risk gate

> **The harness must gain the `spill_vs_polygon` / `spill_frac_poly` metric (priority 4) BEFORE promoting `reference_layout` to default (priority 3).** Today `overflow_vs_det_w` measures spill vs the detection box; promoting `reference_layout` while the metric is blind would ship the oval-edge spill (defect 11) undetected — the exact failure of 2026-07-03. Priority 4's safe-box corner-inscribe fix + metric must land and the corpus safety-envelope must be green on the polygon before the Backend `MIT_REFERENCE_LAYOUT` flip.

### Phase 0 — Foundations & parallel zero-risk wins (no cross-deps)

- **Harness: add the polygon-spill metric** (priority 4's metric half). This is the keystone; land it first — it is required by priority 1's tradeoff bound, priority 3's promotion gate, and priority 4's `safe_area` fix.
- **`config-defaults` verify-and-close** (priority 5) — zero prod code, fully independent, runs anytime.
- **`translation-context` enablement** (priority 2) — env + docs + test, independent of the render chain, runs in parallel.
- **Determinism gate** (priority 7c) — `temp==0` reproducibility gate; landing it early makes every subsequent render replay trustworthy.

### Phase 1 — The two critical readability blockers

- **`readable-floor`** (priority 1) — depends on Phase-0 polygon metric to bound the raised-floor spill tradeoff. Highest-severity open defect.
- **`safe_area` corner-inscribe fix** (priority 4's code half) — lands so the promotion gate in Phase 2 is honest.

### Phase 2 — Promote the proven layout engine

- **`mask-aware-sizing` promotion** (priority 3) — flip `MIT_REFERENCE_LAYOUT` default **only after** priority 4's metric + fix are green across the whole corpus. This is the byte-identical-output-changing flip; leans entirely on the corpus golden + polygon gate.

### Phase 3 — Missing text classes & accuracy

- **`sfx-osb` promotion** (priority 6) — an entire untranslated text class; can start once the render clusters stabilize (shares `resize_regions_to_font_size` gating).
- **`llm-translation-quality`** (priority 7a/b) — numbered contract + glossary; independent of render, can overlap Phase 2.
- **`line-break-wrap`** (priority 8) — wire KP + word-whole floor; **sequence after priority 1** (shares slight-overflow floor policy) and pairs with reference_layout narration columns (after priority 3).

### Phase 4 — Longer-tail / self-contained / deferred

- **`geometry-overlap`** (priority 9) — **capture-first** for region-drop (no repro → no fix); regression guards otherwise.
- **`vertical-text`** (priority 10) — self-contained feature; interim readable-floor guard from priority 1.
- **`ocr-model`** (priority 11) — measured model-class experiment.
- **`inpaint-quality`** (priority 12) — **out of scope** for this branch; deferred, LAB-match only if pursued.

### Dependency summary

```
Phase 0: [polygon metric] ──┬─→ needed by P1 (tradeoff bound)
                            ├─→ needed by P3 (promotion gate)
                            └─→ needed by P4 (safe_area fix)
         [config-defaults]  (independent)
         [translation-ctx]  (independent)
         [determinism gate] ─→ makes all replay trustworthy

Phase 1: P1 readable-floor  ──→ shares floor policy with P8
         P4 safe_area fix   ──→ HARD GATE before P3 flip

Phase 2: P3 reference_layout default  (blocked by P4 metric+fix green on corpus)

Phase 3: P6 sfx | P7 llm | P8 line-break (P8 after P1 + P3)

Phase 4: P9 (capture-first) | P10 | P11 | P12 (deferred/out-of-scope)
```

---

## 6. Cross-cutting: the benchmark rules that gate every item

These are non-negotiable gates on **every** cluster (team memory + round-1 §7). A cluster that skips any of these is not done.

1. **Tie the benchmark to the md defect.** A defect is not "done" until a benchmark binds to *that* defect and proves the symptom disappears: `before = symptom present`, `after = symptom gone` — **not** "looks better," not "tests green" (`feedback_benchmark_confirms_md_defect_fixed`, `feedback_verify_before_claiming`).
2. **Patch endpoint, never image.** Benchmark MIT render via `/translate/with-form/patches` (composites tagged patches onto the original). **Never** `/translate/with-form/image` — it never calls `_tag_regions_with_bubbles`, so it reports `has_bubble=False` for every region and manufactures under-fill/oversize artifacts. Multiple round-1 conclusions were wrong artifacts of this (`feedback_benchmark_patch_not_image_endpoint`).
3. **Deterministic replay only.** The translator is non-deterministic (OCR-VLM/LLM sampling → text+length vary run-to-run), which confounds live ON/OFF A/B and breaks fixture replay. Use offline fixture dumps (`MIT_DUMP_REGIONS`) + `render_replay.py` over the committed corpus, no translator in the loop (`project_mit_translate_nondeterministic`). Any non-deterministic stage (VLM rescue, OCR routing) is pinned/stubbed for the gate; live reads are confirmatory-only.
4. **Metrics are the gate; golden images are advisory** ("golden is the gate, trace is the compass"). Text SSIM is weak — guard on **metric envelopes of the final rendered alpha bbox** (post supersample/homography/warp/clip), not the predicted layout.
5. **Two-sided guard.** Catch over-shrink (readability **floor**) *and* over-spill (polygon ceiling) — the round-1 campaign repeatedly ping-ponged "too big" ↔ "too small." Every render cluster asserts both.
6. **Verify at full resolution.** Never a downscaled montage — a 560px montage caused a render-defect over-claim that was actually LLM garble. Full-res, and for render-visible changes **send the rendered result to the user for confirmation** before claiming done (user-in-the-loop).
7. **Committed MD report + image.** Every benchmark writes `docs/reports/benchmarks/<date>-<cluster>.md` with a numeric before→after table and an embedded, committed comparison image.
8. **Classify by pipeline stage before assigning a fix.** Each defect is tagged detection/ocr/translation/layout/render/inpaint. Inpaint/patch defects (fade/pixelation/ghost) are **not** render fixes; LLM garble is **not** a render fix. `debug-mantra`: no repro → don't guess; require a targeted deterministic capture before any TDD fix.
9. **ADR + system-impact-report** for every quality/perf-affecting change or non-trivial decision; a decision that overturns an old ADR marks it Superseded. Byte-identical golden contract on both protected targets (Thai Gal-Yome + EN One-Punch) for every flag-gated change.
10. **Notify on done / decision** via `scripts/notify.ps1` (WinRT toast; built-in PushNotification does not surface on this box).

---

## 7. Open risks & honest limitations

- **Interior-box residual on irregular/conjoined bubbles.** Priority-4 Approach A (corner-inscribe) preserves anchor-centering and no-ops on box-like bubbles, but proportional shrink mildly under-fills highly eccentric *non-elliptical* convex bubbles and does not chase irregular corners. A true largest-inscribed-rectangle (Approach C) or polygon-aware `safe_area` (priority-3 Approach B) is a scoped follow-up, deferred until the metric shows it is needed. Conjoined/narrow-neck balloons (defect 9, pole-of-inaccessibility path) remain a known soft spot.
- **`reference_layout` default flip changes byte-identical output for every page.** Promotion (priority 3) rests entirely on the corpus safety-envelope + polygon gate being trustworthy. If the corpus is too small, the flip could regress an unrepresented case. Mitigation: grow the corpus and a multi-run path-stability check before flipping; the 1.4 `fills_bubble_width` threshold has only ~0.2 margin each side.
- **Rolling-context coverage gap.** Priority-2 Approach 1 enables context **only on webhook-batch pages**. Single-page/missing-page recovery (`translateSinglePage`) and the no-callback NDJSON streaming branch stay context-free. These are a minority in production (webhook mode is always used; recovery is rare), but a chapter that hits recovery on a name-introducing page loses that consistency. Closing the gap (Approach 2) is deferred unless the benchmark shows it is material.
- **Env-overridable sizes can silently re-regress.** `MIT_DETECTION_SIZE`/`MIT_INPAINTING_SIZE` are intentionally env-overridable for tight-VRAM hosts — and **this dev box is VRAM-tight** (`project_dev_commit_memory`). The benchmark asserts the *default*, not the deployed env; a stale/low `.env` reintroduces the regression invisibly. Mitigation: snapshot the running MIT config in the report; optional startup warning (priority-5 Approach B). A hard clamp is wrong — legitimately tight hosts must be allowed lower or they OOM.
- **Region-drop (defect 25) is unconfirmed.** High severity but no deterministic repro on audited pages. Per debug-mantra it must not be TDD-fixed on speculation — priority 9 is capture-first; the current test is a regression guard, not a fix.
- **No translation-accuracy benchmark exists.** There is no BLEU/COMET/human-eval harness (OpenMantra/Manga109) — only render-parity is measured. Priority-7 tests gate *reproducibility and contract compliance*, not absolute translation quality. Human-level *accuracy* (as opposed to consistency/legibility) is therefore only partially verifiable with current tooling; building an accuracy benchmark is itself unscoped future work.
- **Translator non-determinism blocks live A/B permanently** until the determinism gate (priority 7c, `temp==0`) is enforced. Until then every render conclusion must come from offline replay, and in-app E2E can only verify wiring, not compare quality.
- **48px CNN OCR model-class gap (defect 28)** feeds every downstream stage; it is byte-identical to upstream (a 'don't chase' target) so it is not a regression, but it caps quality on stylized/faint glyphs. Swapping model class (priority 11) is an L-effort experiment, not a quick win.
- **Deliberate out-of-scope items.** SAM2/3 segmentation and Flux inpaint are intentionally not adopted (VRAM constraint, ADR 003/005) — they remain the largest gap vs the ~22-model upstream stack. `inpaint-quality` (priority 12) is out of the font/layout branch scope entirely. This plan targets human-level quality *within the single-12GB-GPU envelope*, not parity with the full upstream stack.
- **`series_context` (#157)** is a signal upstream lacks; keep it alongside the rolling-context fix — it partially masks but does not substitute for cross-page context, so priority 2 is still required even where series_context is present.