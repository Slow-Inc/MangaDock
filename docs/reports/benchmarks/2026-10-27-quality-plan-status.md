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
| Art repair | LaMa-large (unchanged) | Flux Klein measured and rejected |

## Measured and rejected (kept as notes, not code defaults)

| candidate | why not |
|---|---|
| FLUX.2-klein inpainting | 4.6× the time on p2, no visible gain; the bigger loss is mask-level |
| PP-OCRv6 detection | proposed no text our pipeline missed; word-level boxes; would add a Paddle/ONNX runtime |
| manga-ocr | Japanese recogniser: full-width garbage on an EN page, 0 patches, 57.5 s |
| scene notes in the prompt | blind judge 5:7 for plain, +10 s/page (code kept behind `MIT_VISION_CONTEXT=notes`) |
| SAM 2.1 glyph-accurate erase mask | the refined mask is smaller than the seed by construction and leaves the English lettering visible under the Thai (fill vs outline); a union would erase at least as much |

## End-to-end number today

14-page chapter on the live stack (Luna + corrected source + contrast + Hayai rescue + LaMa): **42.7 s / 42.6 s,
14/14 pages per run** — the analyst pass is most of the difference against the 33.8/26.7 s measured for Luna
without it, and it is the price of the corrected source (quality-first decision, recorded here so performance work
can find it later).

## Measurement tooling now in the repo

- `MIT/tools/render_qa.py` + `manga_translator/render_qa.py`: read the rendered Thai back with `th_PP-OCRv5` and print
  a CER table plus review candidates (medians 0.105 / 0.000 / 0.135 on ch. 6 pages 2/9/10; flags are candidates, not
  verdicts). Runs under the separate Paddle venv.
- `docs/reports/benchmarks/`: one report per experiment (this directory), plus ADR 037 for the rescue design.

## Open questions with evidence (not started)

1. **Figure compositing** (Track A4): restore original pixels for figure areas the repair touched but the lettering
   did not. The glyph-mask result says art preservation cannot come from shrinking the mask; compositing is the
   remaining route. Needs a figure-mask source and a render-level seam.
2. **Role-aware lettering** (Track A1): the analyst already returns per-line role (dialogue/thought/narration/sfx);
   fonts and size policy per role are not implemented, and there is no measurement for "looks typeset" yet.
3. **Thai post-check in the pipeline**: blocked on a Thai ONNX recogniser (paddle2onnx does not load on this box).
4. **Selective analyst cost**: a cheap "this page looks degraded" trigger was checked against saved data — every one
   of 8 pages had a junk-looking line and every page was corrected, so the trigger would skip nothing on this
   corpus. Dropped unless a better signal appears.

## How to check the live stack

```
curl http://127.0.0.1:5003/ready                     # workers + translator
MIT/.env: CUSTOM_OPENAI_PROTOCOL=responses, CUSTOM_OPENAI_RESPONSES_MODEL=gpt-6-luna,
          MIT_VISION_CONTEXT=correct, MIT_GLYPH_MASK=0
D:/Github/MangaDock/MIT/.venv/Scripts/python.exe -m pytest -q test/test_hayai_ocr.py test/test_responses_protocol.py \
    test/test_vision_context.py test/test_text_contrast.py test/test_render_qa.py test/test_glyph_mask.py
```
