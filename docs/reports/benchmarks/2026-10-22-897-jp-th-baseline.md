# JP→TH smoke baseline on the two real Japanese pages (#897)

- **Date:** 2026-10-22 · **Issue:** #897 · **Material:** `Backend/uploads/chapters/752fc515-…/` (2 pages, vertical
  JP text) copied to `MIT/result/jp/jp_chapter_p0.jpg` / `_p1.jpg` (not committed).
- **Judge:** `tools/judge_translations.py`, now source-language agnostic ("any source language", `SR:` prefix).

## Commands (repeatable)

```powershell
# 1) run the pipeline on the real pages (JP source, Thai target)
python tools/doctor_page.py result/jp/jp_chapter_p0.jpg result/jp/jp_chapter_p1.jpg --target THA --tag _jp --out result/doctor/jp
# 2) score it
python tools/judge_translations.py tmp/jp_baseline.json result/doctor/jp/jp_chapter_p0_THA_jp.doctor.json result/doctor/jp/jp_chapter_p1_THA_jp.doctor.json
```

## Baseline

| page | segments | mean | 0 / 1 / 2 |
|---|---|---|---|
| jp_chapter_p0 | 7 | 1.71 | 1 / 1 / 5 |
| jp_chapter_p1 | 7 | 1.43 | 0 / 3 / 4 |
| **both** | **14** | **1.57** | 1 / 4 / 9 |

(EN corpus baseline for comparison: 372 segments, mean 1.51.)

## What the judge flagged

- **p0 #4 — meaning inverted:** `でも可愛くないなコイツ` ("this kid isn't cute") rendered `แต่เด็กนี่น่ารักดีนะ`
  ("is cute"). The negation is lost. The same phrase on p1 was rendered `ดูไม่ได้เลย` ("looks terrible") — also
  a nuance shift, but at least negative.
- Two `が` contrast nuances dropped (`…できるが` -> "อาจจะ…ได้" and p1's trailing `が`), one register shift
  (`あ？` -> `หึ?`).

## Layout observation (not a bug per the code)

The vertical-source regions keep a narrow column: `_clean_layout_dst` deliberately squeezes the wrap width to
fill the region's original height (#183, "user vs target") — the Thai column mirrors the Japanese column instead
of spanning the bubble. That is a design decision, not an oversight; changing it is a typesetting choice to make
with the product, not inline in a bug hunt.

## Conclusion

The production path now has a baseline and a repeatable command. Priority from the data: negation handling
(`可愛くない`) in JP→TH, which the new eval can now measure with real pages; layout remains a separate,
deliberate choice.
