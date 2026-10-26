# Model sweep summary — what was tested in every pipeline part, and what won (PRD #1143)

The developer's direction for this sweep: quality first, performance later; if a model is better, make it the
default immediately and move on. Every claim below comes from a live MIT on this box, with the report named.

| pipeline part | candidate | verdict | evidence |
|---|---|---|---|
| **Translator** | **gpt-6-luna** on the Responses protocol | **ADOPTED (default)** | blind judge 9:3:1 over haiku; keeps stutters/interjections where haiku flattens them; chapter 24.7/19.0 → 33.8/26.7 s. [report](2026-10-26-translator-models-responses.md) |
| Translator (previous) | claude-haiku-5-5 (Anthropic protocol) | kept as fallback + used as analyst | `.env.haiku-backup`, `CUSTOM_OPENAI_PROTOCOL=anthropic` restores it |
| **Line OCR** | 48 px recogniser (current) | kept as primary | reads clean print correctly; its failures are what the rescue exists for |
| OCR rescue | **Hayai v2.5 Nova** | **ADOPTED (default)** | reads the hand-lettered lines the 48 px model loses; 131 ms/crop with the token-likelihood gate (real lettering −0.01…−0.09 vs invented text −0.55…−2.58); textline_merge p50 2163 → 646–722 ms; gateway calls → 0. [report](2026-10-26-hayai-ocr-candidate.md) |
| OCR (alternative) | manga-ocr | rejected | Japanese recogniser: full-width garbage on an EN page, 0 patches, 57.5 s |
| OCR (Paddle family) | PP-OCRv5/v6 recognisers | not adopted | Paddle stack works only in an isolated venv; no measured gain over 48 px + Hayai |
| **Detection** | PP-OCRv6 det | rejected | word-level boxes, **no text our DBNet+rescue pipeline missed** on the test pages, plus junk boxes over art. [report](2026-10-26-paddle-detection-thai-postcheck.md) |
| **Inpainting** | FLUX.2-klein | rejected | 4.6× the time on p2, no visible gain; bigger loss (motion strokes) is a mask problem. [report](2026-10-26-inpainting-flux-vs-lama.md) |
| **Foreground / glyph masks** | **SAM 2.1** | promising, needs the Track A4 seam | one click returns a hand-drawn letter exactly (4.3k px) or a character silhouette; 0.09 s/prompt. [report](2026-10-26-sam2-foreground-masks.md) |
| **Post-render check** | th_PP-OCRv5 mob rec | promising, needs ONNX + calibration | median CER 6.5 % on rendered Thai, flags a possibly clipped tone mark (`พรึ่บ`→`พรึบ`) |
| **Scene context (analyst)** | **claude-haiku-5-5** | **chosen for the role** | both models fixed every checkable OCR error; haiku 9.4–11.5 s vs Luna 29.9–32.1 s. [report](2026-10-26-page-analyst-luna-vs-haiku.md) |
| Fragment linking | COO | **no weights on this box** | research code; nothing to run |
| Curved text | FCENet / TextSnake / ABCNet / DeepSolo / TESTR | **not runnable** | not in the Paddle OCR model zoo; several are non-commercial |
| Occluded text | VisionLAN / OpenOCR OST | **not runnable** | no weights |
| Speaker / character models | MAGI / MangaLMM / zero-shot | **not runnable** | no weights (research-only); partly covered by the analyst above |
| Generative lettering | AnyText2 / Qwen-Image / FontDiffuser | **not runnable** | multi-GB weights, research licences; no evaluation seam yet |

## What the live stack runs now

`gpt-6-luna` (Responses) → translation · `claude-haiku-5-5` (Anthropic) → side tools/analyst ·
48 px OCR primary + **Hayai v2.5 Nova** local rescue · LaMa-large inpaint · page image on every translation request.

## What the sweep changed in the code (branch `feat/mit-ocr-hayai`)

`model_hayai.py` + `hayai_post.py` (OCR adapter, token-likelihood gate, native crops), `local_ocr_rescue.py`
(rescue through the local reader, gateway fallback), `response_protocol.py` + `custom_openai` wiring (Responses
protocol), preload/warm-up for the local OCR, and tests for each. 494 tests pass.

## Open follow-ups (not model swaps)

1. SAM 2.1 glyph masks → Track A4 erase/composite seam (biggest remaining art-quality win).
2. Thai post-check as an ONNX screening gate (calibrate CER threshold against human labels).
3. Analyst output into the translation prompt (`MIT_VISION_CONTEXT=1`) + the #1141 blind A/B.
4. Ink-shaped erase mask + contrast-based text colour (found in the inpainting test).
