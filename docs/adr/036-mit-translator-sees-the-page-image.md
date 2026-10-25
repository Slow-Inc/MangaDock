# ADR 036 — MIT's gateway translator sees the page image

- Status: Accepted, 2026-10-26 (#1141). Evidence: [benchmark report](../reports/benchmarks/2026-10-26-1141-page-image-ab.md).
- Scope: `MIT/manga_translator/page_image.py`, `MangaTranslator._run_text_translation`,
  `translators/custom_openai.py` `_request_translation`.

## Context

The production translator (`custom_openai`, claude-haiku-5-5 on the Anthropic protocol) received only the OCR text of a
page, in reading order. It chose pronouns and particles without seeing the speakers, and it translated OCR slips as
they were written. MangaTranslator's default quality path sends the image with the text
(`docs/research/mangatranslator-study.md`); MIT had never measured it.

## Decision

1. **Every translation request of a page carries that page's image**, as a JPEG with its long side capped at 1568 px,
   placed in front of the numbered segments with a one-line note. The few-shot example stays text.
2. **The image rides a contextvar** that `_run_text_translation` sets for the page (`page_image_scope`). Retries of
   that page carry it too. The pages one worker runs at once (#1123 slots) each send their own image, because asyncio
   copies the context into every task.
3. **On by default**; `MIT_TRANSLATE_PAGE_IMAGE=0` turns it off. A model that answers an image request with a 400 gets
   the text request instead, and is sent text only for the rest of the process.

## Alternatives considered

- **Bubble crops instead of the page** (MangaTranslator sends both): more requests or a longer prompt for each page;
  the page alone already carries speaker and scene. Not measured.
- **A two-stage vision translator** (`chatgpt_2stage`, already in MIT): a second model call per page; it is not on the
  gateway path.
- **Keep it opt-in**: rejected. The developer confirmed that OpenCode Go quota is not a concern, and the chapter wall
  time did not move outside run-to-run noise.

## Consequences

- Blind A/B on 29 real pages, judged by deepseek-v4.1-flash with the image: votes text 97, image 163, tie 82; per page
  image 19, text 8, even 2 (sign test p = 0.052). The image fixes OCR slips (`HAIMIYAT -SENPAIS RINE` → ไลน์ของรุ่นพี่ไฮมิยะ)
  and speaker gender (ผม/ครับ for a male speaker). It is not a guarantee: a run can still pick ฉัน, and one run
  misspelt a name.
- Input tokens per page rise about 3× (median 1,111 → 3,346), and the translation call takes ~1.1 s longer (median
  2.05 → 3.15 s). A real 14-page chapter took 20.1–23.7 s, against 18.1–22.7 s without the image.
- A text-only model costs one rejected request per process before the fallback takes over.
