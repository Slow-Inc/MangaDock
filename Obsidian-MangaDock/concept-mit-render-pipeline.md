---
name: concept-mit-render-pipeline
tags: ["concept", "moc"]
description: Concept hub — everything about how MIT turns a manga page into a translated one (detect → OCR → inpaint → render), the knobs that gate quality, the lama↔flux inpainter tradeoff, the parity direction, and the open render defects — with links out to every scattered note/ADR/report
metadata:
  type: concept
---

# 🎨 MIT Render Pipeline — Concept Hub

> [!info] Why this note exists
> The render/inpaint knowledge for the **MIT** ML server is spread across ~5 vault notes, ADRs 003–007 & 023–027, `docs/research/`, and several benchmark reports. This hub **compiles** it into one place so an agent (or human) can grasp the whole picture and jump to the detail. One-fact notes stay canonical; this note only links + frames them. Keep it current when a render decision changes.

## The pipeline (what happens to one page)

`image → detect text (YOLO) → OCR (LLM-vision) → inpaint (erase original text) → render (draw translation back)`

Each stage has its own quality levers; **render** and **inpaint** are where our quality gap vs the reference translator lives.

| Stage | Impl | Quality lever | Deep doc |
|-------|------|---------------|----------|
| Detect | YOLO comic-text; #168 AnimeText YOLO for SFX | detection/merge → wrong region grouping is a *detection* bug, not sizing | ADR 006 · [[project-animetext-approved]] |
| OCR | LLM-vision (Qwen via `custom_openai` API, not local) | prob threshold `MIT_OCR_PROB` | — |
| Inpaint | LaMa (default) / Flux (selective, gated) | see Comparison below | ADR 003 · `docs/research/inpaint-cleanliness-vs-upstream.md` |
| Render | bubble-fit + supersampling + wrap | the full `MIT_*` knob set — see below | ADR 007, 023–027 · [[project-render-parity-direction]] |

## Render — the knob set gates everything

In-app render is only as good as the **full** `MIT_*` env set on the **backend** (opt-in, byte-identical when unset). Setting only *some* silently falls back to the legacy overflow path. → [[project-render-knob-gating]]

Full parity set (all together on the backend):
`MIT_BUBBLE_SEG=1 MIT_BUBBLE_AREA_FIT=1 MIT_EN_COMIC_FONT=1 MIT_SUPERSAMPLING=4 MIT_OCR_PROB=0.03`

`MIT_BUBBLE_AREA_FIT=1` is the master gate — it enables the #166 binary-search fit, #170 bubble tagging, and #179 narrow-column. Verify propagation: the worker log prints `[BubbleSeg] N balloons…`. No BubbleSeg line = knobs never reached the worker.

## Parity direction (decided 2026-06-08)

Make MIT render like meangrinch/MangaTranslator — the root of the "looks like a paragraph/novel" problem is **what we wrap to**, not font size: → [[project-render-parity-direction]]
1. **Narrow-column wrap** from the real mask interior (not the wide bbox)
2. **Supersampling 4×** then downscale (soft edges, controlled perceived size)
3. **True vertical** stacking when a region is tall/narrow
4. **SFX detector** (#168) — VRAM has headroom (5–7 / 12 GB)

## Inpainter — LaMa vs Flux (Comparison)

| | LaMa (`lama_large`) | Flux (`flux_klein`) |
|---|---|---|
| Default? | ✅ default, always available | ❌ **selective/gated** |
| Quality | smears/blurs art *under* the erased text | regenerates plausible art back — cleaner |
| Cost | cheap, low VRAM | heavier |
| Gotcha | — | `MIT_INPAINTER=flux_klein` only works on a branch that has **#277 (c31ff81)**. On other branches every translate → **MIT 500 ValidationError (enum)** even though `/ready` returns 200 (false-healthy). Fall back to `lama_large` there. |
| Best-render reference | — | best quality observed = commit **9ce97b85** (landing/render-phase0: selective Flux #421 + #540 + #278 + #535) = the Stage-C payload; use as quality baseline |

(Backend/.env is **shared across branches** — that's why a stale `MIT_INPAINTER=flux_klein` silently breaks translate on a branch without #277.)

## Open render defects (residual — where to look next)

From the #175 fix (bubble_area_fit + display_sfx landed 2026-06-30) → [[project-mit-175-dialogue-path]]:
1. **EN-source line-break parity** — the "follow original line-break" mechanism wraps to *source bbox width*, which only coincidentally matches for vertical **JP** source. **EN source → wide bbox → wide wrap ≠ original.** Affects every EN-source translation. (PRD-en-source-wrap-parity, #435)
2. **narration vs dialogue routing** — with `bubble_area_fit` ON, top narration/caption gets segmented as a big bubble → filled wide instead of wrapped narrow. Discriminator measured: `rw/bw` (text-footprint width ÷ bubble width) — **dialogue ≈0.88–0.90 (fill), narration ≈0.40–0.59 (wrap narrow)**; route to clean_layout when `rw/bw < ~0.72`.
3. **stylized in-bubble words** the SFX YOLO splits into their own region with no `bubble_box` can still oversize — detection/merge issue, not sizing.

## Measurement discipline (don't fool yourself)

- Benchmark via `/translate/with-form/patches` (tags bubbles), **never** `/translate/with-form/image` → [[feedback-benchmark-patch-not-image-endpoint]]
- Translate is **non-deterministic** (OCR-VLM/LLM sampling) → in-app ON/OFF A/B is confounded; use the offline worker-direct harness `MIT/tools/ab_parity.py` for pixel comparison → [[project-mit-translate-nondeterministic]]
- Clear cache (backend DOWN first) before a code-change Reader E2E → [[project-cache-reset-ordering]]
- One-Punch benchmark **fools the eye** (JP narration goes through clean_layout) — always also compare EN-dialogue → [[project-mit-175-dialogue-path]]
- A documented defect isn't "done" until a benchmark ties to THAT defect and shows the symptom gone → [[feedback-benchmark-confirms-md-defect-fixed]] · [[feedback-verify-before-claiming]]

## Deep docs (outside the vault)

- ADRs: 003 flux inpainter · 004 patch pipeline · 005 cpu levers · 006 bubble detect · 007 render parity · **023–027** active #175/#430/#436 render decisions
- Research: `docs/research/translator-deep-dissection.md`, `mit-vs-upstream-quality-divergence.md`, `inpaint-cleanliness-vs-upstream.md`, `en-source-wrap-parity-study.md`
- Master plan / reports: `docs/prd/mit-render-defect-master-plan.md`, `docs/reports/benchmarks/`
- Full catalog → [[reference-external-docs-index]]

related: [[project-render-knob-gating]] [[project-render-parity-direction]] [[project-mit-175-dialogue-path]] [[project-mit-launch-env]] [[project-mit-translate-nondeterministic]] [[feedback-core-boundary]]
