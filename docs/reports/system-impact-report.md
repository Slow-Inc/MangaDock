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
