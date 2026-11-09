# The analyst corrects the OCR source before translation — adopted (MIT_VISION_CONTEXT=correct)

**Idea.** The previous round showed the analyst model (claude-haiku-5-5) fixes every OCR error we can check
(7/7 and 3/3 on the ch. 6 pages: `WED`→`WE'D`, `DONT`/`ILL`, `ITS`, `I WA WORRIED`, `thats`), and that notes
in the prompt did not help. So use the correction where it changes information rather than style: replace the
OCR line with the analyst's corrected English **before** translation, with guards, behind
`MIT_VISION_CONTEXT=correct` (`0`/unset = today's behaviour, `notes` = the prompt-notes mode, `both`).

**Guards (pure, unit-tested):** a correction is applied only when it is non-empty, mostly ASCII (the source page
is English), 0.5–2× the length of the OCR line, and different from it. Anything else is ignored, and the whole
pass fails open — an analyst error leaves the page exactly as before.

**Blind A/B (geometry-matched, so region order cannot confound it)**

| sample | corrected source | raw OCR | tie |
|---|---|---|---|
| ch. 6 p9–10, 8 differing regions | 5 | 3 | 0 |
| 8 pages across two other chapters, 24 differing regions | 15 | 9 | 0 |
| **combined, 32 differing regions** | **20 (62.5 %)** | 12 | 0 |

All 14 pages translated successfully with the pass on; the analyst corrected 3–9 lines per page
(`[vision-context] analyst corrected the source of N lines` in the worker log).

**Cost (quality-first direction, recorded for later):** the analyst call runs before translation, so the
translation stage goes 7.8 s → 15.0 s p50 and the 14-page chapter **33.8/26.7 → 44.4/42.5 s**. Accepted as the
default for now; the obvious optimisation (a smaller analyst image, or running it only when the OCR output looks
degraded) is a follow-up, not a reason to ship the weaker source text.

**Adopted:** `MIT_VISION_CONTEXT=correct` in `MIT/.env`.

**Limits:** 32 differing regions is a directional result (62.5 %, not significant on its own); one judge model;
the corrections themselves were verified by eye on two pages only.
