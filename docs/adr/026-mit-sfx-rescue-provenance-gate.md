# ADR 026 — Gate the SFX vision-rescue on det_sfx provenance, not a length heuristic

- **Status:** Accepted (2026-06-30)
- **Issues:** #278 (PR #277 review follow-up).
- **Area:** MIT OCR/SFX — `manga_translator.py` (rescue site), `ocr_vlm.py` (`should_rescue_sfx`, `sanitize_sfx`), `utils/generic.py` (`Quadrilateral`), `utils/textblock.py` (`TextBlock`), `textline_merge/__init__.py`, `detection_postproc.py`.

## Context

The target-independent SFX rescue sent **any** ≤4-char region in a ≥60×60 box to the vision gateway and, on a non-empty reply, overwrote it with an onomatopoeia. A length heuristic is a poor proxy for "is this a stylized SFX": short dialogue and interjections (`HUH?`, `おい`, `は？`, `ですよ`) in a large bubble are ≤4 chars too — they were misread as SFX (wrong render) and each added a ~1–2 s gateway round-trip to **every** translate (the rescue ran on all regions, not just filter-dropped ones).

MIT already has a reliable signal: the `det_sfx` second pass (`merge_sfx_detections`) appends boxes the primary detector missed as empty textlines — those are the actual SFX candidates. That **provenance** is a better gate than text length.

## Decision

- Thread an `is_sfx` flag from the `Quadrilateral` textlines appended by `merge_sfx_detections`, through `textline_merge` (a merged region is SFX-provenance if **any** of its textlines is), to `TextBlock.from_sfx_detection`.
- Gate the rescue with a pure `should_rescue_sfx(text, from_sfx_detection, w, h, vlm_rescue)`: **provenance ⇒ rescue (≤4 chars)**; without provenance (det_sfx off) fall back to a tight **≤2-char** rule so normal short dialogue is not misread as SFX. Box size sanity (area ≥ 3600, min side ≥ 24) retained.
- Plus PR #277 review nits: pin the ENG prompt with `==` byte-identity; add a non-Latin refusal guard to `sanitize_sfx` (drop a Latin `NONE`/`NA` reply for a Thai/Chinese/Korean target); document jieba's lazy first-cut dict cost (kept lazy by design).

## Consequences

- **Positive:** normal short text is no longer detected/rescued as SFX (the user-reported defect); real SFX (det_sfx) is unaffected. Removes the per-region gateway round-trip for every short non-SFX region → lower latency on every translate.
- **Validated:** deterministic benchmark `docs/reports/benchmarks/2026-06-30-sfx-rescue-provenance-gate.md` — OLD rescued 5/7 representative regions, NEW 3 → **2 false-positive gateway calls eliminated**, real SFX kept. Unit: +9 `test_ocr_vlm` (6 `should_rescue_sfx` + ENG `==` + 2 refusal-guard), 24/0. Render golden untouched; affected suites green (textline_merge async failures = pre-existing pytest-asyncio gap, identical on main).
- **Limitation:** a genuine ≤2-char SFX found only by the primary detector when `det_sfx` is **off** relies on the tight fallback; with `det_sfx` on (production default) provenance is authoritative.
- **Reversibility:** `should_rescue_sfx` is a pure gate; loosening it back to `len ≤ 4` (ignoring provenance) restores the old behaviour. The `is_sfx`/`from_sfx_detection` flags default `False` (byte-identical when det_sfx never fires).

## Addendum (2026-06-30) — provenance alone was insufficient: drop det_sfx false-positives

Full-stack EN→Thai benchmarking surfaced that **`det_sfx` itself false-positives on speech bubbles** — so the provenance signal this ADR trusts is not always trustworthy. The AnimeText SFX pass produced boxes over dialogue that the 48px line-OCR read as short ASCII fragments (`W`, `I`, `THE`, `M`, `8`, `1`, `WHA`). With provenance + short text + a large box, those passed `should_rescue_sfx` → the vision gateway, told they were SFX, **hallucinated** a phantom Thai token (`W`→"ปาร์ตี้", `THE`→"เสียงดังสนั่นหวั่นไหว", `M`→"ไม่ชัดเจน", `1`→"เงียบสงบ") that merged into and corrupted the real dialogue render (empty/garbled/tiny bubbles).

**Refinement (not an overturn):** the line-OCR *drops* a stylized SFX → it comes back non-ASCII/CJK; a clean **ASCII letter/digit read is proof the OCR succeeded on real text**, never a dropped glyph. New pure `ocr_read_real_text(text)` (`[A-Za-z0-9]` present):
1. `should_rescue_sfx` returns `False` for real-text reads (no gateway round-trip, no hallucination).
2. `_apply_ocr` **drops** a `from_sfx_detection` region whose read is real text — otherwise its literal fragment (`W`→"ว") would still be translated and rendered over the dialogue.

- **Validated:** `docs/reports/benchmarks/2026-06-30-sfx-falsepos-phantom-fix.md` — across all 5 problem pages every ASCII phantom (7) is dropped and every non-ASCII SFX (ほ。ん, サ×2, ⁉, ぎい) is still rescued; bubbles render real dialogue. +1 `ocr_read_real_text` test + 1 ascii-reject + 1 nonascii-keep on `should_rescue_sfx`; `test_ocr_vlm` 27/0.
- **Limitation:** a genuine standalone **Latin** SFX (e.g. a stylized "BOOM") found only via det_sfx is now dropped rather than localized; acceptable — this content's real SFX are CJK, and a readable Latin SFX degrades to the normal translate path, never a phantom. The `det_sfx`-over-dialogue **overlap** when both render (#436) is separate and still open.
