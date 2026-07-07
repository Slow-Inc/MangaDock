# Production-path defect inventory (§8.6) — 2026-07-02

Deterministic audit of the SHIPPING path (`/translate/with-form/patches`, reference_layout OFF,
lama_large) on Gal Yome ds4 + ds12, composited onto the originals. Purpose: separate REAL production
defects from artifacts (per the patch-vs-image-endpoint lesson) before spending fix effort.

## Real production defects found (ranked by render-tractability)
| # | defect | evidence | domain | next |
|---|--------|----------|--------|------|
| 1 | **garbled / fragmented small bubbles** | ds4 lower-left: Thai broken into 1–2-char stacked fragments ("เธอ/ได/ดี/ตั") | RENDER — tiny bubble → font shrinks + `_safe_char_split` force-splits | fix candidate (bubble-fit tiny-box floor / word-whole, like item-9 for clean_layout) |
| 2 | **name split mid-word** | ds12 "คุณฟ / ยุกิ" (Fuyuki-san broken across a line) | RENDER — wrap column narrower than the word | pairs with #1 (word-whole floor) |
| 3 | untranslated shout | "WHA-!?" left as-is | OCR/translation | investigate (is it OCR'd? glossary?) |
| 4 | SFX untranslated | ペ ガ / カ katakana | DETECTION (det_sfx) | out of render scope |
| 5 | name romaji | "Toujou Fuyuki" kept latin | translation/glossary | minor, arguably acceptable |

## Assessment
- The narration-oversize cluster (user-flagged, demo) is already fixed + guarded (reference_layout, flag off) — see 2026-07-02-narration-readable-narrow.

## CORRECTION (verified full-res + deterministic — the row #1/#2 claim was wrong)
The "garbled small bubbles" I first read off the 560px montage is NOT a render defect. Verified three ways:
- Deterministic replay of the ds4 fixture (2 runs): all 6 regions size to **26–66px, wrapped correctly** — no tiny-font char-split.
- Full-res crop: the lower-left bubbles render as **clean, readable, properly-wrapped Thai** ("ฉันรู้ว่ามัน / ยากที่จะ / จินตนาการ …").
- Inspecting the region translations: region r2 = **"เธอทำ JDB ได้อย่างยอดเยี่ยม…"** — the LLM produced the garbage token **"JDB"** (should be "งาน"/job). The render laid out the bad *text* faithfully.

**⇒ The fragment/garble is a TRANSLATION-quality defect (LLM hallucination), not render.** This is a
verify-before-claiming lesson on myself: I over-claimed a render defect from a blurry downscaled montage.
The production RENDER sizing is in good shape (readable, wrapped, no over-shrink) on these pages.

Remaining real defects are all **outside the render campaign**: translation quality (LLM garble like "JDB",
untranslated shout "WHA-!?", romaji names) and detection (untranslated katakana SFX). They each need their
own workstream (translator prompt/glossary; det_sfx). The render-defect master plan is substantially met.

![production defect inventory ds4 + ds12](./2026-07-02-production-defect-inventory.png)
