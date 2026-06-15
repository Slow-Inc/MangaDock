---
name: project-mangatranslator-study
description: Pointer to the canonical deep-scan of meangrinch/MangaTranslator (the benchmark reference) — the algorithm-level analysis lives in docs/research/, NOT here. Use this to find WHICH doc answers WHICH question.
metadata:
  type: reference
---

The **canonical, reimplementation-grade deep scan** of meangrinch/MangaTranslator (the benchmark reference we chase;
clone at `C:\Github\MangaDock\MangaTranslator`, Apache-2.0 → borrowable) is **committed under `docs/research/`** —
this memory is only an index so we don't re-derive it (north-star: remove complexity, don't duplicate).

| Need | Authoritative doc |
|------|-------------------|
| Full comparative THEIRS-vs-OURS dissection, per-dimension gaps, black-box ledger, issue fix-map | **`docs/research/translator-deep-dissection.md`** (553 lines — headline) |
| Per-stage constants/formulas (detection IoA, SAM thresholds, safe-area math, Knuth-Plass badness, cache keys) | `docs/research/mangatranslator-internals.md` + `mangatranslator-round2-deep.md` (round-2 = deltas only) |
| Borrowable ideas → issue mapping with constants | `docs/research/mangatranslator-study.md` |
| Render-path port plan (Gaps A–F → #166/#168/#170/#175/#176/#179/#180) | `docs/research/render-parity-port-plan.md` |
| OUR-side "before" baseline (12-stage patch path) | `docs/research/pipeline-baseline-2026-06-08.md` |

**Stage headline (confirmed current 2026-06-12):** detection = YOLO suite (speech_bubble/conjoined/osbtext-AnimeText/panel) · segmentation = **SAM2+SAM3** (the "sees bubble shape" edge) · OCR = `ocr_method` LLM-vision (default) / manga-ocr / paddleocr-vl (the 48px Roformer CNN is IDENTICAL to ours) · inpaint = **Flux** · render = pure Skia/HarfBuzz algorithm (Knuth-Plass, safe-area, 4× supersampling, uppercase) · translate = 10 providers @temp 0.1 + rolling page context + Rosetta glossary.

**Reconciliation deltas (re-verify before code use):** (a) Flux inpaint backend may have moved **sd.cpp → diffusers≥0.37**; (b) the docs' file:line + future-dated model IDs (gemini-3.1, gpt-5.4, FLUX.2 Klein) predate the current clone and recent OUR-side changes (#191/#187/#192) — re-read before citing exact lines. Synthesized 2026-06-12 via an ultracode fan-out over all six docs.

See [[project-render-parity-direction]], [[project-render-knob-gating]], [[project-animetext-approved]].
