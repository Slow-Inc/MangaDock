# Translation-quality plan — where it stands (2026-10-27)

The direction from the developer: quality first, performance later; adopt a better model immediately and move on.
This page is the one-glance state of that work: what the live stack does today, what was measured, what was
rejected and why, and what is left.

## Live stack (all adopted, all measured)

| part | what runs | evidence |
|---|---|---|
| Translation model | **gpt-6-luna** on the OpenAI Responses protocol (`response_protocol.py`) | blind judge 9:3:1 over haiku; keeps stutters/interjections where haiku flattened them; chapter 24.7/19.0 → 33.8/26.7 s |
| OCR line | 48 px recogniser (unchanged) | clean print reads correctly |
| OCR rescue | **Hayai v2.5 Nova locally**, token-likelihood gate, gateway fallback | `textline_merge` p50 2,163 → 646–722 ms; gateway calls on p10–11 153 → 0; both hand-lettered lines recovered |
| Reading errors | **analyst corrects the OCR source** before translation (`MIT_VISION_CONTEXT=correct`) | geometry-matched blind A/B 20:12 over 32 differing regions; 3–9 lines corrected per page |
| Text colour | **contrast rule** on the repaired patch (`MIT_TEXT_CONTRAST`, on) | dark-on-black `ฮึ!!` → white-with-black-stroke, checked by eye |
| Page image | every translation request carries the page (ADR 036) | blind A/B 163:97 (earlier round) |
| Character names | **series memory + maximal-gram learner + unspanned-run enforcement** (`MIT_SERIES_GLOSSARY`, on) | live chapter: 4 of 5 occurrences unified after page 0; pre-fix page 12 disagreed with page 1 |
| Art repair | LaMa-large **+ selective Flux repair** for text over textured art (`Inpainter.selective_flux`, on by default) | p2 hand-lettered HUH over hair: grey smear → plausible hair/panel; ~16–20 s on affected pages, nothing elsewhere |

## Measured and rejected (kept as notes, not code defaults)

| candidate | why not |
|---|---|
| FLUX.2-klein inpainting | 4.6× the time on p2, no visible gain; the bigger loss is mask-level |
| PP-OCRv6 detection | proposed no text our pipeline missed; word-level boxes; would add a Paddle/ONNX runtime |
| manga-ocr | Japanese recogniser: full-width garbage on an EN page, 0 patches, 57.5 s |
| scene notes in the prompt | blind judge 5:7 for plain, +10 s/page (code kept behind `MIT_VISION_CONTEXT=notes`) |
| SAM 2.1 glyph-accurate erase mask | the refined mask is smaller than the seed by construction and leaves the English lettering visible under the Thai (fill vs outline); a union would erase at least as much |
| rolling cross-page dialogue context (`MIT_CONTEXT_PAGES`) | 6× slower (43/58 → 285/264 s) and blind judge 9:10:tie — no gain; a names-only context is the affordable variant, not tested |
| `mask_tighten` (shrink the mask to ink strokes) | on the HUH-over-hair page it produced a white LaMa blob on the dark panel — visibly worse than the plain mask |
| role-aware emphasis (bold for shouts, from the analyst's role/emotion) | implemented behind `MIT_ROLE_FONTS` (off): conflicts with the product's lighter-Thai preference, and the analyst's emotion labels are not stable — the same two pages analysed twice gave 6/15, 3/7, 0/15, 4/7 emphasised lines |
| selective Flux at 1024 instead of 2048 | p2 27.6 → 29.5 s, i.e. no speed-up; art equivalent — the knob stays, the default keeps the config size |

## End-to-end number today

14-page chapter on the live stack (Luna + corrected source + contrast + Hayai rescue + LaMa + selective Flux):
**148.1 s / 154.1 s, 14/14 pages per run** (final verification run; earlier runs of the same stack measured
173.1/172.7 s — GPU warmth and sampling move it by ~10 %). The two quality-first prices are visible here: the analyst pass
(~10 s/page, against 33.8/26.7 s measured for Luna without it) and the selective Flux repair (~20 s on the four
pages per chapter that have text over textured art). Two performance tasks are recorded below: keep Flux warm per
chapter, and either accept or trim the analyst pass.

**Chapter quality audit on the final runs:** 156 regions, 58 dialogue lines, **53 translated (91 %)**, 5 without
Thai — all five on the credit page (e-mail/wallet/URLs, not meant to be translated, #1139) — and **0 names
drifting** in both runs. That is 58/58 for dialogue, with consistent spellings. The worker log confirms the
adopted parts ran: 28 selective-Flux passes (8 repairing 1–2 regions, 0 failures), the analyst corrected the
source on 25 pages, and the local Hayai rescue loaded in each worker.

## Measurement tooling now in the repo

- `MIT/tools/render_qa.py` + `manga_translator/render_qa.py`: read the rendered Thai back with `th_PP-OCRv5` and print
  a CER table plus review candidates (medians 0.105 / 0.000 / 0.135 on ch. 6 pages 2/9/10; flags are candidates, not
  verdicts). Runs under the separate Paddle venv.
- `MIT/tools/quality_audit.py` + `manga_translator/quality_audit.py`: the chapter audit (completeness, residue,
  name drift for requested names) over a bench JSON or a patches response.
- `docs/reports/benchmarks/`: one report per experiment (this directory), plus ADR 037 for the rescue design.

## Open questions with evidence (not started)

1. **Figure compositing** (Track A4): selectively repairing text-over-art with Flux closed most of the gap that
   compositing was meant to fill (the HUH-over-hair case now reads as art, not a smear). What remains is the case
   where a *character* overlaps the lettering box — no figure mask is available yet, and the glyph-mask experiment
   showed the erase mask cannot simply be shrunk.
2. **Deterministic shout styling** (Track A1 follow-up): role/emotion from the analyst was implemented and rejected
   (labels not stable). The deterministic variant — short all-caps source = shout, decided from the source text with
   no analyst call — reuses the same renderer seam and is the one worth trying.
3. **Thai post-check in the pipeline**: blocked on a Thai ONNX recogniser (paddle2onnx does not load on this box).
4. **Selective analyst cost** (dropped, recorded): a cheap "this page looks degraded" trigger was checked against
   saved data — every one of 8 pages had a junk-looking line and every page was corrected, so the trigger would skip
   nothing on this corpus. Revisit only with a better signal.
5. **Performance of the two quality-first prices** (measured, both opt-in): `MIT_FLUX_WARM=1` keeps LaMa and Flux
   resident and made the chapter 173 → 155 s (~9 %; the rest is Flux inference, not the load), at the cost of holding
   both models in VRAM; the analyst pass is ~10 s/page. Defaults stay cold and unaffected.
6. **Product decision on the Flux cost**: accept ~20 s on pages with text over art, gate the pass on a larger minimum
   art-box area, or run it as an offline chapter pass. The engineering levers are measured; the choice is taste.

## How to check the live stack

```
curl http://127.0.0.1:5003/ready                     # workers + translator
MIT/.env: CUSTOM_OPENAI_PROTOCOL=responses, CUSTOM_OPENAI_RESPONSES_MODEL=gpt-6-luna,
          MIT_VISION_CONTEXT=correct, MIT_GLYPH_MASK=0
D:/Github/MangaDock/MIT/.venv/Scripts/python.exe -m pytest -q test/test_hayai_ocr.py test/test_responses_protocol.py \
    test/test_vision_context.py test/test_text_contrast.py test/test_render_qa.py test/test_glyph_mask.py
```
