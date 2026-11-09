# Page analyst for scene-aware context — Luna vs haiku (sweep round 4)

**Question (PRD Track B5, "scene-aware context"):** the pipeline can already send the page image with the
translation request, but a per-page *analysis* — who speaks, what kind of line it is, how intense — is not in the
prompt. Which of the two adopted models should act as that analyst, and is its output usable?

**Setup:** each model receives the page image (JPEG, long side 1568) plus the OCR lines in reading order, and is
asked for one JSON object: per line `corrected` English, `speaker`, `gender`, `role`
(dialogue/thought/narration/sfx/annotation), `emotion`; plus `missing` lettering. Pages 9–10 of Haimiya ch. 6.

| | gpt-6-luna | claude-haiku-5-5 |
|---|---|---|
| page 9 | 32.1 s | **11.5 s** |
| page 10 | 29.9 s | **9.4 s** |
| OCR corrections that match the real lettering | 7/7 (p9), 3/3 (p10) | 7/7 (p9), 3/3 (p10) |
| output shape | valid JSON, SFX lines left empty with role `annotation` | valid JSON, one CJK SFX named (`ドキッ`) |

Both models fixed every misread: `WED`→`WE'D`, `DONT`/`ILL`→`DON'T`/`I'LL`, `ITS`→`IT'S`,
`I WA WORRIED`→`I WAS WORRIED`, `thats`→`that's`. Both separated SFX from dialogue and labelled thought vs
dialogue (they disagree on one line's role/gender, page 9 line 4 — that is a judgement call on a page-wide
two-shot, not an OCR failure).

**Verdict: haiku is the analyst, Luna stays the translator.** The analyst job is correction + classification, and
on this sample haiku is equal in quality at **3× the speed** — a per-stage model split is exactly what the sweep
is for. Luna stays where its prose quality showed (translation).

**Integration notes (next step, not done)**
- The analyst call can overlap detection/OCR (it only needs the page image and the OCR lines), so most of its
  9–12 s can hide behind the non-translation stages instead of adding to the page.
- Its output is the input the translation prompt needs: per-line `speaker`/`gender`/`role`/`emotion` plus the
  corrected English. That is a flag-gated prompt change (`MIT_VISION_CONTEXT=1`), then the #1141 blind A/B on
  translations with and without it.
- Cost per page: ~1.6–1.9k characters of JSON out; one extra vision call.

**Limits:** two pages, one series, judged by eye against the lettering visible in the source; no human A/B of the
resulting translations yet (that is the test that decides adoption).
