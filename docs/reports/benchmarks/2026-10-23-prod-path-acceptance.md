# Production-path acceptance (2 pages, series context) + hedging guard rejected (#1058 family)

- **Date:** 2026-10-23 · script: sequential `translate_patches` on Tsuki p0/p1 with a `series_context`, real gateway.

## Production path result

- Series name memory applied **2 name fixes** on page 2 (consistent spelling across the chapter) — the production
  single-page path now gets the batch glossary's consistency win.
- Gate: 4 `empty_translation` findings, all on **Japanese source regions on an English page** (original credits/`月`/
  SFX) that the source-language filter keeps as **original artwork** (rendered as-is, no translation by design). They
  are not missing translations; with that rule applied the page is clean.
- Nothing else: no foreign script, no runaway, no name inconsistency across the two pages.

## Hedging-lost guard: rejected before implementation

Mined `I think / maybe / probably / seems / might / sort of / kind of` over all stored segments: **180 raw hits but
only ~10 unique**, and most are false positives — `what KIND OF thing` (not hedging), `I THINK?` answered as
`ใช่ไหม?`, `or so it seems` rendered `หรือว่าแค่ฉันเอง`. The genuinely dropped-hedging cases are a handful and sit on
OCR-noisy sources. A deterministic guard would fire far more often on non-hedges than on the defect, so **no guard**
was added; the class stays with the model (documented in the adjusted profile).

## Takeaway

Production path (single-page + series context + all default guards) behaves as designed; the deterministic lever list
is now exhausted for the current corpus. Remaining defects are model-ceiling sense/nuance plus the data-limited JP
evaluation.