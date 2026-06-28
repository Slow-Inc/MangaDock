# ADR 022 — SFX rescue gated on det_sfx provenance, not a text-length heuristic

- **Status:** Accepted (2026-06-29) — implemented. `manga_translator/utils/generic.py`
  (`Quadrilateral.is_sfx`), `detection_postproc.py` (stamps the flag), `textline_merge/__init__.py`
  (propagates it), `utils/textblock.py` (`TextBlock.is_sfx`), `ocr_vlm.py` (`should_rescue_sfx`),
  `manga_translator.py` (rescue site).
- **Context:** #278 — follow-up from the `/scrutinize` self-review of #277 (multilingual SFX rescue).
  Refines the SFX pipeline of [[003-mit-flux-klein-optional-inpainter]] / #168 / #277. Does not touch
  the detection or render contracts in [[006-mit-bubble-aware-detection-grouping]].
- **Scope:** the target-independent SFX rescue in `_run_ocr` only. The vision-gateway contract,
  `sanitize_sfx`, and `restore_sfx_translations` are unchanged except the refusal guard below.

## Context

#277's rescue fired for **any** region whose OCR'd text was `len(text.strip()) <= 4` inside a
`>= 60×60` box. Two consequences:

1. **False positives.** A short dialogue line in a large bubble (`は？`, `おい`, `HUH?`) reads as
   ≤4 chars in a big box → it was sent to the vision gateway and, on any non-empty reply,
   **overwritten with an onomatopoeia** — a wrong render.
2. **Latency.** Every such region added a ~1–2 s gateway round-trip to *every* translate, even on
   pages with no SFX. Before #277 the rescue only ran on filter-dropped regions; the #277 rewrite
   moved it ahead of the filter and widened the trigger.

The det_sfx second pass (`merge_sfx_detections`, #168) already *knows* which textlines are SFX — it
appends them itself. That provenance was thrown away (the appended `Quadrilateral` was
indistinguishable from a real one), forcing the length heuristic as a proxy.

## Decision

Thread a boolean **`is_sfx` provenance flag** from the det_sfx pass to the rescue site instead of
re-deriving "is this SFX?" from text length:

- `merge_sfx_detections` stamps `Quadrilateral(..., is_sfx=True)` on the boxes it appends.
- `textline_merge.dispatch` sets `TextBlock.is_sfx = any(q.is_sfx for q in merged_textlines)` — a
  region is SFX iff it contains an SFX-detected textline.
- The rescue fires via a pure `should_rescue_sfx(is_sfx, x1,y1,x2,y2)` predicate = provenance **and**
  the existing geometry gate (area ≥ 3600, shorter side ≥ 24). It never keys on text length.

`is_sfx` is an additive optional field defaulting `False`, so with `det_sfx` off (no SFX textlines)
no region is ever flagged and the rescue never fires — and the rest of the pipeline is byte-identical.

A small companion fix: `sanitize_sfx` shares one `_SFX_REFUSALS` set across its Latin and non-Latin
branches, so an echoed English `NONE`/`N/A` or a native `无`/`없음`/`ไม่มี` can't leak as an SFX token
(the non-Latin branch previously had no refusal guard).

## Consequences

- **Correct trigger:** normal dialogue is never rescued; only AnimeText-detected SFX is. No extra
  per-page gateway calls on SFX-free pages.
- **Coupling:** SFX rescue now *requires* `det_sfx` to be on (it supplies the provenance). This is
  intended — the rescue is part of the SFX pipeline. The #278 fallback ("≤2 chars + not-in-a-bubble"
  heuristic) was not needed because provenance threads cleanly end-to-end.
- **Trade-off:** with `det_sfx` off, a large stylized SFX the primary detector misread as ≤4 chars is
  no longer rescued. Acceptable: that path is the SFX feature, which `det_sfx` gates anyway.
- **Reversibility:** revert the six edits; the field is additive so nothing else depends on it.

*Supersedes the length-heuristic gate introduced in #277 (that PR remains valid for the multilingual
prompt/sanitizer work; only the rescue trigger is replaced).*
